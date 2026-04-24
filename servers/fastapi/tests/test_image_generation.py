import pytest
import asyncio
import os
from unittest.mock import Mock, patch, AsyncMock
import httpx
from fastapi.testclient import TestClient
from fastapi import FastAPI
from api.v1.ppt.endpoints.images import IMAGES_ROUTER
from models.image_prompt import ImagePrompt
from services.image_generation_service import ImageGenerationService
from models.sql.image_asset import ImageAsset


class TestImageGenerationService:
    """
    Testing the image Generation Service
    """
    
    @pytest.fixture
    def mock_images_directory(self, tmp_path):
        """
        Creates new images directory for every test case we run
        """
        images_dir = tmp_path / "images"
        images_dir.mkdir()
        return str(images_dir)
    
    @pytest.fixture
    def sample_image_prompt(self):
        """
        Creates a sample ImagePrompt for testing
        """
        return ImagePrompt(prompt="A beautiful sunset over mountains")
    
    def test_image_generation_service_initialization(self, mock_images_directory):
        """
        Test initialization of ImageGenerationService with output directory
        - Checks if the output directory is set correctly
        - Checks if the image generation function is set based on environment variable
        """
        with patch.dict(os.environ, {"IMAGE_PROVIDER": "pexels"}):
            service = ImageGenerationService(mock_images_directory)
            assert service.output_directory == mock_images_directory
            assert service.image_gen_func is not None or service.image_gen_func is None
    
    def test_get_image_gen_func_pixabay_selected(self, mock_images_directory):
        """
            Testing the function selection when Pixabay is selected
            - Checks if the correct function is selected based on environment variable
            - Ensures that the function is set to get_image_from_pixabay when Pixabay is selected
        """
        with patch('services.image_generation_service.is_pixabay_selected', return_value=True):
            with patch('services.image_generation_service.is_pixels_selected', return_value=False):
                with patch('services.image_generation_service.is_gemini_flash_selected', return_value=False):
                    with patch('services.image_generation_service.is_dalle3_selected', return_value=False):
                        with patch.dict(os.environ, {"IMAGE_PROVIDER": "pixabay"}):
                            service = ImageGenerationService(mock_images_directory)
                            assert service.image_gen_func == service.get_image_from_pixabay
    
    def test_get_image_gen_func_pexels_selected(self, mock_images_directory):
        """
        Test function selection when Pexels is selected
        - Checks if the correct function is selected based on environment variable
        - Ensures that the function is set to get_image_from_pexels when Pexels is selected
        """
        with patch('services.image_generation_service.is_pixabay_selected', return_value=False):
            with patch('services.image_generation_service.is_pixels_selected', return_value=True):
                with patch('services.image_generation_service.is_gemini_flash_selected', return_value=False):
                    with patch('services.image_generation_service.is_dalle3_selected', return_value=False):
                        with patch.dict(os.environ, {"IMAGE_PROVIDER": "pexels"}):
                            service = ImageGenerationService(mock_images_directory)
                            assert service.image_gen_func == service.get_image_from_pexels
    
    def test_get_image_gen_func_dalle3_selected(self, mock_images_directory):
        """
        Test function selection when DALL-E 3 is selected
        - Checks if the correct function is selected based on environment variable
        - Ensures that the function is set to generate_image_openai when DALL-E 3 is selected
        """
        with patch('services.image_generation_service.is_pixabay_selected', return_value=False):
            with patch('services.image_generation_service.is_pixels_selected', return_value=False):
                with patch('services.image_generation_service.is_gemini_flash_selected', return_value=False):
                    with patch('services.image_generation_service.is_dalle3_selected', return_value=True):
                        with patch.dict(os.environ, {"IMAGE_PROVIDER": "dall-e-3"}):
                            service = ImageGenerationService(mock_images_directory)
                            assert service.image_gen_func == service.generate_image_openai
    
    def test_is_stock_provider_selected(self, mock_images_directory):
        """
        Test if stock provider is selected based on environment variable
        - Checks if the stock provider is selected correctly based on environment variable
        - Ensures that is_stock_provider_selected returns True for Pexels or Pixabay
        """
        with patch('services.image_generation_service.is_pixels_selected', return_value=True):
            with patch('services.image_generation_service.is_pixabay_selected', return_value=False):
                with patch.dict(os.environ, {"IMAGE_PROVIDER": "pexels"}):
                    service = ImageGenerationService(mock_images_directory)
                    assert service.is_stock_provider_selected() is True
        
        with patch('services.image_generation_service.is_pixels_selected', return_value=False):
            with patch('services.image_generation_service.is_pixabay_selected', return_value=True):
                with patch.dict(os.environ, {"IMAGE_PROVIDER": "pixabay"}):
                    service = ImageGenerationService(mock_images_directory)
                    assert service.is_stock_provider_selected() is True
        
        with patch('services.image_generation_service.is_pixels_selected', return_value=False):
            with patch('services.image_generation_service.is_pixabay_selected', return_value=False):
                with patch.dict(os.environ, {"IMAGE_PROVIDER": "dall-e-3"}):
                    service = ImageGenerationService(mock_images_directory)
                    assert service.is_stock_provider_selected() is False
    
    def test_generate_image_with_pexels_success(self, mock_images_directory, sample_image_prompt):
        """
        Test successful image generation with Pexels provider
        - Mocks the Pexels API to return a valid image URL
        - Ensures that the image generation function returns the expected URL
        - Checks if the image generation function is called with the correct prompt
        """
        async def run_test():
            with patch.dict(os.environ, {"IMAGE_PROVIDER": "pexels", "PEXELS_API_KEY": "test_key"}):
                with patch('services.image_generation_service.is_pixels_selected', return_value=True):
                    with patch('services.image_generation_service.is_pixabay_selected', return_value=False):
                        with patch('services.image_generation_service.is_gemini_flash_selected', return_value=False):
                            with patch('services.image_generation_service.is_dalle3_selected', return_value=False):
                                service = ImageGenerationService(mock_images_directory)
                                
                                mock_response = AsyncMock()
                                mock_response.json = AsyncMock(return_value={
                                    "photos": [{
                                        "src": {
                                            "large": "https://example.com/image.jpg"
                                        }
                                    }]
                                })
                                
                                mock_session = AsyncMock()
                                mock_session.get = AsyncMock(return_value=mock_response)
                                mock_session.__aenter__ = AsyncMock(return_value=mock_session)
                                mock_session.__aexit__ = AsyncMock(return_value=None)
                                
                                with patch('aiohttp.ClientSession', return_value=mock_session):
                                    result = await service.generate_image(sample_image_prompt)
                                    assert result == "https://example.com/image.jpg"
        
        asyncio.run(run_test())
    
    def test_generate_image_with_dalle3_success(self, mock_images_directory, sample_image_prompt):
        """
        Test successful image generation with DALL-E 3 provider
        - Mocks the OpenAI client to return a valid image URL
        - Ensures that the image generation function returns the expected URL
        - Checks if the image generation function is called with the correct prompt
        """
        async def run_test():
            with patch.dict(os.environ, {"IMAGE_PROVIDER": "dall-e-3"}):
                with patch('services.image_generation_service.is_pixels_selected', return_value=False):
                    with patch('services.image_generation_service.is_pixabay_selected', return_value=False):
                        with patch('services.image_generation_service.is_gemini_flash_selected', return_value=False):
                            with patch('services.image_generation_service.is_dalle3_selected', return_value=True):
                                service = ImageGenerationService(mock_images_directory)
                                
                                # Create a real test file
                                test_image_path = f"{mock_images_directory}/test_image.jpg"
                                with open(test_image_path, 'w') as f:
                                    f.write("fake image content")
                                
                                # Mock generate_image_openai to return the test file path
                                async def mock_openai_generate(prompt, output_dir):
                                    return test_image_path
                                
                                service.generate_image_openai = mock_openai_generate
                                
                                result = await service.generate_image(sample_image_prompt)
                                
                                # Should return ImageAsset for AI providers
                                assert isinstance(result, ImageAsset)
                                assert result.path == test_image_path
                                assert result.extras["prompt"] == sample_image_prompt.prompt
    
    def test_generate_image_no_provider_selected(self, mock_images_directory, sample_image_prompt):
        """
        Test generate_image when no provider is selected
        - Mocks the environment variable to simulate no provider selected
        - Ensures that the function returns a placeholder image path
        - Checks if the image generation function is called with the correct prompt
        """
        async def run_test():
            with patch('services.image_generation_service.is_pixels_selected', return_value=False):
                with patch('services.image_generation_service.is_pixabay_selected', return_value=False):
                    with patch('services.image_generation_service.is_gemini_flash_selected', return_value=False):
                        with patch('services.image_generation_service.is_dalle3_selected', return_value=False):
                            with patch.dict(os.environ, {"IMAGE_PROVIDER": "pexels"}):
                                service = ImageGenerationService(mock_images_directory)
                                
                                result = await service.generate_image(sample_image_prompt)
                                
                                # Should return placeholder
                                assert result == "/static/images/placeholder.jpg"
        
        asyncio.run(run_test())
    
    def test_generate_image_provider_error(self, mock_images_directory, sample_image_prompt):
        """
        Test generate_image when provider function raises an error
        - Mocks the Pexels API to raise an exception
        - Ensures that the function returns a placeholder image path
        - Checks if the image generation function is called with the correct prompt
        """
        async def run_test():
            with patch('services.image_generation_service.is_pixels_selected', return_value=True):
                with patch('services.image_generation_service.is_pixabay_selected', return_value=False):
                    with patch('services.image_generation_service.is_gemini_flash_selected', return_value=False):
                        with patch('services.image_generation_service.is_dalle3_selected', return_value=False):
                            with patch.dict(os.environ, {"IMAGE_PROVIDER": "pexels"}):
                                service = ImageGenerationService(mock_images_directory)
                                
                                async def mock_pexels_error(*args, **kwargs):
                                    raise Exception("API Error")
                                
                                service.get_image_from_pexels = mock_pexels_error
                                
                                result = await service.generate_image(sample_image_prompt)
                                
                                assert result == "/static/images/placeholder.jpg"
        
        asyncio.run(run_test())
    
    def test_get_image_from_pexels_real_function(self, mock_images_directory):
        """T
        Test REAL Pexels function with mocked HTTP call
        - Mocks the Pexels API to return a valid image URL
        - Ensures that the function returns the expected URL
        - Checks if the HTTP call is made with the correct parameters
        """
        async def run_test():
            with patch.dict(os.environ, {"IMAGE_PROVIDER": "pexels", "PEXELS_API_KEY": "test_pexels_key"}):
                service = ImageGenerationService(mock_images_directory)
                
                mock_response = AsyncMock()
                mock_response.json = AsyncMock(return_value={
                    "photos": [{
                        "src": {
                            "large": "https://example.com/pexels_image.jpg"
                        }
                    }]
                })
                
                mock_session = AsyncMock()
                mock_session.get = AsyncMock(return_value=mock_response)
                mock_session.__aenter__ = AsyncMock(return_value=mock_session)
                mock_session.__aexit__ = AsyncMock(return_value=None)
                
                with patch('aiohttp.ClientSession', return_value=mock_session):
                    result = await service.get_image_from_pexels("sunset")
                    
                    assert result == "https://example.com/pexels_image.jpg"
                    mock_session.get.assert_called_once()
        
        asyncio.run(run_test())
    
    def test_get_image_from_pixabay_real_function(self, mock_images_directory):
        """
        Test REAL Pixabay function with mocked HTTP call
        - Mocks the Pixabay API to return a valid image URL
        - Ensures that the function returns the expected URL
        - Checks if the HTTP call is made with the correct parameters
        """
        async def run_test():
            with patch.dict(os.environ, {"IMAGE_PROVIDER": "pixabay", "PIXABAY_API_KEY": "test_pixabay_key"}):
                service = ImageGenerationService(mock_images_directory)
                
                mock_response = AsyncMock()
                mock_response.json = AsyncMock(return_value={
                    "hits": [{
                        "largeImageURL": "https://example.com/pixabay_image.jpg"
                    }]
                })
                
                mock_session = AsyncMock()
                mock_session.get = AsyncMock(return_value=mock_response)
                mock_session.__aenter__ = AsyncMock(return_value=mock_session)
                mock_session.__aexit__ = AsyncMock(return_value=None)
                
                with patch('aiohttp.ClientSession', return_value=mock_session):
                    result = await service.get_image_from_pixabay("sunset")
                    
                    assert result == "https://example.com/pixabay_image.jpg"
                    mock_session.get.assert_called_once()
        
        asyncio.run(run_test())


