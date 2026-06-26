from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from utils.simple_auth import (
    clear_session_cookie,
    create_session_token,
    get_auth_status,
    get_basic_auth_credentials_from_request,
    get_session_token_from_request,
    is_auth_configured,
    set_session_cookie,
    setup_initial_credentials,
    verify_credentials,
)
from utils.get_env import is_disable_auth_enabled

API_V1_AUTH_ROUTER = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class AuthCredentialsRequest(BaseModel):
    username: str = Field(min_length=3, max_length=128)
    password: str = Field(min_length=6, max_length=256)


@API_V1_AUTH_ROUTER.get("/status")
async def get_status(request: Request):
    if is_disable_auth_enabled():
        return {"configured": True, "authenticated": True, "username": "electron"}
    token = get_session_token_from_request(request)
    return get_auth_status(token)


@API_V1_AUTH_ROUTER.get("/verify")
async def verify_session(request: Request):
    if is_disable_auth_enabled():
        return {"authenticated": True, "username": "electron"}

    auth_status = get_auth_status(get_session_token_from_request(request))
    if not auth_status["configured"]:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not auth_status["authenticated"]:
        basic_credentials = get_basic_auth_credentials_from_request(request)
        if basic_credentials and verify_credentials(
            basic_credentials[0], basic_credentials[1]
        ):
            return {
                "authenticated": True,
                "username": basic_credentials[0].strip(),
            }
        raise HTTPException(status_code=401, detail="Unauthorized")

    return {
        "authenticated": True,
        "username": auth_status.get("username"),
    }


@API_V1_AUTH_ROUTER.post("/setup")
async def setup_credentials(body: AuthCredentialsRequest, request: Request):
    if is_auth_configured():
        raise HTTPException(status_code=409, detail="Credentials already configured")

    try:
        setup_initial_credentials(body.username, body.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    username = body.username.strip()
    return JSONResponse(
        {
            "configured": True,
            "authenticated": False,
            "username": username,
        }
    )


@API_V1_AUTH_ROUTER.post("/login")
async def login(body: AuthCredentialsRequest, request: Request):
    if not is_auth_configured():
        raise HTTPException(status_code=428, detail="Login setup is required")

    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Unauthorized")

    username = body.username.strip()
    token = create_session_token(username)
    response = JSONResponse(
        {
            "configured": True,
            "authenticated": True,
            "username": username,
            "access_token": token,
            "token_type": "bearer",
        }
    )
    set_session_cookie(response, token, request)
    return response


@API_V1_AUTH_ROUTER.post("/logout")
async def logout(request: Request):
    response = JSONResponse({"success": True})
    clear_session_cookie(response, request)
    return response
