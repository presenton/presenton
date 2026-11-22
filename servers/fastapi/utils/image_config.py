LEGACY_GPT_IMAGE_PROVIDERS = {"gpt-image-1.5", "gpt-image-1.5-2025-12-16"}
DEFAULT_OPENAI_IMAGE_PROVIDER = "gpt-image-2.5-flare"


def migrate_legacy_image_config(config: dict) -> dict:
    """Normalize retired image providers without changing explicit alternatives."""
    config = dict(config)
    if config.get("IMAGE_PROVIDER") == "dall-e-3":
        config["IMAGE_PROVIDER"] = "gpt-image-2"
        if not config.get("GPT_IMAGE_2_QUALITY"):
            config["GPT_IMAGE_2_QUALITY"] = (
                "high" if config.get("DALL_E_3_QUALITY") == "hd" else "medium"
            )
    elif (
        isinstance(config.get("IMAGE_PROVIDER"), str)
        and config["IMAGE_PROVIDER"] in LEGACY_GPT_IMAGE_PROVIDERS
    ):
        config["IMAGE_PROVIDER"] = DEFAULT_OPENAI_IMAGE_PROVIDER
        if not config.get("GPT_IMAGE_2_5_QUALITY"):
            if config.get("GPT_IMAGE_1_5_QUALITY"):
                config["GPT_IMAGE_2_5_QUALITY"] = config["GPT_IMAGE_1_5_QUALITY"]
            else:
                config["GPT_IMAGE_2_5_QUALITY"] = "medium"
    config.pop("DALL_E_3_QUALITY", None)
    config.pop("GPT_IMAGE_1_5_QUALITY", None)
    return config
