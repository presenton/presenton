# Yarex Presenton — движок генерации презентаций

Приватный форк [Presenton](https://github.com/presenton/presenton):
backend на FastAPI (`servers/fastapi`) и веб-панель с редактором на
Next.js (`servers/nextjs`). Telegram-бот и Mini App пишет отдельный
разработчик; наши API-контракты для него собраны в `docs/tg/`.

От апстрима сохранено: генерация по промпту или документу, декларативные
шаблоны (JSON в корневом `templates/`), экспорт в PPTX/PDF,
мультипровайдерные LLM (OpenAI-совместимый `custom`, DeepSeek, Google,
Anthropic, Bedrock и др.), multi-user с изоляцией данных по владельцу.
Поверх этого добавлено: авторизация через Telegram, дневные квоты
генерации, приватная админка (регистрация закрыта), анонимная телеметрия
выключена по умолчанию.

## Документация репо

| Файл | Что там |
| --- | --- |
| `AGENTS.md` | правила работы с репо, обязательный гейт `make check` |
| `docs/architecture.md` | структура и границы компонентов |
| `tasks.md` | задачи: `P*` — продуктовые, `C*` — инфраструктура |
| `PROGRESS.md` | активная задача (WIP=1) и журнал |
| `docs/tg/` | контракты для Telegram-бота: auth, превью, квоты, FYI |
| `docs/testing-standards.md` | стандарты тестов |
| `docs/progress/` | архив закрытых задач |

## Разработка

```bash
make setup        # uv sync + npm ci (fastapi и nextjs)
make check        # ruff + pytest + npm test + lint + tsc — гейт перед коммитом
make check-full   # паритет с CI: + next build + cypress
make fix          # автофиксы ruff / eslint
```

Стек: Python 3.11 (uv, FastAPI, pytest, ruff), Node 20 (Next.js 16 /
React 19, eslint, node --test, Cypress).

## Прод (yarexlab.ru)

Один контейнер из `docker-compose.server.yml` (`127.0.0.1:50521`, TLS —
nginx хоста). Деплой — кнопкой: GitHub Actions → **Deploy** → Run workflow
(`.github/workflows/deploy.yml`):

- пустой `deploy_tag` — собрать текущий main, образ уедет в
  `ghcr.io/yarexlab/presenton:main-<sha>`; сервер сам сделает `git pull`,
  `compose pull`, `up -d`, затем smoke `/api/v1/auth/status` и чистку
  старых образов;
- `deploy_tag=main-<sha>` — откат на предыдущую версию без пересборки.

Автодеплоя из push нет: пуш в main запускает только тесты
(`.github/workflows/test-all.yml`).

## API (кратко)

Всё скоупится по владельцу сессии; machine-доступ — API-ключ из админки
(**Admin → API keys**, `Authorization: Bearer sk-presenton-...`).
Полные контракты для бота — `docs/tg/fyi.md`.

- `POST /api/v1/auth/telegram` — вход по `initData` Mini App (сессионная кука).
- `POST /api/v1/ppt/presentation/generate/async` → `AsyncTaskModel`;
  статус — `GET /api/v1/async-tasks/{task_id}`.
- Превью слайдов PNG — `servers/fastapi/api/v1/ppt/endpoints/slide_preview.py`.
- Квота/остаток — см. `docs/tg/03-quota.md`.

### Синхронная генерация

<p>
<strong>Endpoint:</strong> <code>/api/v1/ppt/presentation/generate</code><br>
<strong>Method:</strong> <code>POST</code><br>
<strong>Content-Type:</strong> <code>application/json</code>
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

**Example (curl + API key)**

<pre><code class="language-bash">curl \
  -X POST http://localhost:5001/api/v1/ppt/presentation/generate \
  -H "Authorization: Bearer sk-presenton-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
   "content": "Introduction to Machine Learning",
    "n_slides": 5,
    "language": "English",
    "template": "general",
    "export_as": "pptx"
  }'</code></pre>

<blockquote>
<strong>Note:</strong>
Prepend your server’s root URL to <code>path</code> and
<code>edit_path</code> to construct valid links.
</blockquote>

#

## ⚙️ Deployment Configurations

