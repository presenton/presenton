from enums.video_narration_provider import VideoNarrationProvider
from utils.get_env import (
    get_comfyui_tts_url_env,
    get_comfyui_tts_workflow_env,
    get_disable_video_narration_env,
    get_video_narration_provider_env,
)
from utils.parsers import parse_bool_or_none


def is_video_narration_disabled() -> bool:
    return parse_bool_or_none(get_disable_video_narration_env()) or False


def get_selected_video_narration_provider() -> VideoNarrationProvider | None:
    """
    Get the selected video narration (TTS) provider from environment
    variables. Mirrors get_selected_image_provider() in
    utils/image_provider.py. ComfyUI is currently the only option; more
    providers can be added here as they're supported.
    """
    provider_env = get_video_narration_provider_env()
    if provider_env:
        return VideoNarrationProvider(provider_env)
    return None


def is_comfyui_narration_selected() -> bool:
    selected = get_selected_video_narration_provider()
    # ComfyUI is currently the only provider -- treat "configured but no
    # provider explicitly chosen yet" as ComfyUI too, so existing setups
    # that only set COMFYUI_TTS_URL/COMFYUI_TTS_WORKFLOW keep working.
    if selected is None:
        return bool(get_comfyui_tts_url_env()) and bool(get_comfyui_tts_workflow_env())
    return selected == VideoNarrationProvider.COMFYUI


def is_video_narration_configured() -> bool:
    return bool(get_comfyui_tts_url_env()) and bool(get_comfyui_tts_workflow_env())
