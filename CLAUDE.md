# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Presentation Agent is an open-source AI presentation generator that runs locally. It consists of two main servers:
- **FastAPI backend** (`servers/fastapi/`) - Python 3.11 API service handling LLM calls, presentation generation, and PPTX creation
- **Next.js frontend** (`servers/nextjs/`) - React/TypeScript UI with App Router architecture

The application generates presentations from text prompts or documents, supporting multiple LLM providers (OpenAI, Google Gemini, Anthropic Claude, Ollama, custom OpenAI-compatible APIs) and exports to PPTX/PDF formats.

## Common Commands

### Development
```bash
# Start both servers in development mode (from project root)
node start.js --dev

# Or use Docker Compose
docker-compose up development
```

### FastAPI (Backend)
```bash
cd servers/fastapi

# Run backend directly (Python 3.11 required)
python3 server.py --port 8000 --reload true

# Run tests
python3 -m pytest

# Run specific test
python3 -m pytest tests/test_presentation_generation_api.py -v

# Run MCP server (Model Context Protocol)
python3 mcp_server.py --port 8001
```

### Next.js (Frontend)
```bash
cd servers/nextjs

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint
npm run lint

# Run Cypress tests
npx cypress open
```

### Docker
```bash
# Production build
docker-compose up production

# Production with GPU support (for Ollama)
docker-compose up production-gpu

# Development
docker-compose up development
```

## Architecture

### Backend (`servers/fastapi/`)

**Entry Point:**
- `server.py` - Starts the FastAPI server via `api.main:app` with uvicorn
- `mcp_server.py` - Starts the MCP (Model Context Protocol) server on port 8001

**Key directories:**
- `api/v1/ppt/endpoints/` - API route handlers for presentations, slides, images, icons, etc.
- `services/` - Core business logic:
  - `llm_client.py` - Unified LLM client supporting multiple providers with streaming
  - `pptx_presentation_creator.py` - Converts presentation models to PPTX files
  - `image_generation_service.py` - Handles image generation (DALL-E, Gemini, Pexels, Pixabay)
  - `documents_loader.py` - Document parsing and chunking using Docling
  - `database.py` - SQLModel/SQLAlchemy async database setup
- `models/` - Pydantic/SQLModel data models:
  - `sql/` - Database models (presentations, slides, templates, etc.)
  - `pptx_models.py` - Models for PPTX structure (boxes, text runs, paragraphs)
  - Request/response models
- `utils/llm_calls/` - LLM-based content generation functions
- `constants/` - Configuration constants and prompts
- `enums/` - Enum definitions (providers, tones, verbosity levels)

**API Structure:**
- Base API at `/api/v1/ppt/`
- Main endpoints: `/presentation/generate`, `/outlines/generate`, `/slide/`, `/images/`
- Webhook system for async notifications at `/api/v1/webhook/`
- Mock endpoints at `/api/v1/mock/` for testing

**LLM Integration:**
The `llm_client.py` provides a unified interface for all LLM providers. It handles:
- Streaming responses with SSE
- Tool/function calling with structured outputs (JSON schemas)
- Provider-specific message format conversions
- Web grounding/search for supported providers

**Database:**
Uses SQLModel with async SQLAlchemy. Supports SQLite (default), PostgreSQL, MySQL via `DATABASE_URL` env variable. Key tables: presentations, slides, templates, presentation_layout_codes, webhooks.

### Frontend (`servers/nextjs/`)

**Key directories:**
- `app/(presentation-generator)/` - Main app routes (Next.js route groups):
  - `upload/` - Initial prompt input and document upload
  - `outline/` - Review and edit presentation outline
  - `presentation/` - Slide editor with live preview
  - `custom-template/` - HTML template creation from PPTX
  - `dashboard/` - Presentation management
  - `settings/` - API key and LLM provider configuration
- `components/` - Shared React components (UI library based on shadcn/ui)
- `store/` - Redux Toolkit state management
- `presentation-templates/` - HTML/Tailwind CSS slide templates (general, modern, standard, swift)
- `utils/` - Frontend utilities
- `types/` - TypeScript type definitions

**Template System:**
Presentation templates are React components written in HTML/Tailwind CSS. Each template defines layout components for different slide types (title, content, list, quote, etc.). Templates support:
- Custom color schemes
- Font customization
- Dynamic content rendering
- Export to PPTX via backend conversion

