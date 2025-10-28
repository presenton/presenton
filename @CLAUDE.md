# Presenton FastAPI Server Documentation

## Project Overview

**Presenton** is an open-source AI-powered presentation generator that runs locally. The FastAPI server (`servers/fastapi/`) handles all backend functionality including:
- AI-powered presentation generation using multiple LLM providers (OpenAI, Google Gemini, Anthropic, Ollama, Custom)
- PowerPoint (PPTX) and PDF creation and manipulation
- Template management and customization
- Document processing and content extraction
- Image generation and asset management
- Model Context Protocol (MCP) server implementation

## Technology Stack

- **Python**: 3.11
- **Framework**: FastAPI with standard features
- **Database**: SQLModel (supports SQLite, MySQL, PostgreSQL)
- **AI/LLM**: OpenAI, Google GenAI, Anthropic, Ollama
- **Document Processing**: Docling, PDFPlumber, python-pptx
- **Vector Store**: ChromaDB
- **Other**: NLTK, Redis, aiohttp

## Directory Structure

```
servers/fastapi/
├── api/                          # API layer
│   ├── main.py                   # FastAPI app initialization, CORS, middleware
│   ├── lifespan.py              # App startup/shutdown lifecycle
│   ├── middlewares.py           # Custom middleware (UserConfigEnvUpdate)
│   └── v1/                      # API v1 routes
│       ├── ppt/                 # Presentation endpoints
│       │   ├── router.py        # PPT router configuration
│       │   ├── background_tasks.py  # Async task handlers
│       │   └── endpoints/       # Individual endpoint modules
│       │       ├── presentation.py    # Generate/manage presentations
│       │       ├── outlines.py        # Outline generation
│       │       ├── slide.py           # Slide operations
│       │       ├── files.py           # File upload/management
│       │       ├── images.py          # Image generation
│       │       ├── icons.py           # Icon search
│       │       ├── layouts.py         # Layout management
│       │       ├── fonts.py           # Font operations
│       │       ├── pptx_slides.py     # PPTX slide processing
│       │       ├── pdf_slides.py      # PDF operations
│       │       ├── slide_to_html.py   # Slide to HTML conversion
│       │       ├── openai.py          # OpenAI-specific endpoints
│       │       ├── google.py          # Google-specific endpoints
│       │       ├── anthropic.py       # Anthropic-specific endpoints
│       │       ├── ollama.py          # Ollama-specific endpoints
│       │       └── prompts.py         # Prompt management
│       ├── webhook/             # Webhook functionality
│       └── mock/                # Mock endpoints for testing
│
├── models/                      # Data models
│   ├── sql/                     # SQLModel database models
│   │   ├── presentation.py      # Presentation model
│   │   ├── slide.py             # Slide model
│   │   ├── template.py          # Template model
│   │   ├── image_asset.py       # Image asset model
│   │   ├── webhook_subscription.py  # Webhook subscriptions
│   │   ├── async_presentation_generation_status.py
│   │   ├── ollama_pull_status.py
│   │   ├── key_value.py         # Key-value store
│   │   └── presentation_layout_code.py
│   ├── generate_presentation_request.py  # Request models
│   ├── presentation_structure_model.py
│   ├── presentation_outline_model.py
│   ├── presentation_with_slides.py
│   ├── presentation_and_path.py
│   ├── llm_message.py           # LLM message formats
│   ├── llm_tool_call.py         # LLM tool call models
│   ├── llm_tools.py             # LLM tools definitions
│   ├── pptx_models.py           # PowerPoint-related models
│   ├── user_config.py           # User configuration
│   ├── image_prompt.py          # Image generation prompts
│   ├── document_chunk.py        # Document chunking
│   └── [other models...]
│
├── services/                    # Business logic services
│   ├── database.py             # Database connection and session management
│   ├── llm_client.py           # LLM provider abstraction layer
│   ├── llm_tool_calls_handler.py  # Handle LLM tool calls
│   ├── pptx_presentation_creator.py  # PPTX file creation
│   ├── image_generation_service.py   # Image generation
│   ├── icon_finder_service.py        # Icon search functionality
│   ├── documents_loader.py           # Document loading/parsing
│   ├── docling_service.py            # Docling integration
│   ├── html_to_text_runs_service.py  # HTML to text conversion
│   ├── content_summarizer.py         # Content summarization
│   ├── score_based_chunker.py        # Intelligent text chunking
│   ├── concurrent_service.py         # Concurrent task execution
│   ├── temp_file_service.py          # Temporary file management
│   └── webhook_service.py            # Webhook notifications
│
├── utils/                       # Utility functions
│   ├── llm_calls/              # LLM-specific call handlers
│   │   ├── generate_presentation_structure.py
│   │   ├── generate_presentation_outlines.py
│   │   ├── generate_slide_content.py
│   │   ├── edit_slide.py
│   │   ├── edit_slide_html.py
│   │   └── select_slide_type_on_edit.py
│   ├── llm_utils.py            # LLM utilities and helpers
│   ├── db_utils.py             # Database utilities
│   └── validators.py           # Input validation
│
├── constants/                   # Application constants
├── enums/                      # Enumeration types
├── static/                     # Static assets (icons, images)
├── tests/                      # Test suite
├── assets/                     # Template assets
├── chroma/                     # ChromaDB vector store data
│
├── server.py                   # Server entry point
├── mcp_server.py              # Model Context Protocol server
├── pyproject.toml             # Project dependencies
└── openai_spec.json           # OpenAI API specification
```

