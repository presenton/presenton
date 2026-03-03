<p align="center">
  <img src="readme_assets/images/presenton-logo.png" height="90" alt="Presenton Logo" />
</p>

<p align="center">
  <a href="https://discord.gg/9ZsKKxudNE">
    <img src="https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&style=for-the-badge" alt="Join our Discord" />
  </a>
  &nbsp;
  <a href="https://x.com/presentonai">
    <img src="https://img.shields.io/badge/X-Follow%20Us-000000?logo=twitter&style=for-the-badge" alt="Follow us on X" />
  </a>
</p>

# Open-Source AI Presentation Generator and API (Gamma, Beautiful AI, Decktopus Alternative)

**Presenton** is an open-source application for generating presentations with AI — all running locally on your device. Stay in control of your data and privacy while using models like OpenAI and Gemini, or use your own hosted models through Ollama.

**✨ Now, generate presentations with your existing PPTX file! Just upload your presentation file to create template design and then use that template to generate on brand and on design presentation on any topic.**

![Demo](readme_assets/demo.gif)

> [!NOTE] > **Enterprise Inquiries:**
> For enterprise use, custom deployments, or partnership opportunities, contact us at **[suraj@presenton.ai](mailto:suraj@presenton.ai)**.

> [!IMPORTANT]
> Like Presenton? A ⭐ star shows your support and encourages us to keep building!

