from fastapi import APIRouter, HTTPException
import aiohttp
import os
from typing import List, Any
from utils.get_layout_by_name import get_layout_by_name
from models.presentation_layout import PresentationLayoutModel

LAYOUTS_ROUTER = APIRouter(prefix="/layouts", tags=["Layouts"])

@LAYOUTS_ROUTER.get("/", summary="Get available layouts")
async def get_layouts():
    nextjs_url = os.getenv("NEXTJS_URL", "http://localhost:3000")
    url = f"{nextjs_url}/api/layouts"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status != 200:
                error_text = await response.text()
                raise HTTPException(
                    status_code=response.status,
                    detail=f"Failed to fetch layouts: {error_text}"
                )
            layouts_json = await response.json()
    # Optionally, parse into a Pydantic model if you have one matching the structure
    return layouts_json


@LAYOUTS_ROUTER.get("/{layout_name}", summary="Get layout details by ID")
async def get_layout_detail(layout_name: str) -> PresentationLayoutModel:
    return await get_layout_by_name(layout_name)
