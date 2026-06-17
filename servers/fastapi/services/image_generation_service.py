import asyncio
import base64
import json
import os
import secrets
import aiohttp
from fastapi import HTTPException
from google import genai
from google.genai import types
from openai import NOT_GIVEN, AsyncOpenAI
from models.image_prompt import ImagePrompt
from models.sql.image_asset import ImageAsset
from utils.get_env import (
    get_dall_e_3_quality_env,
    get_gpt_image_1_5_quality_env,
    get_pexels_api_key_env,
    get_open_webui_image_url_env,
    get_open_webui_image_api_key_env,
    get_openai_compat_image_base_url_env,
    get_openai_compat_image_api_key_env,
    get_openai_compat_image_model_env,
)
from utils.get_env import get_pixabay_api_key_env
from utils.get_env import get_comfyui_url_env
from utils.get_env import get_comfyui_workflow_env
from utils.image_provider import (
    is_gpt_image_1_5_selected,
    is_image_generation_disabled,
    is_pixels_selected,
    is_pixabay_selected,
    is_gemini_flash_selected,
    is_nanobanana_pro_selected,
    is_dalle3_selected,
    is_comfyui_selected,
    is_open_webui_selected,
    is_openai_compatible_selected,
)
from utils.asset_directory_utils import absolute_fastapi_asset_url
from utils.image_generation_error import normalize_image_generation_error
import uuid


COMFYUI_MAX_SEED = 0xFFFFFFFFFFFFFFFF
COMFYUI_SEED_SOURCE_VALUE_KEYS = {"value", "int", "integer", "number"}