The lists below match the environment variables forwarded in this repository’s **`docker-compose.yml`** (`production`, `production-gpu`, `development`, and `development-gpu`). Put values in a `.env` file next to the compose file, or export them before `docker compose up`.

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
- **OPENROUTER_PROVIDER_ORDER**: Optional comma-separated OpenRouter provider routing order.
- **OPENROUTER_ALLOW_FALLBACKS**=[true/false]: Optional OpenRouter fallback override.
- **OPENROUTER_REQUIRE_PARAMETERS**=[true/false]: Only route to providers supporting every request parameter.
- **OPENROUTER_DATA_COLLECTION**=[allow/deny]: Optional OpenRouter data-collection policy.
- **OPENROUTER_ZDR**=[true/false]: Optional OpenRouter zero-data-retention requirement.
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
- **LLM_STRUCTURED_OUTPUTS**=[true/false]: If **false**, omits `response_format` (structured outputs / `json_schema`) from every LLM request; the engine parses JSON from the model's text response instead. Use for OpenAI-compatible providers/models that reject `response_format` with HTTP 400 (e.g. b.ai, code `400001`). Default: **true**.
- **WEB_GROUNDING**=[true/false]: If **true**, enables web search by default.
- **WEB_SEARCH_PROVIDER**=[auto/native/searxng/tavily/exa]: Selects the web search mode. `auto` uses native search for OpenAI, Google, and Anthropic, and otherwise leaves web search off unless you choose an external provider.
- **WEB_SEARCH_MAX_RESULTS**: Maximum external search results to add to model context (default `5`, maximum `10`).
- **SEARXNG_BASE_URL**: Base URL for a self-hosted SearXNG instance.
- **TAVILY_API_KEY**, **EXA_API_KEY**: Credentials for optional hosted search APIs.
- **EXTENDED_REASONING**=[true/false]: Enables extended reasoning where supported by the configured stack.
- **LLM_GENERATION_PROFILE**=[fast/balanced/deep/model_max]: Optional global generation profile (default: `balanced`).
- **LLM_MAX_OUTPUT_TOKENS**: Optional positive output-token override for every text provider.
- **LLM_REASONING_MODE**=[auto/enabled/disabled]: Optional global reasoning-mode override.
- **LLM_REASONING_EFFORT**=[default/none/minimal/low/medium/high/xhigh/max]: Optional reasoning-effort override.
- **LLM_REASONING_BUDGET_TOKENS**: Optional non-negative reasoning token budget.

All advanced text-provider settings are optional. Use **Reset advanced settings** in Settings or onboarding to remove overrides and inherit application/provider defaults.

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
- **ENABLE_PARALLEL_IMAGE_GENERATION**=[true/false]: Allow concurrent image provider requests (default `true`). Set to `false` to generate images one at a time when the provider has strict rate limits.
- **IMAGE_PROVIDER**: Provider id (see enum above).
- **PEXELS_API_KEY**: Pexels stock images.
- **PIXABAY_API_KEY**: Pixabay stock images.
- **DALL_E_3_QUALITY**=[standard/hd]: Optional for **dall-e-3** (default `standard`).
- **GPT_IMAGE_1_5_QUALITY**=[low/medium/high]: Optional for **gpt-image-1.5** (default `medium`).
- **COMFYUI_URL** / **COMFYUI_WORKFLOW**: Self-hosted ComfyUI workflow JSON.
- **OPEN_WEBUI_IMAGE_URL** / **OPEN_WEBUI_IMAGE_API_KEY**: Open WebUI–compatible image endpoint.
- **OPENAI_COMPAT_IMAGE_BASE_URL** / **OPENAI_COMPAT_IMAGE_API_KEY** / **OPENAI_COMPAT_IMAGE_MODEL**: Required if using **openai_compatible** to send image requests to any OpenAI-compatible `/v1/images/*` endpoint (LiteLLM, Azure, vLLM Gateways, etc.).

The parallel image generation option applies everywhere images are generated: initial presentation generation, slide editing and regeneration, direct image requests, and assistant image tools.

#### Telemetry

- **DISABLE_ANONYMOUS_TRACKING**=[true/false]: Set to **true** to disable anonymous telemetry. Defaults to **true** in docker-compose.yml (private Yarex panel).

#### Multi-user authentication

The panel supports multiple accounts with a private workspace for each user. The
first account becomes the primary administrator and can create, reset, or remove
other accounts from **Admin → Users**.

Existing single-user installations are upgraded automatically: the current account
becomes the primary administrator, while its presentations, templates, tasks, and
other owned data stay attached to the same account.

##### Set up the primary administrator

