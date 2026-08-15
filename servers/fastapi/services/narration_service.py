"""
Generates narration audio for slide speaker notes using a ComfyUI TTS workflow.

This mirrors the ComfyUI image-generation flow in
services/image_generation_service.py (submit workflow -> poll /history ->
download output), but targets an audio-producing workflow instead of an
image-producing one, and injects the slide's speaker-note text instead of
an image prompt.

Required environment variables:
- COMFYUI_TTS_URL: ComfyUI server URL (falls back to COMFYUI_URL if unset,
  since a single ComfyUI instance commonly serves both image and TTS graphs)
- COMFYUI_TTS_WORKFLOW: Workflow JSON (API format) exported from ComfyUI.
  The workflow must contain a node titled "Input Text" whose text/string
  input will receive the slide's speaker note. A reference-voice / voice
  clone input, if the workflow has one, is left untouched here -- set it
  once in the workflow JSON itself (or via a node titled "Input Text" if
  your workflow route both, see _inject_text_into_workflow).
"""

import asyncio
import json
import logging
import os
import uuid

import aiohttp

from utils.get_env import get_comfyui_tts_url_env, get_comfyui_tts_workflow_env

LOGGER = logging.getLogger(__name__)

AUDIO_EXTENSIONS = (".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac")


class NarrationGenerationError(Exception):
    pass


