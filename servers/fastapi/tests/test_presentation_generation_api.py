from unittest.mock import patch, AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from models.presentation_layout import PresentationLayoutModel
from models.presentation_structure_model import PresentationStructureModel
from api.v1.ppt.endpoints.presentation import PRESENTATION_ROUTER

class MockAiohttpResponse:
    def __init__(self, status=200, json_data=None):
        self.status = status
        self._json_data = json_data or {"path": "/tmp/exports/test.pdf"}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def json(self):
        return self._json_data

    async def text(self):
        return str(self._json_data)

class MockAiohttpSession:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    def post(self, *args, **kwargs):
        return MockAiohttpResponse()

    def get(self, *args, **kwargs):
        pptx_model_data = {
            "slides": [],
            "title": "Test",
            "notes": [],
            "layout": {},
            "structure": {},
        }
        return MockAiohttpResponse(json_data=pptx_model_data)

@pytest.fixture
def app():
    app = FastAPI()
    app.include_router(PRESENTATION_ROUTER, prefix="/api/v1/ppt")
    return app

@pytest.fixture
def client(app):
    return TestClient(app)

@pytest.fixture
def mock_get_layout():
    async def _mock_get_layout_by_name(layout_name: str):
        mock_slide = MagicMock()
        mock_slide.name = "Mock Slide"
        mock_slide.json_schema = {"title": "Mock Slide Title"}
        mock_slide.description = "Mock slide description"
        mock_layout = MagicMock(spec=PresentationLayoutModel)
        mock_layout.name = layout_name
        mock_layout.ordered = True
        mock_layout.slides = [mock_slide]
        mock_layout.model_dump = lambda: {}
        mock_layout.to_presentation_structure = lambda: PresentationStructureModel(
            slides=[index for index in range(len(mock_layout.slides))]
        )
        def to_string():
            message = f"## Presentation Layout\n\n"
            for index, slide in enumerate(mock_layout.slides):
                message += f"### Slide Layout: {index}: \n"
                message += f"- Name: {slide.name or slide.json_schema.get('title')} \n"
                message += f"- Description: {slide.description} \n\n"
            return message
        mock_layout.to_string = to_string
        return mock_layout
    return _mock_get_layout_by_name

async def mock_generate_ppt_outline(*args, **kwargs):
    yield '{"title": "Test", "slides": [{"title": "Slide 1", "body": "Body 1"}], "notes": []}'

@pytest.fixture(autouse=True)
def patch_presentation_api(monkeypatch, mock_get_layout):
    # Patch all dependencies used in the API
    patches = [
        patch('api.v1.ppt.endpoints.presentation.get_layout_by_name', new=AsyncMock(side_effect=mock_get_layout)),
        patch('api.v1.ppt.endpoints.presentation.TEMP_FILE_SERVICE.create_temp_dir', return_value='/tmp/mockdir'),
        patch('api.v1.ppt.endpoints.presentation.DocumentsLoader'),
        patch('api.v1.ppt.endpoints.presentation.generate_document_summary', new_callable=AsyncMock, return_value="mock_summary"),
        patch('api.v1.ppt.endpoints.presentation.generate_ppt_outline', side_effect=mock_generate_ppt_outline),
        patch('api.v1.ppt.endpoints.presentation.get_sql_session'),
        patch('api.v1.ppt.endpoints.presentation.get_slide_content_from_type_and_outline', new_callable=AsyncMock, return_value={"mock": "slide_content"}),
        patch('api.v1.ppt.endpoints.presentation.process_slide_and_fetch_assets', new_callable=AsyncMock),
        patch('api.v1.ppt.endpoints.presentation.get_exports_directory', return_value='/tmp/exports'),
        patch('api.v1.ppt.endpoints.presentation.PptxPresentationCreator'),
        patch('api.v1.ppt.endpoints.presentation.aiohttp.ClientSession', return_value=MockAiohttpSession()),
    ]
    mocks = [p.start() for p in patches]

    # Setup DocumentsLoader mock
    docs_loader = mocks[2]
    docs_loader.return_value.load_documents = AsyncMock()
    docs_loader.return_value.documents = []

    # Setup PptxPresentationCreator mock for pptx test
    pptx_creator = mocks[9]
    pptx_creator.return_value.create_ppt = AsyncMock()
    pptx_creator.return_value.save = MagicMock()

    yield

    for p in patches:
        p.stop()

class TestPresentationGenerationAPI:
    def test_generate_presentation_export_as_pdf(self, client):
        response = client.post(
            "/api/v1/ppt/presentation/generate",
            json={
                "content": "Create a presentation about artificial intelligence and machine learning",
                "n_slides": 5,
                "language": "English",
                "export_as": "pdf",
                "layout": "general"
            }
        )
        assert response.status_code == 200
        assert "presentation_id" in response.json()
        assert "pdf" in response.json()["path"]

    def test_generate_presentation_export_as_pptx(self, client):
        response = client.post(
            "/api/v1/ppt/presentation/generate",
            json={
                "content": "Create a presentation about artificial intelligence and machine learning",
                "n_slides": 5,
                "language": "English",
                "export_as": "pptx",
                "layout": "general"
            }
        )
        assert response.status_code == 200
        assert "presentation_id" in response.json()
        assert "pptx" in response.json()["path"]

    def test_generate_presentation_with_no_content(self, client):
        response = client.post(
            "/api/v1/ppt/presentation/generate",
            json={
                "n_slides": 5,
                "language": "English",
                "export_as": "pdf",
                "layout": "general"
            }
        )
        assert response.status_code == 422


    def test_generate_presentation_with_n_slides_less_than_one(self, client):
        response = client.post(
            "/api/v1/ppt/presentation/generate",
            json={
                "content": "Create a presentation about artificial intelligence and machine learning",
                "n_slides": 0,
                "language": "English",
                "export_as": "pdf",
                "layout": "general"
            }
        )
        assert response.status_code == 422

    def test_generate_presentation_with_invalid_export_type(self, client):
        response = client.post(
            "/api/v1/ppt/presentation/generate",
            json={
                "content": "Create a presentation about artificial intelligence and machine learning",
                "n_slides": 5,
                "language": "English",
                "export_as": "invalid_type",
                "layout": "general"
            }
        )
        assert response.status_code == 422
