from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.auth.users import get_current_admin
from models.sql.access_token import AccessToken
from models.sql.user import User
from services.database import get_async_session


TOKEN_ROUTER = APIRouter(prefix="/token", tags=["API Keys"])


@TOKEN_ROUTER.get("/list", response_model=list[AccessToken])
async def list_tokens(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    return list(
        (
            await session.scalars(
                select(AccessToken)
                .where(AccessToken.user_id == admin.id)
                .order_by(AccessToken.created_at.desc())
            )
        ).all()
    )


@TOKEN_ROUTER.post("/create", response_model=AccessToken)
async def create_token(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    token = AccessToken(user_id=admin.id)
    session.add(token)
    await session.commit()
    await session.refresh(token)
    return token


@TOKEN_ROUTER.post("/revoke")
async def revoke_token(
    token: Annotated[str, Body(embed=True)],
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_async_session),
):
    access_token = await session.get(AccessToken, token)
    if access_token is None or access_token.user_id != admin.id:
        raise HTTPException(status_code=404, detail="Token not found")
    await session.delete(access_token)
    await session.commit()
    return {"message": "Token revoked"}
