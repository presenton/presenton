import asyncio
from typing import List, Optional, Sequence

from models.image_prompt import ImagePrompt
from models.json_path_guide import JsonPathGuide
from models.sql.image_asset import ImageAsset
from models.sql.slide import SlideModel
from services.icon_finder_service import ICON_FINDER_SERVICE
from services.image_generation_service import ImageGenerationService
from utils.asset_directory_utils import (
    filesystem_image_path_to_app_data_url,
    normalize_slide_asset_url,
)
from utils.dict_utils import get_dict_at_path, get_dict_paths_with_key, set_dict_at_path
from utils.icon_weights import DEFAULT_ICON_WEIGHT, normalize_icon_weight
from utils.image_generation_error import image_generation_warning


IMAGE_PROMPT_KEYS = ("__image_prompt__", "image_prompt", "prompt")
ICON_QUERY_KEYS = ("__icon_query__", "icon_query", "query")
TEMPLATE_ASSET_MARKER_KEYS = ("image_url", "icon_url", "image_prompt", "icon_query")


def _uses_template_asset_fields(slide: SlideModel) -> bool:
    if isinstance(slide.ui, dict):
        return True
    if isinstance(slide.content, dict):
        return bool(_dict_paths_with_any_key(slide.content, TEMPLATE_ASSET_MARKER_KEYS))
    return False


def _asset_url_key(asset_type: str, template: bool) -> str:
    if asset_type == "image":
        return "image_url" if template else "__image_url__"
    return "icon_url" if template else "__icon_url__"


def _set_asset_url(
    asset: dict,
    asset_type: str,
    url: str,
    *,
    template: bool,
) -> None:
    key = _asset_url_key(asset_type, template)
    asset[key] = url
    if template:
        asset.pop(f"__{asset_type}_url__", None)


def _get_asset_url(asset: dict, asset_type: str, *, template: bool) -> str | None:
    keys = (
        (_asset_url_key(asset_type, template), f"__{asset_type}_url__")
        if template
        else (_asset_url_key(asset_type, template),)
    )
    for key in keys:
        value = asset.get(key)
        if isinstance(value, str):
            return value
    return None


def _dict_paths_with_any_key(
    content: dict, keys: Sequence[str]
) -> List[JsonPathGuide]:
    paths: List[JsonPathGuide] = []
    for key in keys:
        for path in get_dict_paths_with_key(content, key):
            if path not in paths:
                paths.append(path)
    return paths


def _prompt_value(parent: dict, keys: Sequence[str]) -> Optional[str]:
    for key in keys:
        value = parent.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def _asset_dicts_with_prompt(
    content: dict, keys: Sequence[str]
) -> List[tuple[JsonPathGuide, dict, str]]:
    assets = []
    for path in _dict_paths_with_any_key(content, keys):
        parent = get_dict_at_path(content, path)
        prompt = _prompt_value(parent, keys)
        if prompt is not None:
            assets.append((path, parent, prompt))
    return assets


async def process_slide_and_fetch_assets(
    image_generation_service: ImageGenerationService,
    slide: SlideModel,
    outline_image_urls: Optional[List[str]] = None,
    icon_weight: str = DEFAULT_ICON_WEIGHT,
    allow_image_fallback: bool = False,
    image_warnings: Optional[List[dict]] = None,
) -> List[ImageAsset]:

    async_tasks = []
    async_task_meta = []
    resolved_icon_weight = normalize_icon_weight(icon_weight)
    template = _uses_template_asset_fields(slide)

    image_assets = _asset_dicts_with_prompt(slide.content, IMAGE_PROMPT_KEYS)
    icon_assets = _asset_dicts_with_prompt(slide.content, ICON_QUERY_KEYS)

    for image_index, (image_path, image_parent, image_prompt) in enumerate(
        image_assets
    ):

        if (
            outline_image_urls
            and image_index < len(outline_image_urls)
            and outline_image_urls[image_index]
        ):
            _set_asset_url(
                image_parent,
                "image",
                normalize_slide_asset_url(outline_image_urls[image_index]),
                template=template,
            )
            set_dict_at_path(slide.content, image_path, image_parent)
            continue

        async_tasks.append(
            image_generation_service.generate_image(
                ImagePrompt(prompt=image_prompt)
            )
        )
        async_task_meta.append(("image", image_path))

    for icon_path, _icon_parent, icon_query in icon_assets:
        async_tasks.append(
            ICON_FINDER_SERVICE.search_icons(
                icon_query,
                weight=resolved_icon_weight,
            )
        )
        async_task_meta.append(("icon", icon_path))

    results = (
        await asyncio.gather(*async_tasks, return_exceptions=allow_image_fallback)
        if async_tasks
        else []
    )

    return_assets = []
    for (task_type, asset_path), result in zip(async_task_meta, results):
        if task_type == "image":
            image_dict = get_dict_at_path(slide.content, asset_path)
            if isinstance(result, BaseException):
                if not allow_image_fallback:
                    raise result
                _set_asset_url(
                    image_dict,
                    "image",
                    normalize_slide_asset_url("/static/images/placeholder.jpg"),
                    template=template,
                )
                if image_warnings is not None and isinstance(result, Exception):
                    image_warnings.append(image_generation_warning(result))
                set_dict_at_path(slide.content, asset_path, image_dict)
                continue
            if isinstance(result, ImageAsset):
                return_assets.append(result)
                _set_asset_url(
                    image_dict,
                    "image",
                    filesystem_image_path_to_app_data_url(result.path),
                    template=template,
                )
            else:
                _set_asset_url(
                    image_dict,
                    "image",
                    normalize_slide_asset_url(result),
                    template=template,
                )
            set_dict_at_path(slide.content, asset_path, image_dict)
            continue

        if isinstance(result, BaseException):
            raise result
        icon_dict = get_dict_at_path(slide.content, asset_path)
        # ICON_FINDER_SERVICE.search_icons returns a list of URLs
        if isinstance(result, list) and result:
            icon_url = normalize_slide_asset_url(result[0])
        else:
            # Fallback to FastAPI static placeholder if no icon found
            icon_url = normalize_slide_asset_url("/static/icons/placeholder.svg")
        _set_asset_url(
            icon_dict,
            "icon",
            icon_url,
            template=template,
        )
        set_dict_at_path(slide.content, asset_path, icon_dict)

    return return_assets


