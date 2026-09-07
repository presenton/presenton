# Presentation generation modes

Presenton supports two presentation-generation workflows:

- **Standard** uses predefined, fixed layouts for consistent and predictable
  results. It includes the outline-review step and supports built-in and custom
  templates.
- **Smart** uses adaptive layouts that respond to the generated content. It
  streams the presentation directly to the editor and does not use the
  template workflow.

Use the `PRESENTATION_GENERATION_MODE` environment variable to choose which
workflow users can access.

## Available options

| Value | Web UI behavior | MCP tools |
| --- | --- | --- |
| `both` | Shows the mode selector. Standard is selected initially, and users can switch to Smart. Template pages remain available. | Exposes Standard, Smart, and template-generation tools. |
| `standard` | Hides the mode selector and always uses Standard. Template pages remain available. | Exposes Standard and template-generation tools. |
| `smart` | Hides the mode selector and always uses Smart. Template and custom-template features are hidden. | Exposes only the Smart generation workflow. |

The default is `both`. An unset, empty, or unrecognized value also falls back
to `both`. Values are case-insensitive and surrounding whitespace is ignored.

> [!NOTE]
> This setting configures the web UI and the tools exposed by Presenton's MCP
> server. It is not an authorization control for the underlying REST API.

## Configure Docker Compose

The repository's `docker-compose.yml` forwards
`PRESENTATION_GENERATION_MODE` to every supported service profile.

Create or update the `.env` file next to `docker-compose.yml`:

```dotenv
# Choose one: both, standard, smart
PRESENTATION_GENERATION_MODE=both
```

Then start the required profile, for example:

```bash
docker compose up production
```

You can also select a mode for a single Compose invocation:

```bash
PRESENTATION_GENERATION_MODE=standard docker compose up production
```

To switch an existing deployment to Smart mode, update `.env` and recreate the
service so both the web application and MCP server receive the new value:

```dotenv
PRESENTATION_GENERATION_MODE=smart
```

```bash
docker compose up -d --force-recreate production
```

## Configure `docker run`

Pass the variable with `-e` when starting the container:

```bash
docker run -it --name presenton \
  -p 5001:80 \
  -e PRESENTATION_GENERATION_MODE=standard \
  -v "./app_data:/app_data" \
  ghcr.io/presenton/presenton:latest
```

Replace `standard` with `smart` or `both` as needed. If the container already
exists, recreate it with the new environment value; changing the host's
environment does not update a running container.

## Configure a source deployment

Set the variable before starting Presenton:

```bash
export PRESENTATION_GENERATION_MODE=both
```

When the Next.js frontend and FastAPI backend run as separate processes or
services, set the same value for both. The frontend uses it to select the UI
experience, while FastAPI uses it to select the MCP tools.

Restart both processes after changing the value. The setting is read from the
server environment and is not a per-user preference.

## Choosing a mode

- Choose `standard` when everyone should use fixed layouts, review outlines,
  or work with Presenton templates.
- Choose `smart` when everyone should use adaptive layouts and proceed directly
  to streamed presentation generation.
- Choose `both` when users should decide per presentation. This is the most
  flexible option and the default configuration.

## Verify the configuration

After restarting Presenton, open the presentation creation page:

- With `both`, a **Standard** or **Smart** mode button appears above the prompt.
- With `standard`, no mode button appears and generation follows the Standard
  outline workflow.
- With `smart`, no mode button appears, generation goes directly to the editor,
  and template navigation is hidden.

If the MCP server is enabled, refresh the MCP client's tool list after the
restart. It should expose only the workflows listed in the table above.

## Troubleshooting

### The mode did not change

Confirm that the variable is set in the environment of the running container
or process, not only in the current shell. Then restart or recreate both the
frontend and backend services.

### The selector still appears

Check the spelling of the value. Only `standard`, `smart`, and `both` are
recognized; any other value falls back to `both`.

### Templates disappeared

This is expected in `smart` mode. Select `standard` or `both` and restart
Presenton to restore template and custom-template features.