## Core Workflows

### 1. Presentation Generation Flow

**Entry Point**: `/api/v1/ppt/presentation/generate`

The presentation generation follows these steps:

1. **Request Reception** (`api/v1/ppt/endpoints/presentation.py`)
   - Receives content, configuration (slides count, tone, verbosity, language, template)
   - Optional: uploaded files, custom slides markdown, web search

2. **Document Processing** (if files provided)
   - `services/documents_loader.py`: Loads and parses documents
   - `services/docling_service.py`: Extracts structured content
   - `services/score_based_chunker.py`: Chunks content intelligently

3. **Outline Generation** (`utils/llm_calls/generate_presentation_outlines.py`)
   - Uses LLM to create presentation outline based on content
   - Structured output using JSON schema

4. **Structure Generation** (`utils/llm_calls/generate_presentation_structure.py`)
   - Generates detailed slide structure with layouts
   - Maps content to appropriate slide templates

5. **Slide Content Generation** (`utils/llm_calls/generate_slide_content.py`)
   - For each slide: generates title, content, image prompts
   - Concurrent generation using `services/concurrent_service.py`

6. **Image Generation** (`services/image_generation_service.py`)
   - Supports: DALL-E 3, Gemini Flash, Pexels, Pixabay
   - Asynchronous image generation and downloading

7. **PPTX Creation** (`services/pptx_presentation_creator.py`)
   - Converts HTML slides to PowerPoint format
   - Applies templates and styling
   - Exports as PPTX or PDF

### 2. LLM Provider System

**Service**: `services/llm_client.py`

The system supports multiple LLM providers through a unified interface:

- **OpenAI**: GPT models with structured outputs
- **Google Gemini**: Google's Gemini models with tool calls
- **Anthropic**: Claude models with tool use
- **Ollama**: Local open-source models
- **Custom**: Any OpenAI-compatible API

**Key Features**:
- Provider-agnostic API
- Structured output support (JSON schema or tool calls)
- Streaming responses
- Token counting
- Schema depth limiting for provider compatibility

### 3. Template System

Templates are HTML-based with Tailwind CSS styling.

**Key Files**:
- `models/sql/template.py`: Template metadata
- `api/v1/ppt/endpoints/layouts.py`: Layout management
- `services/pptx_presentation_creator.py`: Template application

**Template Generation**:
- Upload existing PPTX files
- Extract layouts and styling
- Convert to HTML templates
- Store in database

### 4. Database Layer

**Service**: `services/database.py`

- **ORM**: SQLModel (Pydantic + SQLAlchemy)
- **Supported DBs**: SQLite (default), MySQL, PostgreSQL
- **Connection**: Async session management
- **Models**: See `models/sql/` directory

**Key Tables**:
- `presentations`: Generated presentations
- `slides`: Individual slide data
- `templates`: Presentation templates
- `image_assets`: Generated/uploaded images
- `webhook_subscriptions`: Webhook configurations

## API Endpoints Overview

### Presentation Endpoints
- `POST /api/v1/ppt/presentation/generate`: Generate presentation
- `GET /api/v1/ppt/presentation/{id}`: Get presentation details
- `DELETE /api/v1/ppt/presentation/{id}`: Delete presentation
- `POST /api/v1/ppt/presentation/export`: Export as PPTX/PDF

### Outline Endpoints
- `POST /api/v1/ppt/outlines/generate`: Generate presentation outline
- `POST /api/v1/ppt/outlines/regenerate`: Regenerate outline

### Slide Endpoints
- `POST /api/v1/ppt/slide/edit`: Edit slide content
- `POST /api/v1/ppt/slide/regenerate`: Regenerate slide
- `DELETE /api/v1/ppt/slide/{id}`: Delete slide
- `POST /api/v1/ppt/slide/add`: Add new slide

