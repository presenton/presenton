from fastapi import Request
from sqlalchemy import func, select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from api.v1.auth.assets import is_app_data_path_authorized
from api.v1.auth.principal import resolve_request_principal
from api.v1.auth.context import (
    reset_current_owner_id,
    reset_current_owner_is_admin,
    set_current_owner_id,
    set_current_owner_is_admin,
)
from api.v1.auth.users import get_jwt_strategy
from models.sql.user import User
from services.database import async_session_maker
from utils.get_env import get_can_change_keys_env, is_disable_auth_enabled
from utils.user_config import update_env_with_user_config


class UserConfigEnvUpdateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if get_can_change_keys_env() != "false":
            update_env_with_user_config()
        return await call_next(request)


class SessionAuthMiddleware(BaseHTTPMiddleware):
    _PUBLIC_AUTH_PATHS = {
        "/api/v1/auth/status",
        "/api/v1/auth/verify",
        "/api/v1/auth/setup",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
    }
    _PUBLIC_APP_DATA_PREFIXES = (
        "/app_data/fonts/",
        "/app_data/templates/",
    )
    _PROTECTED_NON_API_PATHS = {"/docs", "/openapi.json", "/redoc"}

    def _requires_auth(self, path: str) -> bool:
        if path.startswith("/api/"):
            return True
        if any(path.startswith(prefix) for prefix in self._PUBLIC_APP_DATA_PREFIXES):
            return False
        if path.startswith("/app_data/"):
            return True
        return path in self._PROTECTED_NON_API_PATHS

    async def dispatch(self, request: Request, call_next):
        if is_disable_auth_enabled():
            return await call_next(request)

        path = request.url.path
        if (
            request.method == "OPTIONS"
            or not self._requires_auth(path)
            or path in self._PUBLIC_AUTH_PATHS
        ):
            return await call_next(request)

        async with async_session_maker() as session:
            configured = bool(
                await session.scalar(select(func.count()).select_from(User))
            )
            if not configured:
                return JSONResponse(
                    status_code=428,
                    content={
                        "detail": "Login setup is required",
                        "setup_required": True,
                    },
                )
            principal, user = await resolve_request_principal(request, session)
            if principal is None:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Unauthorized"},
                )
            admin_only = (
                path.startswith("/api/v1/admin/")
                or path.startswith("/api/v1/auth/token/")
                or path.startswith("/api/v1/ppt/codex/auth/")
                or (
                    path.startswith("/api/v1/ppt/fonts/")
                    and request.method in {"POST", "DELETE"}
                )
                or (
                    path == "/api/v1/ppt/ollama/models/pull"
                    and request.method == "POST"
                )
            )
            if admin_only and (
                principal.method != "jwt" or not principal.is_admin
            ):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Admin browser session required"},
                )
            if path.startswith("/app_data/") and not is_app_data_path_authorized(
                path,
                user_id=principal.user_id,
                is_admin=principal.is_admin,
            ):
                return JSONResponse(
                    status_code=404,
                    content={"detail": "Asset not found"},
                )
            request.state.auth_principal = principal
            request.state.current_user = user
            request.state.auth_username = principal.username
            if principal.method == "api_key" and user is not None:
                request.state.internal_session_token = (
                    await get_jwt_strategy().write_token(user)
                )
            context_token = set_current_owner_id(principal.user_id)
            admin_context_token = set_current_owner_is_admin(principal.is_admin)
            try:
                return await call_next(request)
            finally:
                reset_current_owner_is_admin(admin_context_token)
                reset_current_owner_id(context_token)