async def process_old_and_new_slides_and_fetch_assets(
    image_generation_service: ImageGenerationService,
    old_slide_content: dict,
    new_slide_content: dict,
    icon_weight: str = DEFAULT_ICON_WEIGHT,
    use_template_asset_fields: bool = False,
    allow_image_fallback: bool = False,
    image_warnings: Optional[List[dict]] = None,
) -> List[ImageAsset]:
    resolved_icon_weight = normalize_icon_weight(icon_weight)
    old_image_assets = _asset_dicts_with_prompt(
        old_slide_content, IMAGE_PROMPT_KEYS
    )
    old_icon_assets = _asset_dicts_with_prompt(old_slide_content, ICON_QUERY_KEYS)
    new_image_assets = _asset_dicts_with_prompt(
        new_slide_content, IMAGE_PROMPT_KEYS
    )
    new_icon_assets = _asset_dicts_with_prompt(new_slide_content, ICON_QUERY_KEYS)

    old_image_urls = {
        prompt: image_url
        for _path, asset, prompt in old_image_assets
        if (
            image_url := _get_asset_url(
                asset,
                "image",
                template=use_template_asset_fields,
            )
        )
    }
    old_icon_urls = {
        query: icon_url
        for _path, asset, query in old_icon_assets
        if (
            icon_url := _get_asset_url(
                asset,
                "icon",
                template=use_template_asset_fields,
            )
        )
    }

    async_image_fetch_tasks = []
    fetched_image_targets = []
    for _path, new_image, image_prompt in new_image_assets:
        if image_prompt in old_image_urls:
            _set_asset_url(
                new_image,
                "image",
                old_image_urls[image_prompt],
                template=use_template_asset_fields,
            )
            continue
        async_image_fetch_tasks.append(
            image_generation_service.generate_image(ImagePrompt(prompt=image_prompt))
        )
        fetched_image_targets.append(new_image)

    async_icon_fetch_tasks = []
    fetched_icon_targets = []
    for _path, new_icon, icon_query in new_icon_assets:
        if icon_query in old_icon_urls:
            _set_asset_url(
                new_icon,
                "icon",
                old_icon_urls[icon_query],
                template=use_template_asset_fields,
            )
            continue
        async_icon_fetch_tasks.append(
            ICON_FINDER_SERVICE.search_icons(
                icon_query,
                weight=resolved_icon_weight,
            )
        )
        fetched_icon_targets.append(new_icon)

    new_images = await asyncio.gather(
        *async_image_fetch_tasks,
        return_exceptions=allow_image_fallback,
    )
    new_icons = await asyncio.gather(*async_icon_fetch_tasks)

    # list of new assets
    new_assets = []

    # Sets new image and icon urls for assets that were fetched
    for target, fetched_image in zip(fetched_image_targets, new_images):
        if isinstance(fetched_image, BaseException):
            if not allow_image_fallback:
                raise fetched_image
            image_url = normalize_slide_asset_url("/static/images/placeholder.jpg")
            if image_warnings is not None and isinstance(fetched_image, Exception):
                image_warnings.append(image_generation_warning(fetched_image))
        elif isinstance(fetched_image, ImageAsset):
            new_assets.append(fetched_image)
            image_url = filesystem_image_path_to_app_data_url(fetched_image.path)
        else:
            image_url = normalize_slide_asset_url(fetched_image)
        _set_asset_url(
            target,
            "image",
            image_url,
            template=use_template_asset_fields,
        )

    for target, icon_result in zip(fetched_icon_targets, new_icons):
        if icon_result:
            icon_url = normalize_slide_asset_url(icon_result[0])
        else:
            icon_url = normalize_slide_asset_url("/static/icons/placeholder.svg")
        _set_asset_url(
            target,
            "icon",
            icon_url,
            template=use_template_asset_fields,
        )

    for path, asset, _prompt in new_image_assets:
        set_dict_at_path(new_slide_content, path, asset)
    for path, asset, _query in new_icon_assets:
        set_dict_at_path(new_slide_content, path, asset)

    return new_assets


def process_slide_add_placeholder_assets(slide: SlideModel):

    template = _uses_template_asset_fields(slide)
    image_paths = _dict_paths_with_any_key(slide.content, IMAGE_PROMPT_KEYS)
    icon_paths = _dict_paths_with_any_key(slide.content, ICON_QUERY_KEYS)

    for image_path in image_paths:
        image_dict = get_dict_at_path(slide.content, image_path)
        # Use FastAPI static path for placeholder image
        _set_asset_url(
            image_dict,
            "image",
            normalize_slide_asset_url("/static/images/placeholder.jpg"),
            template=template,
        )
        set_dict_at_path(slide.content, image_path, image_dict)

    for icon_path in icon_paths:
        icon_dict = get_dict_at_path(slide.content, icon_path)
        # Use FastAPI static path for placeholder icon
        _set_asset_url(
            icon_dict,
            "icon",
            normalize_slide_asset_url("/static/icons/placeholder.svg"),
            template=template,
        )
        set_dict_at_path(slide.content, icon_path, icon_dict)
