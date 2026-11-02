from enums.image_provider import ImageProvider
from utils.get_env import (
    get_disable_image_generation_env,
    get_image_provider_env,
)
from utils.parsers import parse_bool_or_none
from utils.image_config import LEGACY_GPT_IMAGE_PROVIDERS


def is_image_generation_disabled() -> bool:
    return parse_bool_or_none(get_disable_image_generation_env()) or False


def is_pixels_selected() -> bool:
    return ImageProvider.PEXELS == get_selected_image_provider()


def is_pixabay_selected() -> bool:
    return ImageProvider.PIXABAY == get_selected_image_provider()


def is_openai_compatible_selected() -> bool:
    return ImageProvider.OPENAI_COMPATIBLE == get_selected_image_provider()


def is_gemini_flash_selected() -> bool:
    return ImageProvider.GEMINI_FLASH == get_selected_image_provider()


def is_nanobanana_pro_selected() -> bool:
    return ImageProvider.NANOBANANA_PRO == get_selected_image_provider()


def is_gpt_image_2_selected() -> bool:
    return ImageProvider.GPT_IMAGE_2 == get_selected_image_provider()


def is_gpt_image_2_5_flare_selected() -> bool:
    return ImageProvider.GPT_IMAGE_2_5_FLARE == get_selected_image_provider()


def is_gpt_image_2_5_sunburst_selected() -> bool:
    return ImageProvider.GPT_IMAGE_2_5_SUNBURST == get_selected_image_provider()


def is_comfyui_selected() -> bool:
    return ImageProvider.COMFYUI == get_selected_image_provider()


def is_open_webui_selected() -> bool:
    return ImageProvider.OPEN_WEBUI == get_selected_image_provider()


def get_selected_image_provider() -> ImageProvider | None:
    """
    Get the selected image provider from environment variables.
    Returns:
        ImageProvider: The selected image provider.
    """
    image_provider_env = get_image_provider_env()
    # Existing deployments may still have the removed model in their environment.
    if image_provider_env == "dall-e-3":
        return ImageProvider.GPT_IMAGE_2
    if image_provider_env in LEGACY_GPT_IMAGE_PROVIDERS:
        return ImageProvider.GPT_IMAGE_2_5_FLARE
    if image_provider_env:
        return ImageProvider(image_provider_env)
    return None
