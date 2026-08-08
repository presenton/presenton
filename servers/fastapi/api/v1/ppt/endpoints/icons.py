from typing import List

from fastapi import APIRouter, Query
from services.icon_finder_service import ICON_FINDER_SERVICE
from utils.icon_weights import DEFAULT_ICON_TYPE, normalize_icon_type

ICONS_ROUTER = APIRouter(prefix="/icons", tags=["Icons"])


@ICONS_ROUTER.get("/search", response_model=List[str])
async def search_icons(
    query: str,
    limit: int = 20,
    icon_type: str | None = Query(default=None),
    icon_weight: str | None = Query(default=None),
):
    return await ICON_FINDER_SERVICE.search_icons(
        query,
        limit,
        weight=normalize_icon_type(icon_type or icon_weight or DEFAULT_ICON_TYPE),
    )
