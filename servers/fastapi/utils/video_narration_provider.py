from utils.get_env import (
    get_comfyui_tts_url_env,
    get_comfyui_tts_workflow_env,
    get_disable_video_narration_env,
)
from utils.parsers import parse_bool_or_none


def is_video_narration_disabled() -> bool:
    return parse_bool_or_none(get_disable_video_narration_env()) or False


def is_video_narration_configured() -> bool:
    return bool(get_comfyui_tts_url_env()) and bool(get_comfyui_tts_workflow_env())
