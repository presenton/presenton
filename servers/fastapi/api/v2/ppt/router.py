from fastapi import APIRouter

from api.v2.ppt.endpoints.presentation import PRESENTATION_V2_ROUTER


API_V2_PPT_ROUTER = APIRouter(prefix="/ppt")
API_V2_PPT_ROUTER.include_router(PRESENTATION_V2_ROUTER)
