import logging
import os

from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sentry_sdk
from api.lifespan import app_lifespan
from api.middlewares import UserConfigEnvUpdateMiddleware
from api.v1.ppt.router import API_V1_PPT_ROUTER
from api.v1.webhook.router import API_V1_WEBHOOK_ROUTER
from api.v1.mock.router import API_V1_MOCK_ROUTER
from utils.get_env import (
    get_app_data_directory_env,
    get_sentry_send_default_pii_env,
    get_sentry_traces_sample_rate_env,
)
from utils.path_helpers import get_resource_path

FASTAPI_SENTRY_DSN = "https://a7831b44cb7096645e4b7569f53d070c@o4509882707410944.ingest.us.sentry.io/4511171447947264"





def _get_sentry_traces_sample_rate() -> float:
    traces_sample_rate = get_sentry_traces_sample_rate_env()
    if traces_sample_rate is None:
        return 1.0

    try:
        return float(traces_sample_rate)
    except ValueError:
        return 1.0


def _get_sentry_send_default_pii() -> bool:
    send_default_pii = get_sentry_send_default_pii_env()
    if send_default_pii is None:
        return True

    return send_default_pii.lower() == "true"


sentry_sdk.init(
    dsn=FASTAPI_SENTRY_DSN,
    send_default_pii=_get_sentry_send_default_pii(),
    traces_sample_rate=_get_sentry_traces_sample_rate(),
)


app = FastAPI(lifespan=app_lifespan)


# Routers
app.include_router(API_V1_PPT_ROUTER)
app.include_router(API_V1_WEBHOOK_ROUTER)
app.include_router(API_V1_MOCK_ROUTER)

# Mount app_data directory as static files
app_data_dir = get_app_data_directory_env()
if app_data_dir:
    os.makedirs(app_data_dir, exist_ok=True)
    app.mount("/app_data", StaticFiles(directory=app_data_dir), name="app_data")

# Mount static directory for icons, placeholder images, etc.
static_dir = get_resource_path("static")
print(f"[FastAPI] Static directory path: {static_dir}")
print(f"[FastAPI] Static directory exists: {os.path.exists(static_dir)}")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    print(f"[FastAPI] Static files mounted successfully from {static_dir}")
else:
    print(f"[FastAPI] WARNING: Static directory not found at {static_dir}")

# Middlewares
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(UserConfigEnvUpdateMiddleware)
