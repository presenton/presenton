from api.v1.auth.config import SESSION_COOKIE_NAME
from api.v1.auth.context import get_current_owner_id
from api.v1.auth.users import get_jwt_strategy
from models.sql.user import User
from services.database import async_session_maker
from utils.get_env import is_disable_auth_enabled


async def authenticated_internal_request_headers() -> dict[str, str]:
    """Issue a database-backed JWT for the current trusted internal request."""
    if is_disable_auth_enabled():
        return {}

    owner_id = get_current_owner_id()
    if owner_id is None:
        return {}

    async with async_session_maker() as session:
        user = await session.get(User, owner_id)
        if user is None or not user.is_active:
            return {}
        token = await get_jwt_strategy().write_token(user)
    return {"Cookie": f"{SESSION_COOKIE_NAME}={token}"}