class NarrationService:
    async def generate_narration_comfyui(
        self, text: str, output_directory: str
    ) -> str:
        """
        Generate a narration audio clip for `text` using the configured
        ComfyUI TTS workflow. Returns the filesystem path to the downloaded
        audio file.
        """
        comfyui_url = get_comfyui_tts_url_env()
        workflow_json = get_comfyui_tts_workflow_env()

        if not comfyui_url:
            raise NarrationGenerationError(
                "COMFYUI_TTS_URL (or COMFYUI_URL) environment variable is not set"
            )
        if not workflow_json:
            raise NarrationGenerationError(
                "COMFYUI_TTS_WORKFLOW environment variable is not set. "
                "Please provide a ComfyUI TTS workflow JSON (API format)."
            )

        comfyui_url = comfyui_url.rstrip("/")

        try:
            workflow = json.loads(workflow_json)
        except json.JSONDecodeError as e:
            raise NarrationGenerationError(f"Invalid TTS workflow JSON: {str(e)}")

        workflow = self._inject_text_into_workflow(workflow, text)

        async with aiohttp.ClientSession(trust_env=True) as session:
            prompt_id = await self._submit_workflow(session, comfyui_url, workflow)
            status_data = await self._wait_for_completion(
                session, comfyui_url, prompt_id
            )
            audio_path = await self._download_audio(
                session, comfyui_url, status_data, prompt_id, output_directory
            )
            return audio_path

    # -- workflow text injection -------------------------------------------------

    def _inject_text_into_workflow(self, workflow: dict, text: str) -> dict:
        node_index = self._build_node_index(workflow)

        def norm(x) -> str:
            return str(x or "").strip().lower()

        def is_link(v) -> bool:
            return (
                isinstance(v, (list, tuple))
                and len(v) >= 2
                and isinstance(v[0], (str, int))
                and isinstance(v[1], int)
            )

        preferred_keys = (
            "text", "value", "prompt", "string", "content", "input", "query"
        )
        ignore_keys = {
            "filename_prefix", "voice", "voice_name", "speaker", "model",
            "language", "lang", "device",
        }

        visited = set()

        def try_set(node_id: str) -> bool:
            node_id = str(node_id)
            if node_id in visited:
                return False
            visited.add(node_id)

            node = node_index.get(node_id)
            if not isinstance(node, dict):
                return False

            inputs = node.setdefault("inputs", {})

            for k in preferred_keys:
                if k in inputs and isinstance(inputs[k], str):
                    inputs[k] = text
                    return True

            string_candidates = [
                k for k, v in inputs.items()
                if isinstance(v, str) and k not in ignore_keys
            ]
            if len(string_candidates) == 1:
                inputs[string_candidates[0]] = text
                return True

            for v in inputs.values():
                if is_link(v):
                    if try_set(v[0]):
                        return True
                elif isinstance(v, list):
                    for item in v:
                        if is_link(item) and try_set(item[0]):
                            return True

            return False

        input_text_nodes = [
            node_id
            for node_id, node_data in node_index.items()
            if norm(node_data.get("_meta", {}).get("title")) == "input text"
        ]

        if not input_text_nodes:
            raise NarrationGenerationError(
                "Could not find node with title 'Input Text' in the TTS workflow. "
                "Rename your text/prompt node to 'Input Text'."
            )

        for nid in input_text_nodes:
            if try_set(nid):
                return workflow

        raise NarrationGenerationError(
            "Found 'Input Text' node, but no writable text string field was "
            "found directly or through linked nodes."
        )

    def _build_node_index(self, workflow: dict) -> dict:
        if all(isinstance(v, dict) and "class_type" in v for v in workflow.values()):
            return workflow
        # Some exports nest the graph under a "prompt" or "workflow" key.
        for key in ("prompt", "workflow", "nodes"):
            nested = workflow.get(key)
            if isinstance(nested, dict):
                return nested
        return workflow

    # -- ComfyUI submit / poll / download -----------------------------------------

    async def _submit_workflow(
        self, session: aiohttp.ClientSession, comfyui_url: str, workflow: dict
    ) -> str:
        client_id = str(uuid.uuid4())
        payload = {"prompt": workflow, "client_id": client_id}

        response = await session.post(
            f"{comfyui_url}/prompt",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=30),
        )

        if response.status != 200:
            error_text = await response.text()
            raise NarrationGenerationError(
                f"Failed to submit TTS workflow to ComfyUI: {error_text}"
            )

        data = await response.json()
        prompt_id = data.get("prompt_id")
        if not prompt_id:
            raise NarrationGenerationError("No prompt_id returned from ComfyUI")

        LOGGER.info("ComfyUI TTS workflow submitted. Prompt ID: %s", prompt_id)
        return prompt_id

    async def _wait_for_completion(
        self,
        session: aiohttp.ClientSession,
        comfyui_url: str,
        prompt_id: str,
        timeout: int = 600,
        poll_interval: int = 3,
    ) -> dict:
        start_time = asyncio.get_event_loop().time()

        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout:
                raise NarrationGenerationError(
                    f"ComfyUI TTS workflow timed out after {timeout} seconds"
                )

            await asyncio.sleep(poll_interval)

            response = await session.get(
                f"{comfyui_url}/history/{prompt_id}",
                timeout=aiohttp.ClientTimeout(total=30),
            )
            if response.status != 200:
                continue

            try:
                status_data = await response.json()
            except Exception:
                continue

            if prompt_id in status_data:
                execution_data = status_data[prompt_id]

                if "status" in execution_data:
                    status = execution_data["status"]
                    if status.get("completed", False):
                        return status_data
                    if "error" in status:
                        raise NarrationGenerationError(
                            f"ComfyUI TTS workflow error: {status['error']}"
                        )

                if "outputs" in execution_data and execution_data["outputs"]:
                    return status_data

    async def _download_audio(
        self,
        session: aiohttp.ClientSession,
        comfyui_url: str,
        status_data: dict,
        prompt_id: str,
        output_directory: str,
    ) -> str:
        if prompt_id not in status_data:
            raise NarrationGenerationError("Prompt ID not found in status data")

        outputs = status_data[prompt_id].get("outputs", {})
        if not outputs:
            raise NarrationGenerationError("No outputs found in ComfyUI TTS response")

        # ComfyUI TTS/audio custom nodes use varying output key names
        # ("audio", "audios", "gifs", "files", ...) depending on the node
        # pack. Rather than special-case each one, scan every output entry
        # under every key and take the first file whose name looks like an
        # audio file.
        for node_id, node_output in outputs.items():
            if not isinstance(node_output, dict):
                continue
            for _key, entries in node_output.items():
                if not isinstance(entries, list):
                    continue
                for entry in entries:
                    if not isinstance(entry, dict):
                        continue
                    filename = entry.get("filename")
                    if not filename:
                        continue
                    if not filename.lower().endswith(AUDIO_EXTENSIONS):
                        continue

                    subfolder = entry.get("subfolder", "")
                    file_type = entry.get("type", "output")
                    params = {"filename": filename, "type": file_type}
                    if subfolder:
                        params["subfolder"] = subfolder

                    response = await session.get(
                        f"{comfyui_url}/view",
                        params=params,
                        timeout=aiohttp.ClientTimeout(total=60),
                    )
                    if response.status != 200:
                        raise NarrationGenerationError(
                            f"Failed to download audio from ComfyUI: {response.status}"
                        )

                    audio_data = await response.read()
                    ext = filename.split(".")[-1] if "." in filename else "wav"
                    audio_path = os.path.join(
                        output_directory, f"{uuid.uuid4()}.{ext}"
                    )
                    with open(audio_path, "wb") as f:
                        f.write(audio_data)

                    LOGGER.info("Downloaded narration audio from ComfyUI: %s", audio_path)
                    return audio_path

        raise NarrationGenerationError(
            "No audio file found in ComfyUI TTS outputs. Confirm the workflow's "
            "save-audio node actually runs and produces a .wav/.mp3 output."
        )


NARRATION_SERVICE = NarrationService()