On a new installation, open the web UI and follow the account setup screen. For an
unattended Docker deployment, you can create the primary administrator on first boot
with environment variables:

```bash
docker run -it --name presenton \
  -p 5001:80 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=change-this-password \
  -v "./app_data:/app_data" \
  ghcr.io/yarexlab/presenton:main
```

Usernames must contain at least 3 characters, and new passwords must contain at least
8 characters. Older six- or seven-character passwords remain valid after an upgrade.

##### Authentication environment variables

| Variable | Purpose |
| --- | --- |
| **AUTH_USERNAME** | Username used to create the primary administrator on first boot. It can also change the username during a rotation or recovery. |
| **AUTH_PASSWORD** | Password used for first-time setup, rotation, or recovery. Required when using either flag below. |
| **AUTH_OVERRIDE_FROM_ENV**=[true/false] | Replace the primary administrator's credentials from the environment on the next startup. Use this for a deployment-managed credential rotation. |
| **RESET_AUTH**=[true/false] | Recover access to the existing primary administrator without replacing the account or its data. |
| **TELEGRAM_BOT_TOKEN** | Token of the Telegram bot powering the Mini App. Enables `POST /api/v1/auth/telegram` (Telegram sign-in); when unset the endpoint answers 503. |
| **TELEGRAM_ALLOWED_USER_IDS** | Optional comma-separated Telegram user IDs allowed to sign in via `POST /api/v1/auth/telegram`. Unset or empty = registration open (closed-beta switch, P6). Applies to existing `tg_*` accounts too. |
| **GENERATION_QUOTA_PER_DAY** | Max presentation generations per user per rolling 24 hours (default `10`). `0` = unlimited; superusers are never limited. Can be overridden per user via `PUT /api/v1/admin/users/{user_id}/quota`. |

For credential rotation from the environment:

```bash
docker stop presenton
docker rm presenton
docker run -it --name presenton \
  -p 5001:80 \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=new-secure-password \
  -e AUTH_OVERRIDE_FROM_ENV=true \
  -v "./app_data:/app_data" \
  ghcr.io/yarexlab/presenton:main
```

For account recovery, use the same command with `RESET_AUTH=true` instead of
`AUTH_OVERRIDE_FROM_ENV=true`. Both operations preserve the administrator's user ID
and owned data, and invalidate existing browser sessions and API keys. Remove the
one-time flag after the successful startup.

> [!IMPORTANT]
> Do not remove authentication fields from `app_data/userConfig.json` to reset
> access. The app stores a hashed recovery copy of the primary administrator
> credentials and the session-signing secret there. Use the recovery variables above
> to preserve the database account and its ownership links.

To sign out, open **Settings → Other → Sign out**.

#### MCP authentication

When auth is enabled, the MCP endpoint at `/mcp` requires an admin-generated
access key. Browser JWT cookies are not accepted as MCP credentials.

1. The administrator opens **Admin → API keys**, chooses
   **Generate key**, and securely gives that key to the MCP user. The MCP user
   does not need a user account or an admin browser login.

2. Configure the MCP client to send the generated `sk-presenton-...` key on
   every request:

```json
{
  "servers": {
    "presenton": {
      "url": "http://localhost:5001/mcp",
      "type": "http",
      "headers": {
        "Authorization": "Bearer sk-presenton-REPLACE_WITH_YOUR_KEY"
      }
    }
  },
  "inputs": []
}
```

Notes:

- This example uses VS Code's `.vscode/mcp.json` format. Use the equivalent
  static-header configuration for other MCP clients.
- Access keys authenticate API/MCP requests only; they cannot sign in to the
  web UI.
- Revoking the key from the admin panel takes effect immediately.

> Note: LLM and image variables above are forwarded from **`docker-compose.yml`** when set in `.env`.

<br>

**Запуск образа напрямую**

Образ приватный: нужен `docker login ghcr.io`. Переменные те же, что и для
compose, но передаются через `-e`:

<pre><code class="language-bash">docker run -it --name presenton -p 5001:80 \
  -e LLM="custom" -e CUSTOM_LLM_URL="https://api.example.com/v1" \
  -e CUSTOM_LLM_API_KEY="******" -e CUSTOM_MODEL="deepseek-chat" \
  -e GENERATION_QUOTA_PER_DAY="10" \
  -v "./app_data:/app_data" \
  ghcr.io/yarexlab/presenton:main</code></pre>