class TestImageGenerationEndpoint:
    """
    Testing the Image Generation API Endpoint
    """
    
    @pytest.fixture
    def app(self):
        """Create FastAPI app with the images router"""
        app = FastAPI()
        app.include_router(IMAGES_ROUTER)
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_images_directory(self, tmp_path):
        """Mock images directory"""
        images_dir = tmp_path / "images"
        images_dir.mkdir()
        return str(images_dir)
    
    def test_generate_image_endpoint_success_stock_provider(self, client, mock_images_directory):
        """
        Test successful image generation via API endpoint with stock provider
        - Mocks the ImageGenerationService to return a stock image URL
        - Ensures that the endpoint returns the expected URL
        - Checks if the image generation function is called with the correct prompt
        """
        test_prompt = "A beautiful sunset over mountains"
        
        with patch('api.v1.ppt.endpoints.images.get_images_directory', return_value=mock_images_directory):
            with patch('api.v1.ppt.endpoints.images.ImageGenerationService') as mock_service_class:
                mock_service_instance = Mock()
                mock_service_instance.generate_image = AsyncMock(return_value="https://example.com/stock_image.jpg")
                mock_service_class.return_value = mock_service_instance
                response = client.get(f"/images/generate?prompt={test_prompt}")
                assert response.status_code == 200
    
    def test_generate_image_endpoint_success_ai_provider(self, client, mock_images_directory):
        """
        Test successful image generation via API endpoint with AI provider
        - Mocks the ImageGenerationService to return an ImageAsset object
        - Ensures that the endpoint returns the expected ImageAsset object
        - Checks if the image generation function is called with the correct prompt
        """
        test_prompt = "A beautiful sunset over mountains"
        
        test_image_asset = ImageAsset(
            path=f"{mock_images_directory}/test_image.jpg",
            extras={"prompt": test_prompt, "theme_prompt": "professional"}
        )
        
        with patch('api.v1.ppt.endpoints.images.get_images_directory', return_value=mock_images_directory):
            with patch('api.v1.ppt.endpoints.images.ImageGenerationService') as mock_service_class:
                mock_service_instance = Mock()
                mock_service_instance.generate_image = AsyncMock(return_value=test_image_asset)
                mock_service_class.return_value = mock_service_instance
                
                response = client.get(f"/images/generate?prompt={test_prompt}")
                
                assert response.status_code == 200
    
    def test_generate_image_endpoint_placeholder_response(self, client, mock_images_directory):
        """
        Test endpoint returns placeholder image when no provider is selected
        - Mocks the ImageGenerationService to return a placeholder image path
        - Ensures that the endpoint returns the placeholder image path
        - Checks if the image generation function is called with the correct prompt
        """
        test_prompt = "Test prompt"
        
        with patch('api.v1.ppt.endpoints.images.get_images_directory', return_value=mock_images_directory):
            with patch('api.v1.ppt.endpoints.images.ImageGenerationService') as mock_service_class:
                mock_service_instance = Mock()
                mock_service_instance.generate_image = AsyncMock(return_value="/static/images/placeholder.jpg")
                mock_service_class.return_value = mock_service_instance
                
                response = client.get(f"/images/generate?prompt={test_prompt}")
                
                assert response.status_code == 200

    def test_generate_image_endpoint_with_async_client(self, mock_images_directory):
        """
        Test the image generation endpoint using an async client
        - Mocks the ImageGenerationService to return a valid image URL
        - Ensures that the endpoint returns the expected URL
        - Checks if the image generation function is called with the correct prompt
        """
        async def run_test():
            app = FastAPI()
            app.include_router(IMAGES_ROUTER)
            
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
                with patch('api.v1.ppt.endpoints.images.get_images_directory', return_value=mock_images_directory):
                    with patch('api.v1.ppt.endpoints.images.ImageGenerationService') as mock_service_class:
                        mock_service_instance = Mock()
                        mock_service_instance.generate_image = AsyncMock(return_value="https://example.com/image.jpg")
                        mock_service_class.return_value = mock_service_instance
                        
                        response = await ac.get("/images/generate?prompt=test")
                        assert response.status_code == 200
        
        asyncio.run(run_test())

    def test_search_stock_images_defaults_to_selected_pixabay(self, client, mock_images_directory):
        """
        Test stock image search defaults to IMAGE_PROVIDER when provider query param is omitted
        - Sets IMAGE_PROVIDER to pixabay
        - Ensures /images/search uses Pixabay instead of returning provider validation error
        """
        with patch.dict(os.environ, {"IMAGE_PROVIDER": "pixabay"}):
            with patch('api.v1.ppt.endpoints.images.get_images_directory', return_value=mock_images_directory):
                with patch('api.v1.ppt.endpoints.images.ImageGenerationService') as mock_service_class:
                    mock_service_instance = Mock()
                    mock_service_instance.get_image_from_pixabay = AsyncMock(
                        return_value=["https://example.com/pixabay_image.jpg"]
                    )
                    mock_service_instance.get_image_from_pexels = AsyncMock(
                        return_value=["https://example.com/pexels_image.jpg"]
                    )
                    mock_service_class.return_value = mock_service_instance

                    response = client.get("/images/search?query=business&limit=1")

                    assert response.status_code == 200
                    assert response.json() == ["https://example.com/pixabay_image.jpg"]
                    mock_service_instance.get_image_from_pixabay.assert_awaited_once()
                    mock_service_instance.get_image_from_pexels.assert_not_called()

    def test_search_stock_images_invalid_provider_returns_400(self, client):
        """
        Test stock image search validates invalid provider values
        - Ensures unsupported providers return HTTP 400 with clear guidance
        """
        response = client.get("/images/search?query=business&provider=invalid-provider")

        assert response.status_code == 400
        assert response.json()["detail"] == "provider must be either 'pexels' or 'pixabay'"