### File Management
- `POST /api/v1/ppt/files/upload`: Upload documents for processing
- `GET /api/v1/ppt/files/{id}`: Get file information
- `DELETE /api/v1/ppt/files/{id}`: Delete file

### Image Generation
- `POST /api/v1/ppt/images/generate`: Generate image from prompt
- `POST /api/v1/ppt/images/search`: Search stock images

### Template Management
- `GET /api/v1/ppt/layouts`: List available layouts
- `POST /api/v1/ppt/layouts/create`: Create custom layout
- `POST /api/v1/ppt/pptx-slides/upload`: Upload PPTX for template extraction

### Provider-Specific Endpoints
- `/api/v1/ppt/openai/*`: OpenAI models/status
- `/api/v1/ppt/google/*`: Google models/status
- `/api/v1/ppt/anthropic/*`: Anthropic models/status
- `/api/v1/ppt/ollama/*`: Ollama models/status/pull

## Configuration & Environment

The system reads configuration from environment variables and database:

**Environment Variables** (see README.md for full list):
- `LLM`: Provider selection (openai/google/anthropic/ollama/custom)
- `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`
- `IMAGE_PROVIDER`: Image generation provider
- `CAN_CHANGE_KEYS`: Allow runtime key changes
- `WEB_GROUNDING`: Enable web search
- `DATABASE_URL`: External database connection

**Runtime Configuration**:
- Stored in `models/sql/key_value.py`
- Updated via `api/middlewares.py` (UserConfigEnvUpdateMiddleware)
- Accessible through `models/user_config.py`

## Development Guidelines

### Running the Server

```bash
cd servers/fastapi
python server.py --port 5000 --reload true
```

### Testing

```bash
pytest tests/
```

**Test Files**:
- `test_presentation_generation_api.py`: End-to-end generation tests
- `test_pptx_creator.py`: PPTX creation tests
- `test_image_generation.py`: Image generation tests
- `test_openai_schema_support.py`: OpenAI integration
- `test_gemini_schema_support.py`: Gemini integration
- `test_mcp_server.py`: MCP server tests

### Adding New LLM Provider

1. Create endpoint in `api/v1/ppt/endpoints/{provider}.py`
2. Add provider logic in `services/llm_client.py`
3. Update `utils/llm_calls/` functions to handle provider specifics
4. Add tests in `tests/`

### Adding New Endpoint

1. Create endpoint function in `api/v1/ppt/endpoints/{feature}.py`
2. Add route to `api/v1/ppt/router.py`
3. Create request/response models in `models/`
4. Implement business logic in `services/`
5. Add tests

## Key Dependencies

- **FastAPI**: Web framework with automatic OpenAPI docs
- **SQLModel**: Type-safe ORM combining Pydantic and SQLAlchemy
- **python-pptx**: PowerPoint file creation and manipulation
- **Docling**: Advanced document processing and layout understanding
- **ChromaDB**: Vector database for semantic search
- **NLTK**: Natural language processing utilities
- **aiohttp**: Async HTTP client for API calls
- **FastMCP**: Model Context Protocol implementation

## MCP Server

The Model Context Protocol server (`mcp_server.py`) allows AI assistants to generate presentations directly.

**Tools Provided**:
- `generate_presentation`: Create presentations from prompts
- `list_templates`: Get available templates
- `upload_file`: Upload documents for processing

## Common Patterns

### Async/Await
Most operations are async for better concurrency:
```python
async def generate_presentation(request: GeneratePresentationRequest):
    async with get_session() as session:
        # Database operations
        ...
```

### Dependency Injection
FastAPI's DI system for database sessions:
```python
from api.dependencies import get_db_session

@router.post("/endpoint")
async def endpoint(session: AsyncSession = Depends(get_db_session)):
    ...
```

### Error Handling
Custom error models in `models/api_error_model.py`:
```python
raise HTTPException(status_code=400, detail="Error message")
```

### LLM Calls
Centralized in `utils/llm_calls/`:
```python
from utils.llm_calls.generate_slide_content import generate_slide_content

content = await generate_slide_content(
    llm_client=llm_client,
    slide_info=slide_info,
    presentation_context=context
)
```

## Recent Changes

- **Content Summarization**: Added token counting and content summarization for large documents
- **Schema Depth Limiting**: Enhanced LLM schema processing for provider compatibility
- **Template Selection**: Fixed keyword-based template selection
- **Flake8 Compliance**: Code style improvements

## Notes for Claude Code

- Focus on `servers/fastapi/` directory only
- The Next.js frontend is in `apps/next/` but is out of scope
- Database migrations are handled automatically by SQLModel
- All presentation generation is async and may take time
- File paths in responses need server URL prepended
- The system supports multi-provider LLM usage simultaneously
