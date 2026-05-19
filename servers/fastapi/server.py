import uvicorn
import argparse
import os
from api.main import app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the FastAPI server")
    parser.add_argument(
        "--port", type=int, required=True, help="Port number to run the server on"
    )
    parser.add_argument(
        "--reload", type=str, default="false", help="Reload the server on code changes"
    )
    args = parser.parse_args()
    reload = args.reload == "true"
    host = "127.0.0.1"

    # Internal service-to-service URL (loopback inside container; not browser-facing).
    # NEXT_PUBLIC_FAST_API is intentionally NOT set here so that Docker/reverse-proxy
    # deployments return path-only asset URLs (/app_data/...) instead of absolute
    # http://127.0.0.1:8000/... URLs that browsers cannot reach.
    os.environ["FAST_API_INTERNAL_URL"] = f"http://{host}:{args.port}"
    
    uvicorn.run(
        "api.main:app",
        host=host,
        port=args.port,
        log_level="info",
        reload=reload,
    )