class ImageGenerationService:
    def __init__(self, output_directory: str):
        self.output_directory = output_directory
        self.is_image_generation_disabled = is_image_generation_disabled()
        self.image_gen_func = self.get_image_gen_func()

    def get_image_gen_func(self):
        if self.is_image_generation_disabled:
            return None

        if is_pixabay_selected():
            return self.get_image_from_pixabay
        elif is_pixels_selected():
            return self.get_image_from_pexels
        elif is_gemini_flash_selected():
            return self.generate_image_gemini_flash
        elif is_nanobanana_pro_selected():
            return self.generate_image_nanobanana_pro
        elif is_dalle3_selected():
            return self.generate_image_openai_dalle3
        elif is_gpt_image_1_5_selected():
            return self.generate_image_openai_gpt_image_1_5
        elif is_comfyui_selected():
            return self.generate_image_comfyui
        elif is_open_webui_selected():
            return self.generate_image_open_webui
        elif is_openai_compatible_selected():
            return self.generate_image_openai_compatible
        return None

    def is_stock_provider_selected(self):
        return is_pixels_selected() or is_pixabay_selected()

    async def generate_image(self, prompt: ImagePrompt) -> str | ImageAsset:
        """
        Generates an image based on the provided prompt.
        - If no image generation function is available, returns a placeholder image.
        - If the stock provider is selected, it uses the prompt directly,
        otherwise it uses the full image prompt with theme.
        - Output Directory is used for saving the generated image not the stock provider.
        """
        if self.is_image_generation_disabled:
            print("Image generation is disabled. Using placeholder image.")
            return absolute_fastapi_asset_url("/static/images/placeholder.jpg")

        if not self.image_gen_func:
            print("No image generation function found. Using placeholder image.")
            return absolute_fastapi_asset_url("/static/images/placeholder.jpg")

        image_prompt = prompt.get_image_prompt(
            with_theme=not self.is_stock_provider_selected()
        )
        print(f"Request - Generating Image for {image_prompt}")

        try:
            if self.is_stock_provider_selected():
                image_path = await self.image_gen_func(image_prompt)
            else:
                image_path = await self.image_gen_func(
                    image_prompt, self.output_directory
                )
            if image_path:
                if image_path.startswith("http"):
                    return image_path
                elif os.path.exists(image_path):
                    return ImageAsset(
                        path=image_path,
                        is_uploaded=False,
                        extras={
                            "prompt": prompt.prompt,
                            "theme_prompt": prompt.theme_prompt,
                        },
                    )
                elif image_path.startswith("/app_data/") or image_path.startswith(
                    "/static/"
                ):
                    return absolute_fastapi_asset_url(image_path)
            raise Exception(f"Image not found at {image_path}")

        except Exception as e:
            print(f"Error generating image: {e}")
            normalized_error = normalize_image_generation_error(e)
            if normalized_error is e:
                raise
            raise normalized_error from e

    async def generate_image_openai(
        self, prompt: str, output_directory: str, model: str, quality: str
    ) -> str:
        client = AsyncOpenAI()
        result = await client.images.generate(
            model=model,
            prompt=prompt,
            n=1,
            quality=quality,
            response_format="b64_json" if model == "dall-e-3" else NOT_GIVEN,
            size="1024x1024",
        )
        image_path = os.path.join(output_directory, f"{uuid.uuid4()}.png")
        with open(image_path, "wb") as f:
            f.write(base64.b64decode(result.data[0].b64_json))
        return image_path

    async def generate_image_openai_dalle3(
        self, prompt: str, output_directory: str
    ) -> str:
        return await self.generate_image_openai(
            prompt,
            output_directory,
            "dall-e-3",
            get_dall_e_3_quality_env() or "standard",
        )

    async def generate_image_openai_gpt_image_1_5(
        self, prompt: str, output_directory: str
    ) -> str:
        return await self.generate_image_openai(
            prompt,
            output_directory,
            "gpt-image-1.5",
            get_gpt_image_1_5_quality_env() or "medium",
        )

    async def generate_image_open_webui(
        self, prompt: str, output_directory: str
    ) -> str:
        base_url = get_open_webui_image_url_env()
        if not base_url:
            raise ValueError("OPEN_WEBUI_IMAGE_URL environment variable is not set")

        base_url = base_url.rstrip("/")
        api_key = get_open_webui_image_api_key_env() or ""

        from urllib.parse import urlparse

        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
        }

        async with aiohttp.ClientSession(trust_env=True) as session:
            resp = await session.post(
                f"{base_url}/images/generations",
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=300),
            )

            if resp.status != 200:
                error_text = await resp.text()
                raise Exception(
                    f"Open WebUI image generation returned {resp.status}: {error_text}"
                )

            body = await resp.json()

            # Open WebUI returns a bare [...] array instead of {"data": [...]}.
            if isinstance(body, list):
                items = body
            elif isinstance(body, dict) and "data" in body:
                items = body["data"]
            else:
                raise Exception(f"Unexpected response format: {type(body)}")

            if not items:
                raise Exception("Open WebUI returned empty results")

            item = items[0]
            image_path = os.path.join(output_directory, f"{uuid.uuid4()}.png")

            if item.get("b64_json"):
                with open(image_path, "wb") as f:
                    f.write(base64.b64decode(item["b64_json"]))
            elif item.get("url"):
                image_url = item["url"]
                # Open WebUI returns relative URLs like /api/v1/files/.../content
                if image_url.startswith("/"):
                    image_url = origin + image_url
                dl_headers = {}
                if api_key:
                    dl_headers["Authorization"] = f"Bearer {api_key}"
                dl_resp = await session.get(
                    image_url,
                    headers=dl_headers,
                    timeout=aiohttp.ClientTimeout(total=120),
                )
                if dl_resp.status != 200:
                    raise Exception(
                        f"Failed to download image: {dl_resp.status}"
                    )
                with open(image_path, "wb") as f:
                    f.write(await dl_resp.read())
            else:
                raise Exception("Open WebUI returned no image data")

        return image_path

    async def _generate_image_google(
        self, prompt: str, output_directory: str, model: str
    ) -> str:
        """Base method for Google image generation models."""
        client = genai.Client()
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )

        # Latest SDK docs expose images in response.parts.
        response_parts = getattr(response, "parts", None)
        if not response_parts and getattr(response, "candidates", None):
            first_candidate = response.candidates[0] if response.candidates else None
            content = (
                getattr(first_candidate, "content", None) if first_candidate else None
            )
            response_parts = getattr(content, "parts", None) if content else None

        image_path = None
        for part in response_parts or []:
            if part.inline_data is not None:
                mime_type = getattr(part.inline_data, "mime_type", "") or ""
                ext = (
                    mime_type.split("/")[-1]
                    if mime_type.startswith("image/")
                    else "png"
                )
                image_path = os.path.join(output_directory, f"{uuid.uuid4()}.{ext}")
                if hasattr(part, "as_image"):
                    part.as_image().save(image_path)
                else:
                    # Backward-compatible fallback if helper method is unavailable.
                    image_data = getattr(part.inline_data, "data", None)
                    if image_data is None:
                        continue
                    image_bytes = (
                        base64.b64decode(image_data)
                        if isinstance(image_data, str)
                        else image_data
                    )
                    with open(image_path, "wb") as image_file:
                        image_file.write(image_bytes)

        if not image_path:
            raise HTTPException(
                status_code=500, detail=f"No image generated by google {model}"
            )

        return image_path

    async def generate_image_gemini_flash(
        self, prompt: str, output_directory: str
    ) -> str:
        """Generate image using Gemini Flash (gemini-2.5-flash-image)."""
        return await self._generate_image_google(
            prompt, output_directory, "gemini-2.5-flash-image"
        )

    async def generate_image_nanobanana_pro(
        self, prompt: str, output_directory: str
    ) -> str:
        """Generate image using NanoBanana Pro (gemini-3-pro-image-preview)."""
        return await self._generate_image_google(
            prompt, output_directory, "gemini-3-pro-image-preview"
        )

    async def get_image_from_pexels(
        self, prompt: str, api_key: str | None = None, limit: int = 1
    ) -> str | list[str]:
        per_page = max(1, min(limit, 80))
        resolved_api_key = (api_key or get_pexels_api_key_env() or "").strip()

        async with aiohttp.ClientSession(trust_env=True) as session:
            response = await session.get(
                "https://api.pexels.com/v1/search",
                params={"query": prompt, "per_page": per_page},
                headers={"Authorization": resolved_api_key} if resolved_api_key else {},
                timeout=aiohttp.ClientTimeout(total=20),
            )

            if response.status in {401, 403}:
                raise HTTPException(status_code=401, detail="Invalid Pexels API key")
            if response.status != 200:
                error_text = await response.text()
                raise HTTPException(
                    status_code=502,
                    detail=f"Pexels request failed: {error_text}",
                )

            data = await response.json()
            photos = data.get("photos", [])
            image_urls = [
                photo.get("src", {}).get("large")
                for photo in photos
                if photo.get("src", {}).get("large")
            ]

            if limit <= 1:
                return image_urls[0] if image_urls else ""
            return image_urls[:limit]

    async def get_image_from_pixabay(
        self, prompt: str, api_key: str | None = None, limit: int = 1
    ) -> str | list[str]:
        per_page = max(3, min(limit, 200))
        resolved_api_key = (api_key or get_pixabay_api_key_env() or "").strip()

        async with aiohttp.ClientSession(trust_env=True) as session:
            response = await session.get(
                "https://pixabay.com/api/",
                params={
                    "key": resolved_api_key,
                    "q": prompt[:99],
                    "image_type": "photo",
                    "per_page": per_page,
                },
                timeout=aiohttp.ClientTimeout(total=20),
            )

            if response.status in {401, 403}:
                error_text = await response.text()
                raise HTTPException(
                    status_code=401,
                    detail=f"Invalid Pixabay API key: {error_text}",
                )
            if response.status == 400:
                error_text = await response.text()
                if "api key" in error_text.lower():
                    raise HTTPException(
                        status_code=401,
                        detail=f"Invalid Pixabay API key: {error_text}",
                    )
                raise HTTPException(
                    status_code=400,
                    detail=f"Pixabay request invalid: {error_text}",
                )
            if response.status != 200:
                error_text = await response.text()
                raise HTTPException(
                    status_code=502,
                    detail=f"Pixabay request failed: {error_text}",
                )

            data = await response.json()
            hits = data.get("hits", [])
            image_urls = [
                hit.get("largeImageURL") for hit in hits if hit.get("largeImageURL")
            ]

            if limit <= 1:
                return image_urls[0] if image_urls else ""
            return image_urls[:limit]

    async def generate_image_comfyui(self, prompt: str, output_directory: str) -> str:
        """
        Generate image using ComfyUI workflow API.

        User provides:
        - COMFYUI_URL: ComfyUI server URL (e.g., http://192.168.1.7:8188)
        - COMFYUI_WORKFLOW: Workflow JSON exported from ComfyUI

        The workflow should have a CLIPTextEncode node with "Positive" in the title
        where the prompt will be injected.

        Args:
            prompt: The text prompt for image generation
            output_directory: Directory to save the generated image

        Returns:
            Path to the generated image file
        """
        comfyui_url = get_comfyui_url_env()
        workflow_json = get_comfyui_workflow_env()

        if not comfyui_url:
            raise ValueError("COMFYUI_URL environment variable is not set")

        if not workflow_json:
            raise ValueError(
                "COMFYUI_WORKFLOW environment variable is not set. Please provide a ComfyUI workflow JSON."
            )

        # Ensure URL doesn't have trailing slash
        comfyui_url = comfyui_url.rstrip("/")

        # Parse the workflow JSON
        try:
            workflow = json.loads(workflow_json)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid workflow JSON: {str(e)}")

        # Find and update the positive prompt node
        workflow = self._inject_prompt_into_workflow(workflow, prompt)
        randomized_seed_count = self._inject_random_seeds_into_workflow(workflow)
        if randomized_seed_count:
            print(
                f"Randomized {randomized_seed_count} ComfyUI seed input(s) before submission"
            )

        async with aiohttp.ClientSession(trust_env=True) as session:
            # Step 1: Submit workflow
            prompt_id = await self._submit_comfyui_workflow(
                session, comfyui_url, workflow
            )

            # Step 2: Wait for completion
            status_data = await self._wait_for_comfyui_completion(
                session, comfyui_url, prompt_id
            )

            # Step 3: Download the generated image
            image_path = await self._download_comfyui_image(
                session, comfyui_url, status_data, prompt_id, output_directory
            )

            return image_path

    def _inject_prompt_into_workflow(self, workflow: dict, prompt: str) -> dict:
        node_index = self._build_comfyui_node_index(workflow)

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
            "text", "value", "prompt", "string", "content", "instruction", "input", "query"
        )

        # string inputs that are usually NOT prompt text
        ignore_keys = {
            "filename_prefix", "ckpt_name", "clip_name", "vae_name", "unet_name",
            "sampler_name", "scheduler", "type", "device", "model", "lora_name"
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

            # 1) preferred prompt-like keys
            for k in preferred_keys:
                if k in inputs and isinstance(inputs[k], str):
                    inputs[k] = prompt
                    return True

            # 2) fallback: exactly one unambiguous writable string field
            string_candidates = [
                k for k, v in inputs.items()
                if isinstance(v, str) and k not in ignore_keys
            ]
            if len(string_candidates) == 1:
                inputs[string_candidates[0]] = prompt
                return True

            # 3) follow links from ANY input key (node-type agnostic)
            for v in inputs.values():
                if is_link(v):
                    if try_set(v[0]):
                        return True
                elif isinstance(v, list):
                    for item in v:
                        if is_link(item) and try_set(item[0]):
                            return True

            return False

        input_prompt_nodes = [
            node_id
            for node_id, node_data in node_index.items()
            if norm(node_data.get("_meta", {}).get("title")) == "input prompt"
        ]

        if not input_prompt_nodes:
            raise ValueError(
                "Could not find node with title 'Input Prompt'. Rename your prompt node to 'Input Prompt'."
            )

        for nid in input_prompt_nodes:
            if try_set(nid):
                return workflow

        raise ValueError(
            "Found 'Input Prompt', but no writable prompt string field was found directly or through linked nodes."
        )

    def _inject_random_seeds_into_workflow(self, workflow: dict) -> int:
        """
        Randomize ComfyUI seed inputs before submitting the workflow.

        ComfyUI API-format workflows only include current widget values, not the
        UI's control_after_generate setting. Randomizing numeric seed-like inputs
        here gives each Presenton regeneration a new output for the same prompt.
        """
        node_index = self._build_comfyui_node_index(workflow)
        randomized_inputs: set[tuple[int, str]] = set()
        visited_objects: set[int] = set()
        seed_update_count = 0

        def randomize_input(inputs: dict, key: object) -> bool:
            nonlocal seed_update_count

            key_text = str(key)
            marker = (id(inputs), key_text)
            if marker in randomized_inputs:
                return False

            value = inputs.get(key)
            if not self._is_comfyui_seed_value(value):
                return False

            new_seed = self._generate_comfyui_seed()
            inputs[key] = str(new_seed) if isinstance(value, str) else new_seed
            randomized_inputs.add(marker)
            seed_update_count += 1
            return True

        def randomize_linked_seed_source(link: list | tuple) -> None:
            source_node = node_index.get(str(link[0]))
            if not isinstance(source_node, dict):
                return

            inputs = source_node.get("inputs")
            if not isinstance(inputs, dict):
                return

            updated = False
            for source_key in list(inputs.keys()):
                if self._is_comfyui_seed_key(source_key):
                    updated = randomize_input(inputs, source_key) or updated

            if updated:
                return

            source_candidates = [
                key
                for key, value in inputs.items()
                if self._normalize_comfyui_key(key) in COMFYUI_SEED_SOURCE_VALUE_KEYS
                and self._is_comfyui_seed_value(value)
            ]
            if len(source_candidates) == 1:
                randomize_input(inputs, source_candidates[0])

        def walk(obj) -> None:
            object_id = id(obj)
            if object_id in visited_objects:
                return
            visited_objects.add(object_id)

            if isinstance(obj, dict):
                inputs = obj.get("inputs")
                if isinstance(inputs, dict):
                    for input_key, input_value in list(inputs.items()):
                        if not self._is_comfyui_seed_key(input_key):
                            continue
                        if self._is_comfyui_link(input_value):
                            randomize_linked_seed_source(input_value)
                        else:
                            randomize_input(inputs, input_key)

                for value in obj.values():
                    walk(value)
            elif isinstance(obj, list):
                for value in obj:
                    walk(value)

        walk(workflow)
        return seed_update_count

    def _build_comfyui_node_index(self, workflow: dict) -> dict[str, dict]:
        node_index: dict[str, dict] = {}
        visited_objects: set[int] = set()

        def walk(obj) -> None:
            object_id = id(obj)
            if object_id in visited_objects:
                return
            visited_objects.add(object_id)

            if isinstance(obj, dict):
                if isinstance(obj.get("inputs"), dict):
                    node_id = obj.get("id")
                    if node_id is not None:
                        node_index[str(node_id)] = obj

                for key, value in obj.items():
                    if isinstance(value, dict) and isinstance(value.get("inputs"), dict):
                        node_index[str(key)] = value
                    walk(value)
            elif isinstance(obj, list):
                for value in obj:
                    walk(value)

        walk(workflow)
        return node_index

    def _normalize_comfyui_key(self, key: object) -> str:
        return str(key or "").strip().replace("-", "_").replace(" ", "_").lower()

    def _is_comfyui_seed_key(self, key: object) -> bool:
        normalized_key = self._normalize_comfyui_key(key).replace("_", "")
        return normalized_key == "seed" or normalized_key.endswith("seed")

    def _is_comfyui_seed_value(self, value: object) -> bool:
        if isinstance(value, bool):
            return False
        if isinstance(value, int):
            return True
        if isinstance(value, str):
            raw_value = value.strip()
            return raw_value.isdigit() or (
                raw_value.startswith("-") and raw_value[1:].isdigit()
            )
        return False

    def _is_comfyui_link(self, value: object) -> bool:
        return (
            isinstance(value, (list, tuple))
            and len(value) >= 2
            and isinstance(value[0], (str, int))
            and isinstance(value[1], int)
        )

    def _generate_comfyui_seed(self) -> int:
        return secrets.randbelow(COMFYUI_MAX_SEED + 1)

    async def _submit_comfyui_workflow(
        self, session: aiohttp.ClientSession, comfyui_url: str, workflow: dict
    ) -> str:
        """Submit workflow to ComfyUI and return the prompt_id."""
        client_id = str(uuid.uuid4())
        payload = {"prompt": workflow, "client_id": client_id}

        response = await session.post(
            f"{comfyui_url}/prompt",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=30),
        )

        if response.status != 200:
            error_text = await response.text()
            raise Exception(f"Failed to submit workflow to ComfyUI: {error_text}")

        data = await response.json()
        prompt_id = data.get("prompt_id")

        if not prompt_id:
            raise Exception("No prompt_id returned from ComfyUI")

        print(f"ComfyUI workflow submitted. Prompt ID: {prompt_id}")
        return prompt_id

    async def _wait_for_comfyui_completion(
        self,
        session: aiohttp.ClientSession,
        comfyui_url: str,
        prompt_id: str,
        timeout: int = 3000,
        poll_interval: int = 4,
    ) -> dict:
        """Poll ComfyUI history endpoint until workflow completes."""
        start_time = asyncio.get_event_loop().time()

        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout:
                raise Exception(f"ComfyUI workflow timed out after {timeout} seconds")

            await asyncio.sleep(poll_interval)

            response = await session.get(
                f"{comfyui_url}/history/{prompt_id}",
                timeout=aiohttp.ClientTimeout(total=30),
            )

            if response.status != 200:
                continue

            try:
                status_data = await response.json()
            except Exception as _:
                continue

            if prompt_id in status_data:
                execution_data = status_data[prompt_id]

                # Check for completion
                if "status" in execution_data:
                    status = execution_data["status"]
                    if status.get("completed", False):
                        print("ComfyUI workflow completed successfully")
                        return status_data
                    if "error" in status:
                        raise Exception(f"ComfyUI workflow error: {status['error']}")

                # Also check if outputs exist (alternative completion check)
                if "outputs" in execution_data and execution_data["outputs"]:
                    print("ComfyUI workflow completed (outputs found)")
                    return status_data

            print(f"Waiting for ComfyUI workflow... ({int(elapsed)}s)")

    async def _download_comfyui_image(
        self,
        session: aiohttp.ClientSession,
        comfyui_url: str,
        status_data: dict,
        prompt_id: str,
        output_directory: str,
    ) -> str:
        """Download the generated image from ComfyUI."""
        if prompt_id not in status_data:
            raise Exception("Prompt ID not found in status data")

        outputs = status_data[prompt_id].get("outputs", {})

        if not outputs:
            raise Exception("No outputs found in ComfyUI response")

        # Find the first image in outputs
        for node_id, node_output in outputs.items():
            if "images" in node_output:
                for image_info in node_output["images"]:
                    filename = image_info["filename"]
                    subfolder = image_info.get("subfolder", "")

                    # Build view params
                    params = {"filename": filename, "type": "output"}
                    if subfolder:
                        params["subfolder"] = subfolder

                    # Download the image
                    response = await session.get(
                        f"{comfyui_url}/view",
                        params=params,
                        timeout=aiohttp.ClientTimeout(total=60),
                    )

                    if response.status == 200:
                        image_data = await response.read()

                        # Determine extension
                        ext = filename.split(".")[-1] if "." in filename else "png"
                        image_path = os.path.join(
                            output_directory, f"{uuid.uuid4()}.{ext}"
                        )

                        with open(image_path, "wb") as f:
                            f.write(image_data)

                        print(f"Downloaded image from ComfyUI: {image_path}")
                        return image_path
                    else:
                        raise Exception(f"Failed to download image: {response.status}")

    async def generate_image_openai_compatible(
        self, prompt: str, output_directory: str
    ) -> str:
        base_url = get_openai_compat_image_base_url_env()
        api_key = get_openai_compat_image_api_key_env()
        model = get_openai_compat_image_model_env()

        if not base_url or not api_key or not model:
            raise ValueError(
                "OPENAI_COMPAT_IMAGE_BASE_URL, OPENAI_COMPAT_IMAGE_API_KEY and OPENAI_COMPAT_IMAGE_MODEL must be set."
            )

        from urllib.parse import urlparse

        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        client = AsyncOpenAI(base_url=base_url, api_key=api_key)

        response = await client.images.generate(
            model=model,
            prompt=prompt,
            n=1,
            size="1024x1024",
        )

        item = response.data[0]
        image_path = os.path.join(output_directory, f"{uuid.uuid4()}.png")

        if item.b64_json:
            with open(image_path, "wb") as f:
                f.write(base64.b64decode(item.b64_json))
        elif item.url:
            image_url = item.url
            if image_url.startswith("/"):
                image_url = origin + image_url
            headers = {"Authorization": f"Bearer {api_key}"}
            async with aiohttp.ClientSession(trust_env=True) as session:
                dl_resp = await session.get(
                    image_url,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=120),
                )
                if dl_resp.status != 200:
                    raise Exception(
                        f"Failed to download image from OpenAI-compatible provider: {dl_resp.status}"
                    )
                with open(image_path, "wb") as f:
                    f.write(await dl_resp.read())
        else:
            raise Exception("OpenAI-compatible provider returned no image data")

        return image_path