**State Management:**
Uses Redux Toolkit (`store/slices/`) for managing:
- Presentation data and slides
- User configuration (API keys, models)
- UI state

**Development Notes:**
- App uses Next.js App Router (not Pages Router)
- Proxy configuration in `next.config.mjs` forwards `/app_data/fonts/*` to FastAPI in dev mode
- Custom build directory: `.next-build`
- React strict mode disabled for compatibility

### Communication Between Servers

The Next.js app communicates with FastAPI backend at:
- Development: FastAPI runs on port 8000, Next.js on port 3000
- Production (Docker): Nginx proxies both servers on port 80

Environment variables are shared via `start.js` which:
1. Reads env vars (LLM config, API keys)
2. Creates `userConfig.json` if `CAN_CHANGE_KEYS=true`
3. Starts both FastAPI and Next.js servers
4. Starts Ollama service
5. Starts MCP server on port 8001

### MCP Server

The `mcp_server.py` exposes Presentation Agent's API via Model Context Protocol using FastMCP. It auto-generates MCP tools from the OpenAPI spec (`openai_spec.json`).

## Test Strategy

**Backend:**
- Use `pytest` for all backend tests
- Test files in `servers/fastapi/tests/`
- Coverage includes: API endpoints, LLM schema support, image generation, PPTX creation, document processing

**Frontend:**
- Cypress for E2E tests (`servers/nextjs/cypress/`)
- Component tests: `*.cy.tsx` files

## Important Implementation Details

**Presentation Generation Flow:**
1. User provides prompt/documents → `/api/v1/ppt/outlines/generate`
2. LLM generates outline → User reviews/edits outline
3. Generate full presentation → `/api/v1/ppt/presentation/generate`
4. For each slide: LLM generates content → Images fetched/generated → Layout populated
5. Presentation stored in database with slides
6. Export to PPTX via `pptx_presentation_creator.py`

**Template System:**
- Templates are TSX components in `presentation-templates/`
- Backend converts HTML slides to PPTX using `html_to_text_runs_service.py`
- Users can create custom templates by uploading PPTX files
- Custom templates stored in database as `TemplateModel` records

**LLM Provider Configuration:**
Environment variables control LLM behavior:
- `LLM` - Provider selection (openai/google/anthropic/ollama/custom)
- Provider-specific API keys and model IDs
- `TOOL_CALLS` - Enable/disable function calling for custom LLMs
- `WEB_GROUNDING` - Enable web search for supported providers
- `CAN_CHANGE_KEYS` - Allow runtime API key changes

**Image Generation:**
Separate from LLM provider. Supports:
- DALL-E 3 (OpenAI)
- Gemini Flash (Google)
- Pexels/Pixabay (stock photos)

**Document Processing:**
Uses Docling library for parsing PDFs, DOCX, PPTX. Documents are:
1. Parsed into structured format
2. Chunked using `score_based_chunker.py`
3. Optionally stored in ChromaDB for retrieval
4. Context provided to LLM for presentation generation

## File Naming Conventions

- Python: snake_case for files and variables
- TypeScript: PascalCase for components, camelCase for utilities
- Route files in Next.js: `page.tsx`, `layout.tsx`, `loading.tsx`
- API routes: Organized by resource in `endpoints/` folders

## Dependencies

**Backend:** FastAPI, SQLModel, python-pptx, Docling, OpenAI/Anthropic/Google AI SDKs, ChromaDB, Puppeteer (for PDF export)

**Frontend:** Next.js 14, React 18, Redux Toolkit, shadcn/ui (Radix UI), TailwindCSS, Tiptap (rich text), Recharts, html2canvas

## Error Handling

- Backend: HTTPException with status codes and APIErrorModel
- Frontend: Error boundaries (e.g., `SlideErrorBoundary.tsx`)
- LLM errors: Retry logic in `llm_client.py`
- Async task tracking via `AsyncPresentationGenerationTaskModel`

## Working with Templates

When creating or modifying presentation templates:
1. Templates are in `servers/nextjs/presentation-templates/[template-name]/`
2. Each template exports layout components (TitleSlide, ContentSlide, etc.)
3. Templates must handle markdown content and convert to rendered elements
4. Color schemes defined in `defaultSchemes.ts`
5. Backend reads template HTML and converts to PPTX using python-pptx

To add a new template:
1. Create template folder with layout components
2. Add to `DEFAULT_TEMPLATES` in `servers/fastapi/constants/presentation.py`
3. Ensure all standard layout types are supported

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
