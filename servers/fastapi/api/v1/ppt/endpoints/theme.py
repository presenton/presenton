import copy
import uuid
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.image_asset import ImageAsset
from models.sql.key_value import KeyValueSqlModel
from services.database import get_async_session

THEMES_ROUTER = APIRouter(prefix="/themes", tags=["Themes"])
THEMES_STORAGE_KEY = "presentation_custom_themes"


class ThemeRequest(BaseModel):
    name: str
    description: str
    company_name: Optional[str] = None
    logo: Optional[str] = None
    logo_url: Optional[str] = None
    data: dict[str, Any] = Field(default_factory=dict)


class ThemeUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    company_name: Optional[str] = None
    logo: Optional[str] = None
    logo_url: Optional[str] = None
    data: Optional[dict[str, Any]] = None


class ThemeResponse(BaseModel):
    id: str
    name: str
    description: str
    user: str
    logo: Optional[str] = None
    logo_url: Optional[str] = None
    company_name: Optional[str] = None
    data: dict[str, Any]


def _normalize_theme(theme: dict[str, Any]) -> ThemeResponse:
    return ThemeResponse(
        id=str(theme["id"]),
        name=theme["name"],
        description=theme["description"],
        user=theme.get("user", "local"),
        logo=theme.get("logo"),
        logo_url=theme.get("logo_url"),
        company_name=theme.get("company_name"),
        data=theme.get("data", {}),
    )


async def _get_themes_row(sql_session: AsyncSession) -> Optional[KeyValueSqlModel]:
    return await sql_session.scalar(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == THEMES_STORAGE_KEY)
    )


def _read_themes_from_row(row: Optional[KeyValueSqlModel]) -> list[dict[str, Any]]:
    if not row:
        return []
    value = row.value if isinstance(row.value, dict) else {}
    themes = value.get("themes", [])
    if not isinstance(themes, list):
        return []
    return copy.deepcopy(themes)


async def _resolve_logo_url(
    sql_session: AsyncSession, logo: Optional[str]
) -> Optional[str]:
    if not logo:
        return None
    try:
        logo_uuid = uuid.UUID(str(logo))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid logo id") from exc

    image_asset = await sql_session.get(ImageAsset, logo_uuid)
    if not image_asset:
        raise HTTPException(status_code=404, detail="Logo not found")
    return image_asset.path


@THEMES_ROUTER.get("/default", response_model=List[dict[str, Any]])
async def get_default_themes():
    # Built-in themes are provided by Next.js constants in this project.
    return []


@THEMES_ROUTER.get("/all", response_model=List[ThemeResponse])
async def get_themes(sql_session: AsyncSession = Depends(get_async_session)):
    row = await _get_themes_row(sql_session)
    themes = _read_themes_from_row(row)
    return [_normalize_theme(theme) for theme in themes]


@THEMES_ROUTER.post("/create", response_model=ThemeResponse)
async def create_theme(
    payload: ThemeRequest, sql_session: AsyncSession = Depends(get_async_session)
):
    row = await _get_themes_row(sql_session)
    themes = _read_themes_from_row(row)
    logo_url = payload.logo_url or await _resolve_logo_url(sql_session, payload.logo)

    theme = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "description": payload.description,
        "user": "local",
        "logo": payload.logo,
        "logo_url": logo_url,
        "company_name": payload.company_name,
        "data": payload.data,
    }
    themes.append(theme)

    if row:
        row.value = {"themes": themes}
        sql_session.add(row)
    else:
        sql_session.add(KeyValueSqlModel(key=THEMES_STORAGE_KEY, value={"themes": themes}))

    await sql_session.commit()
    return _normalize_theme(theme)


@THEMES_ROUTER.patch("/update/{theme_id}", response_model=ThemeResponse)
async def update_theme(
    theme_id: str,
    payload: ThemeUpdateRequest,
    sql_session: AsyncSession = Depends(get_async_session),
):
    row = await _get_themes_row(sql_session)
    if not row:
        raise HTTPException(status_code=404, detail="Theme not found")

    themes = _read_themes_from_row(row)
    theme = next((item for item in themes if item.get("id") == theme_id), None)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    if payload.name is not None:
        theme["name"] = payload.name
    if payload.description is not None:
        theme["description"] = payload.description
    if payload.company_name is not None:
        theme["company_name"] = payload.company_name
    if payload.data is not None:
        theme["data"] = payload.data
    if payload.logo is not None:
        theme["logo"] = payload.logo
        theme["logo_url"] = await _resolve_logo_url(sql_session, payload.logo)
    elif payload.logo_url is not None:
        theme["logo_url"] = payload.logo_url

    row.value = {"themes": themes}
    sql_session.add(row)
    await sql_session.commit()
    return _normalize_theme(theme)


@THEMES_ROUTER.delete("/delete/{theme_id}", status_code=204)
async def delete_theme(
    theme_id: str, sql_session: AsyncSession = Depends(get_async_session)
):
    row = await _get_themes_row(sql_session)
    if not row:
        return

    themes = _read_themes_from_row(row)
    row.value = {"themes": [theme for theme in themes if theme.get("id") != theme_id]}
    sql_session.add(row)
    await sql_session.commit()