> [!TIP]
> For detailed setup guides, API documentation, and advanced configuration options, visit our **[Official Documentation](https://docs.presenton.ai)**

## ✨ More Freedom with AI Presentations

Presenton gives you complete control over your AI presentation workflow. Choose your models, customize your experience, and keep your data private.

- ✅ **Custom Templates & Themes** — Create unlimited presentation designs with HTML and Tailwind CSS
- ✅ **AI Template Generation** — Create presentation templates from existing Powerpoint documents.
- ✅ **Flexible Generation** — Build presentations from prompts or uploaded documents
- ✅ **Export Ready** — Save as PowerPoint (PPTX) and PDF with professional formatting
- ✅ **Built-In MCP Server** — Generate presentations over Model Context Protocol
- ✅ **Bring Your Own Key** — Use your own API keys for OpenAI, Google Gemini, Anthropic Claude, or any compatible provider. Only pay for what you use, no hidden fees or subscriptions.
- ✅ **Ollama Integration** — Run open-source models locally with full privacy
- ✅ **OpenAI API Compatible** — Connect to any OpenAI-compatible endpoint with your own models
- ✅ **Multi-Provider Support** — Mix and match text and image generation providers
- ✅ **Versatile Image Generation** — Choose from DALL-E 3, Gemini Flash, Pexels, or Pixabay
- ✅ **Rich Media Support** — Icons, charts, and custom graphics for professional presentations
- ✅ **Runs Locally** — All processing happens on your device, no cloud dependencies
- ✅ **API Deployment** — Host as your own API service for your team
- ✅ **Fully Open-Source** — Apache 2.0 licensed, inspect, modify, and contribute
- ✅ **Docker Ready** — One-command deployment with GPU support for local models

## Presenton Cloud

<a href="https://presenton.ai" target="_blank" align="center">
  
  <img src="readme_assets/cloud-banner.png" height="350" alt="Presenton Logo" />
</a>

## Running Presenton Docker

#### 1. Start Presenton

##### Linux/MacOS (Bash/Zsh Shell):

```bash
docker run -it --name presenton -p 5000:80 -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

##### Windows (PowerShell):

```bash
docker run -it --name presenton -p 5000:80 -v "${PWD}\app_data:/app_data" ghcr.io/presenton/presenton:latest
```

#### 2. Open Presenton

Open http://localhost:5000 on browser of your choice to use Presenton.

> **Note: You can replace 5000 with any other port number of your choice to run Presenton on a different port number.**

## Deployment Configurations

You may want to directly provide your API KEYS as environment variables and keep them hidden. You can set these environment variables to achieve it.

- **CAN_CHANGE_KEYS=[true/false]**: Set this to **false** if you want to keep API Keys hidden and make them unmodifiable.
- **LLM=[openai/google/anthropic/ollama/custom]**: Select **LLM** of your choice.
- **OPENAI_API_KEY=[Your OpenAI API Key]**: Provide this if **LLM** is set to **openai**
- **OPENAI_MODEL=[OpenAI Model ID]**: Provide this if **LLM** is set to **openai** (default: "gpt-4.1")
- **GOOGLE_API_KEY=[Your Google API Key]**: Provide this if **LLM** is set to **google**
- **GOOGLE_MODEL=[Google Model ID]**: Provide this if **LLM** is set to **google** (default: "models/gemini-2.0-flash")
- **ANTHROPIC_API_KEY=[Your Anthropic API Key]**: Provide this if **LLM** is set to **anthropic**
- **ANTHROPIC_MODEL=[Anthropic Model ID]**: Provide this if **LLM** is set to **anthropic** (default: "claude-3-5-sonnet-20241022")
- **OLLAMA_URL=[Custom Ollama URL]**: Provide this if you want to custom Ollama URL and **LLM** is set to **ollama**
- **OLLAMA_MODEL=[Ollama Model ID]**: Provide this if **LLM** is set to **ollama**
- **CUSTOM_LLM_URL=[Custom OpenAI Compatible URL]**: Provide this if **LLM** is set to **custom**
- **CUSTOM_LLM_API_KEY=[Custom OpenAI Compatible API KEY]**: Provide this if **LLM** is set to **custom**
- **CUSTOM_MODEL=[Custom Model ID]**: Provide this if **LLM** is set to **custom**
- **TOOL_CALLS=[Enable/Disable Tool Calls on Custom LLM]**: If **true**, **LLM** will use Tool Call instead of Json Schema for Structured Output.
- **DISABLE_THINKING=[Enable/Disable Thinking on Custom LLM]**: If **true**, Thinking will be disabled.
- **WEB_GROUNDING=[Enable/Disable Web Search for OpenAI, Google And Anthropic]**: If **true**, LLM will be able to search web for better results.

You can also set the following environment variables to customize the image generation provider and API keys:

- **DISABLE_IMAGE_GENERATION**: If **true**, Image Generation will be disabled for slides.
- **IMAGE_PROVIDER=[dall-e-3/gpt-image-1.5/gemini_flash/nanobanana_pro/pexels/pixabay/comfyui]**: Select the image provider of your choice.
  - Required if **DISABLE_IMAGE_GENERATION** is not set to **true**.
- **OPENAI_API_KEY=[Your OpenAI API Key]**: Required if using **dall-e-3** or **gpt-image-1.5** as the image provider.
- **DALL_E_3_QUALITY=[standard/hd]**: Optional quality setting for **dall-e-3** (default: `standard`).
- **GPT_IMAGE_1_5_QUALITY=[low/medium/high]**: Optional quality setting for **gpt-image-1.5** (default: `medium`).
- **GOOGLE_API_KEY=[Your Google API Key]**: Required if using **gemini_flash** or **nanobanana_pro** as the image provider.
- **PEXELS_API_KEY=[Your Pexels API Key]**: Required if using **pexels** as the image provider.
- **PIXABAY_API_KEY=[Your Pixabay API Key]**: Required if using **pixabay** as the image provider.
- **COMFYUI_URL=[Your ComfyUI server URL]** and **COMFYUI_WORKFLOW=[Workflow JSON]**: Required if using **comfyui** to route prompts to a self-hosted ComfyUI workflow.

You can disable anonymous telemetry using the following environment variable:

- **DISABLE_ANONYMOUS_TELEMETRY=[true/false]**: Set this to **true** to disable anonymous telemetry.

> **Note:** You can freely choose both the LLM (text generation) and the image provider. Supported image providers: **dall-e-3**, **gpt-image-1.5** (OpenAI), **gemini_flash**, **nanobanana_pro** (Google), **pexels**, **pixabay**, and **comfyui** (self-hosted).

### Using OpenAI

```bash
docker run -it --name presenton -p 5000:80 -e LLM="openai" -e OPENAI_API_KEY="******" -e IMAGE_PROVIDER="dall-e-3" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

### Using Google

```bash
docker run -it --name presenton -p 5000:80 -e LLM="google" -e GOOGLE_API_KEY="******" -e IMAGE_PROVIDER="gemini_flash" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

### Using Ollama

```bash
docker run -it --name presenton -p 5000:80 -e LLM="ollama" -e OLLAMA_MODEL="llama3.2:3b" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="*******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

### Using Anthropic

```bash
docker run -it --name presenton -p 5000:80 -e LLM="anthropic" -e ANTHROPIC_API_KEY="******" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

### Using OpenAI Compatible API

```bash
docker run -it -p 5000:80 -e CAN_CHANGE_KEYS="false"  -e LLM="custom" -e CUSTOM_LLM_URL="http://*****" -e CUSTOM_LLM_API_KEY="*****" -e CUSTOM_MODEL="llama3.2:3b" -e IMAGE_PROVIDER="pexels" -e  PEXELS_API_KEY="********" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

#### Running Presenton with GPU Support

To use GPU acceleration with Ollama models, you need to install and configure the NVIDIA Container Toolkit. This allows Docker containers to access your NVIDIA GPU.

Once the NVIDIA Container Toolkit is installed and configured, you can run Presenton with GPU support by adding the `--gpus=all` flag:

```bash
docker run -it --name presenton --gpus=all -p 5000:80 -e LLM="ollama" -e OLLAMA_MODEL="llama3.2:3b" -e IMAGE_PROVIDER="pexels" -e PEXELS_API_KEY="*******" -e CAN_CHANGE_KEYS="false" -v "./app_data:/app_data" ghcr.io/presenton/presenton:latest
```

> **Note:** GPU acceleration significantly improves the performance of Ollama models, especially for larger models. Make sure you have sufficient GPU memory for your chosen model.

## Generate Presentation over API

### Generate Presentation

Endpoint: `/api/v1/ppt/presentation/generate`

Method: `POST`

Content-Type: `application/json`

#### Request Body

| Parameter                 | Type             | Required | Description                                                                                                                                      |
| ------------------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| content                   | string           | Yes      | The content for generating the presentation                                                                                                      |
| slides_markdown           | string[] \| null | No       | The markdown for the slides                                                                                                                      |
| instructions              | string \| null   | No       | The instruction for generating the presentation                                                                                                  |
| tone                      | string           | No       | The tone to use for the text (default: "default"). Available options: "default", "casual", "professional", "funny", "educational", "sales_pitch" |
| verbosity                 | string           | No       | How verbose the text should be (default: "standard"). Available options: "concise", "standard", "text-heavy"                                     |
| web_search                | boolean          | No       | Whether to enable web search (default: false)                                                                                                    |
| n_slides                  | integer          | No       | Number of slides to generate (default: 8)                                                                                                        |
| language                  | string           | No       | Language for the presentation (default: "English")                                                                                               |
| template                  | string           | No       | Template to use for the presentation (default: "general")                                                                                        |
| include_table_of_contents | boolean          | No       | Whether to include a table of contents (default: false)                                                                                          |
| include_title_slide       | boolean          | No       | Whether to include a title slide (default: true)                                                                                                 |
| files                     | string[] \| null | No       | Files to use for the presentation. Use /api/v1/ppt/files/upload to upload files                                                                  |
| export_as                 | string           | No       | Export format (default: "pptx"). Available options: "pptx", "pdf"                                                                                |

#### Response

```json
{
  "presentation_id": "string",
  "path": "string",
  "edit_path": "string"
}
```

#### Example Request

```bash
curl -X POST http://localhost:5000/api/v1/ppt/presentation/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Introduction to Machine Learning",
    "n_slides": 5,
    "language": "English",
    "template": "general",
    "export_as": "pptx"
  }'
```

#### Example Response

```json
{
  "presentation_id": "d3000f96-096c-4768-b67b-e99aed029b57",
  "path": "/app_data/d3000f96-096c-4768-b67b-e99aed029b57/Introduction_to_Machine_Learning.pptx",
  "edit_path": "/presentation?id=d3000f96-096c-4768-b67b-e99aed029b57"
}
```

> **Note:** Make sure to prepend your server's root URL to the path and edit_path fields in the response to construct valid links.

For detailed info checkout [API documentation](https://docs.presenton.ai/using-presenton-api).

### API Tutorials

- [Generate Presentations via API in 5 minutes](https://docs.presenton.ai/tutorial/generate-presentation-over-api)
- [Create Presentations from CSV using AI](https://docs.presenton.ai/tutorial/generate-presentation-from-csv)
- [Create Data Reports Using AI](https://docs.presenton.ai/tutorial/create-data-reports-using-ai)

## Roadmap

- [x] Support for custom HTML templates by developers
- [x] Support for accessing custom templates over API
- [x] Implement MCP server
- [ ] Ability for users to change system prompt
- [x] Support external SQL database

## UI Features

### 1. Add prompt, select number of slides and language

![Demo](readme_assets/images/prompting.png)

### 2. Select theme

![Demo](readme_assets/images/select-theme.png)

### 3. Review and edit outline

![Demo](readme_assets/images/outline.png)

### 4. Select theme

![Demo](readme_assets/images/select-theme.png)

### 5. Present on app

![Demo](readme_assets/images/present.png)

### 6. Change theme

![Demo](readme_assets/images/change-theme.png)

### 7. Export presentation as PDF and PPTX

![Demo](readme_assets/images/export-presentation.png)

## Community

[Discord](https://discord.gg/9ZsKKxudNE)

## License

Apache 2.0
# presenton1
