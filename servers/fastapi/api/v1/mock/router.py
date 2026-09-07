import uuid

from fastapi import APIRouter

from models.api_error_model import APIErrorModel
from models.presentation_and_path import PresentationPathAndEditPath
from utils.asset_directory_utils import absolute_fastapi_asset_url

API_V1_MOCK_ROUTER = APIRouter(prefix="/api/v1/mock", tags=["Mock"])


@API_V1_MOCK_ROUTER.get(
    "/presentation-generation-completed",
    response_model=list[PresentationPathAndEditPath],
)
async def mock_presentation_generation_completed():
    return [
        PresentationPathAndEditPath(
            presentation_id=uuid.uuid4(),
            path=absolute_fastapi_asset_url("/app_data/exports/test.pdf"),
            edit_path="/presentation?id=123",
        )
    ]


@API_V1_MOCK_ROUTER.get(
    "/presentation-generation-failed",
    response_model=list[APIErrorModel],
)
async def mock_presentation_generation_failed():
    return [
        APIErrorModel(
            status_code=500,
            detail="Presentation generation failed",
        )
    ]
