import aiohttp
from fastapi import HTTPException

from templates.presentation_layout import PresentationLayoutModel
from utils.simple_auth import (
    SESSION_COOKIE_NAME,
    create_session_token,
    get_configured_auth_username,
)


async def get_layout_by_name(layout_name: str) -> PresentationLayoutModel:
    url = f"http://localhost/api/template?group={layout_name}"
    headers = {}
    auth_username = get_configured_auth_username()
    if auth_username:
        internal_token = create_session_token(auth_username)
        headers["Cookie"] = f"{SESSION_COOKIE_NAME}={internal_token}"

    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as response:
            if response.status != 200:
                error_text = await response.text()
                raise HTTPException(
                    status_code=404,
                    detail=f"Template '{layout_name}' not found: {error_text}",
                )
            layout_json = await response.json()
    return PresentationLayoutModel(**layout_json)
