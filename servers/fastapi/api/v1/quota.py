from fastapi import APIRouter, Depends, HTTPException

from api.v1.auth.users import read_user_from_cookie
from models.sql.user import User
from services.database import get_async_session
from services.quota_service import QuotaStatus, quota_for_user
from utils.get_env import is_disable_auth_enabled

QUOTA_ROUTER = APIRouter(prefix="/api/v1/quota", tags=["Quota"])


@QUOTA_ROUTER.get("", response_model=QuotaStatus)
async def read_quota(
    sql_session=Depends(get_async_session),
    user: User | None = Depends(read_user_from_cookie),
):
    """Остаток квоты генерации для текущего пользователя (P4)."""
    if is_disable_auth_enabled():
        # Однопользовательский режим — без лимитов.
        return QuotaStatus(limit=0, used=0, remaining=None, period_hours=24, resets_in_seconds=None)
    if user is None:
        # На практике до сюда не дойдёт — SessionAuthMiddleware отдаст 401 раньше.
        raise HTTPException(status_code=401, detail="Authentication required")
    return await quota_for_user(sql_session, user)
