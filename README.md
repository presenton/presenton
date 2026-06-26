<p align="center">
  <img src="./readme_assets/images/logo.png" alt="Presenton" />
</p>

<p align="center">
  <a href="https://presenton.ai/download"><strong>Quickstart</strong></a> &middot;
  <a href="https://docs.presenton.ai/"><strong>Docs</strong></a> &middot;
  <a href="https://www.youtube.com/@presentonai"><strong>Youtube</strong></a> &middot;
  <a href="https://discord.gg/9ZsKKxudNE"><strong>Discord</strong></a>
</p>

<p align="center">
  <a href="https://github.com/presenton/presenton/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat" alt="Apache2.0" /></a>
  <a href="https://github.com/presenton/presenton"><img src="https://img.shields.io/github/stars/presenton/presenton?style=flat" alt="Stars" /></a>
  <a href="https://presenton.ai/"><img src="https://img.shields.io/badge/Platform-Docker%20%7C%20Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat" alt="Platform" /></a>
</p>

# Open-Source AI Presentation Generator and API (Gamma, Canva, Beautiful AI, Decktopus, Presentations AI Alternative)

Discover what Presenton can do from AI-powered presentation generation to editing, exporting, and flexible model providers.

[▶ Watch Presenton in Action](https://github.com/user-attachments/assets/93e541dc-8487-4dcf-a9a0-95ad5ca94453)

### ✨ Why Presenton

No SaaS lock-in · No forced subscriptions · Full control over models and data

What makes Presenton different?

- Use Fully **self-hosted** in Web through [Docker Package](https://docs.presenton.ai/v3/get-started/quickstart)
- Or Download [Desktop App](https://presenton.ai/download) (Mac, Windows & Linux)
- Works with Ollama, LM Studio, OpenAI, Gemini, Vertex AI, Azure OpenAI, Amazon Bedrock, Fireworks, Together AI, Anthropic, or any other OpenAI compatible providers
- Comes with AI Presentation Generation API
- Fully open-source (Apache 2.0)
- Works with your own design/templates
- **Fully editable PPTX export**

> [!TIP]
> **Star us!** A ⭐ shows your support and encourages us to keep building! 😇

<p align="center">
  <img src="./readme_assets/images/banner_bg.gif" alt="Presenton" />
</p>

#

### 🎛 Features

<p align="center">
  <img src="./readme_assets/images/features.png" alt="Presenton Features" />
</p>

<p align="center">
  <img src="./readme_assets/images/chatgpt-2-1.png" alt="Create stunning presentations with your existing ChatGPT subscription — secure and private, instant access, no API keys" />
</p>

#

### 💻 Presenton Desktop

Create AI-powered presentations using your own model provider (BYOK) or run everything locally on your own machine for full control and data privacy.

<p align="center">
  <a href="https://presenton.ai/download">
    <img src="./readme_assets/images/banner.png" alt="Cloud deployment" />
  </a>
</p>

**Available Platforms**

<table>
<tr>
<th align="left">Platform</th>
<th align="left">Architecture</th>
<th align="left">Package</th>
<th align="left">Download</th>
</tr>

<tr>
<td><b>macOS</b></td>
<td>Apple Silicon / Intel</td>
<td><code>.dmg</code></td>
<td><a href="https://presenton.ai/download">Download ↗</a></td>
</tr>

<tr>
<td><b>Windows</b></td>
<td>x64</td>
<td><code>.exe</code></td>
<td><a href="https://presenton.ai/download">Download ↗</a></td>
</tr>

<tr>
<td><b>Linux</b></td>
<td>x64</td>
<td> <code>.deb</code></td>
<td><a href="https://presenton.ai/download">Download ↗</a></td>
</tr>

</table>


**Deploy to Cloud Providers**

<div style="display:flex; gap:12px; align-items:center;">
  <a href="https://railway.com/deploy/presenton-ai-presentations">
    <img
      src="https://railway.com/button.svg"
      alt="Deploy on Railway"
      style="height:38px;"
    />
  </a>
  <a href="https://cloud.digitalocean.com/apps/new?repo=https://github.com/presenton/presenton/tree/main">
    <img
      src="https://www.deploytodo.com/do-btn-blue.svg"
      alt="Deploy to DigitalOcean"
      style="height:36px;"
    />
  </a>
</div>

#

Presenton gives you complete control over your AI presentation workflow. Choose your models, customize your experience, and keep your data private.

- Custom Templates & Themes — Create unlimited presentation designs with HTML and Tailwind CSS
- AI Template Generation — Create presentation templates from existing Powerpoint documents.
- Flexible Generation — Build presentations from prompts or uploaded documents
- Export Ready — Save as PowerPoint (PPTX) and PDF with professional formatting
- Built-In MCP Server — Generate presentations over Model Context Protocol
- Bring Your Own Key — Use your own API keys for OpenAI, Google Gemini, Vertex AI, Azure OpenAI, Anthropic Claude, or any compatible provider. Only pay for what you use, no hidden fees or subscriptions.
- Ollama Integration — Run open-source models locally with full privacy
- OpenAI API Compatible — Connect to any OpenAI-compatible endpoint with your own models
- Multi-Provider Support — Mix and match text and image generation providers
- Versatile Image Generation — Choose from DALL-E 3, Gemini Flash, Pexels, or Pixabay
- Rich Media Support — Icons, charts, and custom graphics for professional presentations
- Runs Locally — All processing happens on your device, no cloud dependencies
- API Deployment — Host as your own API service for your team
- Fully Open-Source — Apache 2.0 licensed, inspect, modify, and contribute
- Docker Ready — One-command deployment with GPU support for local models
- Electron Desktop App — Run Presenton as a native desktop application on Windows, macOS, and Linux (no browser required)
- Sign in with ChatGPT — Use your free or paid ChatGPT account to sign in and start creating presentations instantly — no separate API key required

#

### ☁️ Presenton Cloud

Run Presenton directly in your browser — no installation, no setup required. Start creating presentations instantly from anywhere.

<p align="center">
  <a href="https://presenton.ai">
    <img src="./readme_assets/images/cloud-banner.png" alt="Presenton Cloud" />
  </a>
</p>

#

### ⚡ Running Presenton

  <p>
    You can run Presenton in two ways:
    <strong>Docker</strong> for a one-command setup without installing a local dev
    stack, or the <strong>Electron desktop app</strong> for a native app
    experience (ideal for development or offline use).
  </p>

**Option 1: Electron (Desktop App)**

   <p>
    Run Presenton as a native desktop application. LLM and image provider
    (API keys, etc.) can be configured in the app. The same environment variables
    used for Docker apply when running the bundled backend.
  </p>

  <p>
    <strong>Prerequisites:</strong> Node.js (LTS), npm, Python 3.11, and
    <a href="https://docs.astral.sh/uv/">uv</a>
    (for the shared FastAPI backend in <code>servers/fastapi</code>).
  </p>

- Setup (First Time)
  <pre><code class="language-bash">cd electron
  npm run setup:env</code></pre>

  This installs Node dependencies, runs <code>uv sync</code> in the FastAPI
  server, and installs Next.js dependencies.

- Run in Development
  <pre><code class="language-bash">npm run dev</code></pre>
  <p>
  This compiles TypeScript and starts Electron. The backend and UI run locally
  inside the desktop window.
  </p>

- Build Distributable (Optional)
  To create installers for Windows, macOS, or Linux:
  <pre><code class="language-bash">npm run build:all
  npm run dist</code></pre>
  <p>
  Output files are written to <code>electron/dist</code>
  (or as configured in your <code>electron-builder</code> settings).
  </p>

**Option 2: Docker**

- Start Presenton
  Linux/MacOS (Bash/Zsh Shell):
  <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

  Windows (PowerShell):
  <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -v "${PWD}\app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Open Presenton
  <p>
  Open <a href="http://localhost:5001">http://localhost:5001</a> in the browser
  of your choice to use Presenton.
  </p>

  <blockquote>
  <p>
    <strong>Note:</strong> You can replace <code>5001</code> with any other port
    number of your choice to run Presenton on a different port number. If you use
    Docker Compose, set <code>PRESENTON_HTTP_HOST_PORT</code>, for example
    <code>PRESENTON_HTTP_HOST_PORT=8080 docker compose up production</code>.
  </p>
  </blockquote>

#

### ⚙️ Deployment Configurations

The lists below match the environment variables forwarded in this repository’s **`docker-compose.yml`** (`production`, `production-gpu`, `development`, and `development-gpu`). Put values in a `.env` file next to the compose file, or export them before `docker compose up`. The Electron app backend can read the same names when run outside Docker.

Other optional variables exist in code (for example advanced Mem0 paths, LiteParse runners, or `FAST_API_INTERNAL_URL` when Next.js and FastAPI are not same-origin); they are **not** wired in `docker-compose.yml`. Supported names are discoverable from `servers/fastapi/utils/get_env.py` and the Next.js server utilities under `servers/nextjs/`.

#### LLM and API keys

- **CAN_CHANGE_KEYS**=[true/false]: Set to **false** if you want to keep API keys hidden and make them unmodifiable.
- **LLM**=[openai/deepseek/google/vertex/azure/bedrock/openrouter/fireworks/together/cerebras/anthropic/litellm/lmstudio/ollama/custom/codex]: Select the text **LLM**.
- **OPENAI_API_KEY**: Required if **LLM** is **openai**.
- **OPENAI_MODEL**: Required if **LLM** is **openai** (default: `gpt-4.1`).
- **DEEPSEEK_API_KEY**: Required if **LLM** is **deepseek**.
- **DEEPSEEK_MODEL**: Required if **LLM** is **deepseek** (default: `deepseek-chat`).
- **DEEPSEEK_BASE_URL**: Optional if **LLM** is **deepseek** (default: `https://api.deepseek.com`).
- **GOOGLE_API_KEY**: Required if **LLM** is **google**.
- **GOOGLE_MODEL**: Required if **LLM** is **google** (default: `models/gemini-2.0-flash`).
- **VERTEX_MODEL**: Required if **LLM** is **vertex** (default: `gemini-2.5-flash`).
- **VERTEX_API_KEY**: Optional auth path for **LLM=vertex** (Vertex Express).
- **VERTEX_PROJECT** / **VERTEX_LOCATION**: Optional auth path for **LLM=vertex** when using GCP project credentials (do not combine with `VERTEX_API_KEY`).
- **VERTEX_BASE_URL**: Optional Vertex gateway/base URL override.
- **AZURE_OPENAI_MODEL**: Required if **LLM** is **azure** (deployment/model name).
- **AZURE_OPENAI_API_KEY**: Required if **LLM** is **azure**.
- **AZURE_OPENAI_API_VERSION**: Required if **LLM** is **azure** (for example `2024-10-21`).
- **AZURE_OPENAI_ENDPOINT** / **AZURE_OPENAI_BASE_URL**: At least one is required if **LLM** is **azure**.
- **AZURE_OPENAI_DEPLOYMENT**: Optional deployment override for **LLM** is **azure**.
- **BEDROCK_REGION**: Optional if **LLM** is **bedrock** (default: `us-east-1`).
- **BEDROCK_MODEL**: Required if **LLM** is **bedrock**. Use a standard model ID (example: `us.anthropic.claude-3-5-haiku-20241022-v1:0`) or a full **inference profile ARN** for newer models (example: Claude Sonnet 4.6). Passed through to Bedrock Converse as `modelId`. See **[Amazon Bedrock guide](docs/amazon-bedrock.md)**.
- **BEDROCK_API_KEY**: Optional if **LLM** is **bedrock** (API key auth; alternative to AWS keys).
- **BEDROCK_AWS_ACCESS_KEY_ID** / **BEDROCK_AWS_SECRET_ACCESS_KEY**: Required together if **LLM** is **bedrock** and `BEDROCK_API_KEY` is not set.
- **BEDROCK_AWS_SESSION_TOKEN**: Optional session token for **LLM** is **bedrock**.
- **BEDROCK_PROFILE_NAME**: Optional AWS profile name for **LLM** is **bedrock**.
- **OPENROUTER_API_KEY**: Required if **LLM** is **openrouter**.
- **OPENROUTER_MODEL**: Required if **LLM** is **openrouter** (default: `openai/gpt-4o`).
- **OPENROUTER_BASE_URL**: Optional if **LLM** is **openrouter** (default: `https://openrouter.ai/api/v1`).
- **FIREWORKS_API_KEY**: Required if **LLM** is **fireworks**.
- **FIREWORKS_MODEL**: Required if **LLM** is **fireworks** (example: `accounts/fireworks/models/llama-v3p1-8b-instruct`).
- **FIREWORKS_BASE_URL**: Optional if **LLM** is **fireworks** (default: `https://api.fireworks.ai/inference/v1`).
- **TOGETHER_API_KEY**: Required if **LLM** is **together**.
- **TOGETHER_MODEL**: Required if **LLM** is **together** (example: `openai/gpt-oss-20b`).
- **TOGETHER_BASE_URL**: Optional if **LLM** is **together** (default: `https://api.together.ai/v1`).
- **CEREBRAS_API_KEY**: Required if **LLM** is **cerebras**.
- **CEREBRAS_MODEL**: Required if **LLM** is **cerebras** (default: `llama-3.3-70b`).
- **CEREBRAS_BASE_URL**: Optional if **LLM** is **cerebras** (default: `https://api.cerebras.ai/v1`).
- **ANTHROPIC_API_KEY**: Required if **LLM** is **anthropic**.
- **ANTHROPIC_MODEL**: Required if **LLM** is **anthropic** (default: `claude-3-5-sonnet-20241022`).
- **CODEX_MODEL**: Required if **LLM** is **codex** (Codex OAuth flow; compose maps host port **1455** for the callback).
- **CUSTOM_LLM_URL**: OpenAI-compatible base URL if **LLM** is **custom**.
- **CUSTOM_LLM_API_KEY**: API key if **LLM** is **custom**.
- **CUSTOM_MODEL**: Model id if **LLM** is **custom**.
- **LITELLM_BASE_URL**: LiteLLM proxy or gateway base URL if **LLM** is **litellm**.
- **LITELLM_API_KEY**: Optional API key if **LLM** is **litellm**.
- **LITELLM_MODEL**: Required if **LLM** is **litellm** (default: `gpt-4.1`).
- **LMSTUDIO_BASE_URL**: Optional LM Studio base URL if **LLM** is **lmstudio** (default: `http://localhost:1234/v1`; `/v1` is auto-appended when omitted).
- **LMSTUDIO_API_KEY**: Optional API key if **LLM** is **lmstudio**.
- **LMSTUDIO_MODEL**: Required if **LLM** is **lmstudio** (example: `openai/gpt-oss-20b`).
- **DISABLE_THINKING**=[true/false]: If **true**, disables “thinking” for providers that support it (including DeepSeek).
- **WEB_GROUNDING**=[true/false]: If **true**, enables web search by default.
- **WEB_SEARCH_PROVIDER**=[auto/native/searxng/tavily/exa]: Selects the web search mode. `auto` uses native search for OpenAI, Google, and Anthropic, and otherwise leaves web search off unless you choose an external provider.
<!-- Brave and Serper search providers are hidden until they are tested. -->
<!-- - **WEB_SEARCH_PROVIDER** also supports `brave` and `serper`. -->
- **WEB_SEARCH_MAX_RESULTS**: Maximum external search results to add to model context (default `5`, maximum `10`).
- **SEARXNG_BASE_URL**: Base URL for a self-hosted SearXNG instance.
- **TAVILY_API_KEY**, **EXA_API_KEY**: Credentials for optional hosted search APIs.
<!-- - **BRAVE_SEARCH_API_KEY**, **SERPER_API_KEY**: Credentials for hidden, untested hosted search APIs. -->
- **EXTENDED_REASONING**=[true/false]: Enables extended reasoning where supported by the configured stack.

#### Ollama

Use when **LLM** is **ollama**:

- **OLLAMA_URL**: Base URL of the Ollama HTTP API (e.g. `http://host.docker.internal:11434` from Docker).
- **OLLAMA_MODEL**: Model name in Ollama (e.g. `llama3.2:3b`).
- **START_OLLAMA**=[true/false]: Container entrypoint (`start.js`): optional install + `ollama serve`. Default **false** (`development` / `production` compose).

#### Presentation memory (Mem0 OSS)

Mem0 uses local Qdrant + SQLite (OSS); memory is scoped per presentation.

By default the Docker runtime now points Mem0 at a local Ollama-compatible LLM endpoint, so it no longer needs an OpenAI key just to initialize. If you want to use OpenAI instead, set `MEM0_LLM_BASE_URL`/`MEM0_LLM_API_KEY` to your OpenAI-compatible endpoint and key.
Docker images install the default spaCy model (`en_core_web_sm`) during build so Mem0 can start without extra setup on each run.

| Variable                     | Purpose                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **MEM0_ENABLED**             | **true**/false (compose default **true**).                                                                       |
| **MEM0_LLM_MODEL**           | Mem0 LLM model name (compose default **`llama3.1:latest`** or `OLLAMA_MODEL`).                                   |
| **MEM0_LLM_API_KEY**         | Mem0 LLM API key placeholder for OpenAI-compatible clients (compose default **`ollama`**).                       |
| **MEM0_LLM_BASE_URL**        | Mem0 LLM base URL (compose default **`OLLAMA_URL`** or `http://host.docker.internal:11434`).                     |
| **MEM0_DIR**                 | Root directory (compose default **`/app_data/mem0`**).                                                           |
| **MEM0_EMBEDDER_PROVIDER**   | Embedder backend (compose default **`fastembed`**).                                                              |
| **MEM0_EMBEDDER_MODEL**      | Model id (compose default **`BAAI/bge-small-en-v1.5`**).                                                         |
| **MEM0_EMBEDDING_DIMS**      | Vector size (compose default **384**).                                                                           |
| **MEM0_SPACY_MODEL**         | Optional spaCy model override (default **`en_core_web_sm`**).                                                    |
| **MEM0_REQUIRE_SPACY_MODEL** | Keep as **true** (default). Set to false only if you intentionally want Mem0 to run without spaCy lemmatization. |

#### Document parsing (LiteParse)

| Variable                  | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| **LITEPARSE_DPI**         | OCR render DPI (compose default **120**). |
| **LITEPARSE_NUM_WORKERS** | Worker count (compose default **1**).     |

#### Database

- **DATABASE_URL**: SQLAlchemy URL; if unset, the app falls back to SQLite under app data.
- **MIGRATE_DATABASE_ON_STARTUP**: Compose sets **`true`** for all services so migrations run on startup.

#### Image generation

These variables match `docker-compose.yml`. **`IMAGE_PROVIDER`** selects the backend (`pexels`, `pixabay`, `gemini_flash`, `nanobanana_pro`, `dall-e-3`, `gpt-image-1.5`, `comfyui`, `open_webui`). Use **OPENAI_API_KEY** for OpenAI image modes and **GOOGLE_API_KEY** for Gemini image modes (same keys as the LLM section).

- **DISABLE_IMAGE_GENERATION**=[true/false]: Disable slide image generation.
- **IMAGE_PROVIDER**: Provider id (see enum above).
- **PEXELS_API_KEY**: Pexels stock images.
- **PIXABAY_API_KEY**: Pixabay stock images.
- **DALL_E_3_QUALITY**=[standard/hd]: Optional for **dall-e-3** (default `standard`).
- **GPT_IMAGE_1_5_QUALITY**=[low/medium/high]: Optional for **gpt-image-1.5** (default `medium`).
- **COMFYUI_URL** / **COMFYUI_WORKFLOW**: Self-hosted ComfyUI workflow JSON.
- **OPEN_WEBUI_IMAGE_URL** / **OPEN_WEBUI_IMAGE_API_KEY**: Open WebUI–compatible image endpoint.
- **OPENAI_COMPAT_IMAGE_BASE_URL** / **OPENAI_COMPAT_IMAGE_API_KEY** / **OPENAI_COMPAT_IMAGE_MODEL**: Required if using **openai_compatible** to send image requests to any OpenAI-compatible `/v1/images/*` endpoint (LiteLLM, Azure, vLLM Gateways, etc.).

#### Telemetry

- **DISABLE_ANONYMOUS_TRACKING**=[true/false]: Set to **true** to disable anonymous telemetry.

#### Authentication (web login)

Presenton uses a **single admin account** per instance. Credentials live in `app_data` (hashed; see `userConfig.json`). Pass these with `-e` or via `.env` for compose:

- **AUTH_USERNAME** / **AUTH_PASSWORD** — Preseed the admin login on first boot (password at least 6 characters). Ignored if a user already exists unless **AUTH_OVERRIDE_FROM_ENV** is set.
- **AUTH_OVERRIDE_FROM_ENV**=[true/false] — If **true**, replace stored credentials from the env vars on every FastAPI startup and rotate the session signing secret (invalidates existing sessions). Remove after a one-off rotation.
- **RESET_AUTH**=[true/false] — If **true**, clear stored credentials on startup. Use for a **single** boot to recover access, then unset.

**Examples**

```bash
docker run -it --name presenton -p 5001:80 -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

```bash
docker run -it --name presenton -p 5001:80 -e AUTH_USERNAME=admin -e AUTH_PASSWORD=changeme123 -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

```bash
docker run -it --name presenton -p 5001:80 -e AUTH_USERNAME=admin -e AUTH_PASSWORD=changeme123 -v "${PWD}\app_data:/app_data" ghcr.io/presenton/presenton:latest
```

```bash
docker stop presenton && docker rm presenton && docker run -it --name presenton -p 5001:80 -e AUTH_USERNAME=admin -e AUTH_PASSWORD=newcred456 -e AUTH_OVERRIDE_FROM_ENV=true -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

```bash
docker stop presenton && docker rm presenton && docker run -it --name presenton -p 5001:80 -e RESET_AUTH=true -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

```bash
docker stop presenton && docker rm presenton && docker run -it --name presenton -p 5001:80 -e AUTH_USERNAME=admin -e AUTH_PASSWORD=changeme123 -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

**Manual reset:** stop the container, edit `./app_data/userConfig.json`, delete `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, and `AUTH_SECRET_KEY`, save, and start again.

Sign out from the app: **Settings → Other → Sign out**.

#### MCP authentication

When auth is configured (`AUTH_USERNAME` / `AUTH_PASSWORD`), the MCP endpoint at `/mcp` now requires authentication as well.

1. Log in once to get a bearer token:

```bash
curl -s -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme123"}'
```

The response includes:

- `access_token` (session token)
- `token_type` (`bearer`)

2. Configure your MCP client to send that token on every request:

```json
{
  "mcpServers": {
    "presenton": {
      "url": "http://localhost:5001/mcp",
      "headers": {
        "Authorization": "Bearer <access_token>"
      }
    }
  }
}
```

Notes:

- If you rotate credentials with `AUTH_OVERRIDE_FROM_ENV=true`, previously issued session tokens are invalidated.
- MCP is not available in the Electron desktop app (`PRESENTON_ELECTRON=true`). Electron runs with `DISABLE_AUTH=true` by default, and the MCP server is disabled there to avoid auth conflicts.

> Note: LLM and image variables above are forwarded from **`docker-compose.yml`** when set in `.env`.

<br>
<br>

**Docker Run Examples by Provider**

Same variables as compose; use `-e` instead of `.env` when running `docker run` directly.

- Using OpenAI
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="openai" -e OPENAI_API_KEY="******" -e IMAGE_PROVIDER="dall-e-3" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Google
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="google" -e GOOGLE_API_KEY="******" -e IMAGE_PROVIDER="gemini_flash" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Vertex AI (API key mode)
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="vertex" -e VERTEX_API_KEY="******" -e VERTEX_MODEL="gemini-2.5-flash" -e IMAGE_PROVIDER="gemini_flash" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Azure OpenAI
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="azure" -e AZURE_OPENAI_API_KEY="******" -e AZURE_OPENAI_MODEL="gpt-4.1" -e AZURE_OPENAI_API_VERSION="2024-10-21" -e AZURE_OPENAI_ENDPOINT="https://YOUR-RESOURCE.openai.azure.com" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Amazon Bedrock (on-demand model ID) — see **[docs/amazon-bedrock.md](docs/amazon-bedrock.md)** for inference profiles, IAM, and troubleshooting.
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="bedrock" -e BEDROCK_REGION="us-east-1" -e BEDROCK_AWS_ACCESS_KEY_ID="******" -e BEDROCK_AWS_SECRET_ACCESS_KEY="******" -e BEDROCK_MODEL="us.anthropic.claude-3-5-haiku-20241022-v1:0" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Amazon Bedrock (inference profile ARN, e.g. Claude Sonnet 4.6)
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="bedrock" -e BEDROCK_REGION="us-east-1" -e BEDROCK_AWS_ACCESS_KEY_ID="******" -e BEDROCK_AWS_SECRET_ACCESS_KEY="******" -e BEDROCK_MODEL="arn:aws:bedrock:us-east-1:YOUR_ACCOUNT_ID:inference-profile/us.anthropic.claude-sonnet-4-6" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Fireworks
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="fireworks" -e FIREWORKS_API_KEY="******" -e FIREWORKS_MODEL="accounts/fireworks/models/llama-v3p1-8b-instruct" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Together AI
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="together" -e TOGETHER_API_KEY="******" -e TOGETHER_MODEL="openai/gpt-oss-20b" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Ollama
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="ollama" -e OLLAMA_MODEL="llama3.2:3b" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="*******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using Anthropic
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="anthropic" -e ANTHROPIC_API_KEY="******" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using LM Studio (local)
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e LLM="lmstudio" -e LMSTUDIO_BASE_URL="http://host.docker.internal:1234" -e LMSTUDIO_MODEL="openai/gpt-oss-20b" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using OpenAI Compatible LLM API
    <pre><code class="language-bash">docker run -it -p 5001:80 -e CAN_CHANGE_KEYS="false"  -e LLM="custom" -e CUSTOM_LLM_URL="http://*****" -e CUSTOM_LLM_API_KEY="*****" -e CUSTOM_MODEL="llama3.2:3b" -e IMAGE_PROVIDER="pexels" -e  PEXELS_API_KEY="********" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Running Presenton with GPU Support
  To use GPU acceleration with Ollama models, you need to install and configure the NVIDIA Container Toolkit. This allows Docker containers to access your NVIDIA GPU.
  Once the NVIDIA Container Toolkit is installed and configured, you can run Presenton with GPU support by adding the `--gpus=all` flag:
    <pre><code class="language-bash">docker run -it --name presenton --gpus=all -p 5001:80 -e LLM="ollama" -e OLLAMA_MODEL="llama3.2:3b" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="*******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

- Using an OpenAI-Compatible Image Provider

  This routes all slide image requests through your OpenAI-compatible gateway (LiteLLM, Azure, vLLM, etc.) while keeping the text LLM configuration independent:
    <pre><code class="language-bash">docker run -it --name presenton -p 5001:80 -e IMAGE_PROVIDER="openai_compatible" -e OPENAI_COMPAT_IMAGE_BASE_URL="https://proxy.example.com/v1" -e OPENAI_COMPAT_IMAGE_API_KEY="******" -e OPENAI_COMPAT_IMAGE_MODEL="gpt-image-1" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest</code></pre>

#

### ✨ Generate Presentation via API

**Generate Presentation**

<p>
<strong>Endpoint:</strong> <code>/api/v1/ppt/presentation/generate</code><br>
<strong>Method:</strong> <code>POST</code><br>
<strong>Content-Type:</strong> <code>application/json</code>
</p>

<p>
<strong>Authentication (HTTP Basic):</strong><br>
All <code>/api/v1/</code> routes except <code>/api/v1/auth/*</code> require authentication. Send your Presenton admin username and password (same as the web UI, or <strong>AUTH_USERNAME</strong> / <strong>AUTH_PASSWORD</strong> when preseeding Docker). With <code>curl</code>, put them right after <code>-u</code> as <code>-u USERNAME:PASSWORD</code> — that is HTTP Basic auth and sets <code>Authorization: Basic …</code> for you. Replace the sample <code>username:password</code> below with your real credentials.
</p>

**Request Body**

<table>
<thead>
<tr>
<th>Parameter</th>
<th>Type</th>
<th>Required</th>
<th>Description</th>
</tr>
</thead>
<tbody>

<tr>
<td><code>content</code></td>
<td>string</td>
<td>Yes</td>
<td>Main content used to generate the presentation.</td>
</tr>

<tr>
<td><code>slides_markdown</code></td>
<td>string[] | null</td>
<td>No</td>
<td>Provide custom slide markdown instead of auto-generation.</td>
</tr>

<tr>
<td><code>instructions</code></td>
<td>string | null</td>
<td>No</td>
<td>Additional generation instructions.</td>
</tr>

<tr>
<td><code>tone</code></td>
<td>string</td>
<td>No</td>
<td>
Text tone (default: <code>"default"</code>).  
Options: <code>default</code>, <code>casual</code>, <code>professional</code>, 
<code>funny</code>, <code>educational</code>, <code>sales_pitch</code>
</td>
</tr>

<tr>
<td><code>verbosity</code></td>
<td>string</td>
<td>No</td>
<td>
Content density (default: <code>"standard"</code>).  
Options: <code>concise</code>, <code>standard</code>, <code>text-heavy</code>
</td>
</tr>

<tr>
<td><code>web_search</code></td>
<td>boolean</td>
<td>No</td>
<td>Enable web search grounding (default: <code>false</code>).</td>
</tr>

<tr>
<td><code>n_slides</code></td>
<td>integer</td>
<td>No</td>
<td>Number of slides to generate (default: <code>8</code>).</td>
</tr>

<tr>
<td><code>language</code></td>
<td>string</td>
<td>No</td>
<td>Presentation language (default: <code>"English"</code>).</td>
</tr>

<tr>
<td><code>template</code></td>
<td>string</td>
<td>No</td>
<td>Template name (default: <code>"general"</code>).</td>
</tr>

<tr>
<td><code>include_table_of_contents</code></td>
<td>boolean</td>
<td>No</td>
<td>Include table of contents slide (default: <code>false</code>).</td>
</tr>

<tr>
<td><code>include_title_slide</code></td>
<td>boolean</td>
<td>No</td>
<td>Include title slide (default: <code>true</code>).</td>
</tr>

<tr>
<td><code>files</code></td>
<td>string[] | null</td>
<td>No</td>
<td>
Files to use in generation.  
Upload first via <code>/api/v1/ppt/files/upload</code>.
</td>
</tr>

<tr>
<td><code>export_as</code></td>
<td>string</td>
<td>No</td>
<td>
Export format (default: <code>"pptx"</code>).  
Options: <code>pptx</code>, <code>pdf</code>
</td>
</tr>

</tbody>
</table>

**Response**

<pre><code class="language-json">{
  "presentation_id": "string",
  "path": "string",
  "edit_path": "string"
}</code></pre>

**Example (curl + HTTP Basic auth with <code>-u</code>)**

<pre><code class="language-bash">curl -u username:password \
  -X POST http://localhost:5001/api/v1/ppt/presentation/generate \
  -H "Content-Type: application/json" \
  -d '{
   "content": "Introduction to Machine Learning",
    "n_slides": 5,
    "language": "English",
    "template": "general",
    "export_as": "pptx"
  }'</code></pre>

**Example Response**

<pre><code class="language-json">{
  "presentation_id": "d3000f96-096c-4768-b67b-e99aed029b57",
  "path": "/app_data/d3000f96-096c-4768-b67b-e99aed029b57/Introduction_to_Machine_Learning.pptx",
  "edit_path": "/presentation?id=d3000f96-096c-4768-b67b-e99aed029b57"
}</code></pre>

<blockquote>
<strong>Note:</strong>  
Prepend your server’s root URL to <code>path</code> and 
<code>edit_path</code> to construct valid links.
</blockquote>

**Documentation & Tutorials**

<ul>
  <li>
    <a href="https://docs.presenton.ai/v3/get-started/quickstart">
      Deploy Presenton
    </a>
  </li>
  <li>
    <a href="https://docs.presenton.ai/v3/get-started/api-introduction">
      Full API Documentation
    </a>
  </li>
  <li>
    <a href="https://docs.presenton.ai/v3/guide/using-presenton-api">
      Generate Presentations via API in 5 Minutes
    </a>
  </li>
  <li>
    <a href="https://docs.presenton.ai/tutorial/generate-presentation-from-csv">
      Create Presentations from CSV using AI
    </a>
  </li>
  <li>
    <a href="https://docs.presenton.ai/tutorial/create-data-reports-using-ai">
      Create Data Reports Using AI
    </a>
  </li>
</ul>

#

### 🚀 Roadmap

Track the public roadmap on GitHub Projects: [https://github.com/orgs/presenton/projects/2](https://github.com/orgs/presenton/projects/2)
