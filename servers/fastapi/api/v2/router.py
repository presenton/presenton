from fastapi import APIRouter

from api.v2.ppt.router import API_V2_PPT_ROUTER


API_V2_ROUTER = APIRouter(prefix="/api/v2")
API_V2_ROUTER.include_router(API_V2_PPT_ROUTER)
