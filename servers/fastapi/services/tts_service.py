import hashlib
import os
from typing import Optional

from camb.client import AsyncCambAI
from camb.types import StreamTtsOutputConfiguration

from utils.get_env import get_camb_api_key_env, get_camb_tts_model_env
from utils.asset_directory_utils import get_audio_directory


class TTSService:
    _default_voice_id: Optional[int] = None

    def __init__(self, output_directory: Optional[str] = None):
        self.output_directory = output_directory or get_audio_directory()
        self.api_key = get_camb_api_key_env()
        self.model = get_camb_tts_model_env() or "mars-flash"

    def _get_cache_key(self, text: str, voice_id: int) -> str:
        content = f"{self.model}:{voice_id}:{text}"
        return hashlib.sha256(content.encode()).hexdigest()

    def _get_cached_path(self, cache_key: str) -> Optional[str]:
        path = os.path.join(self.output_directory, f"{cache_key}.mp3")
        return path if os.path.isfile(path) else None

    async def _get_default_voice_id(self, client: AsyncCambAI) -> int:
        """Fetch the first available voice from the account."""
        if TTSService._default_voice_id is not None:
            return TTSService._default_voice_id
        voices = await client.voice_cloning.list_voices()
        if not voices:
            raise ValueError("No voices available in your CAMB AI account")
        TTSService._default_voice_id = voices[0]["id"]
        return TTSService._default_voice_id

    async def generate_audio(
        self,
        text: str,
        language: str = "en-us",
        voice_id: Optional[int] = None,
    ) -> str:
        """
        Generate TTS audio for the given text.
        Returns the filesystem path to the MP3 file.
        Uses content-hash caching to avoid regeneration.
        """
        if not self.api_key:
            raise ValueError("CAMB_API_KEY is not configured")

        client = AsyncCambAI(api_key=self.api_key)

        if voice_id is None:
            voice_id = await self._get_default_voice_id(client)

        cache_key = self._get_cache_key(text, voice_id)
        cached = self._get_cached_path(cache_key)
        if cached:
            return cached

        output_path = os.path.join(self.output_directory, f"{cache_key}.mp3")

        audio_stream = client.text_to_speech.tts(
            text=text,
            language=language,
            voice_id=voice_id,
            speech_model=self.model,
            output_configuration=StreamTtsOutputConfiguration(format="mp3"),
        )

        with open(output_path, "wb") as f:
            async for chunk in audio_stream:
                f.write(chunk)

        return output_path
