import uvicorn
import argparse

if __name__ == "__main__":
    import os
    default_port = int(os.getenv("PORT", 8080))
    
    parser = argparse.ArgumentParser(description="Run the FastAPI server")
    parser.add_argument(
        "--port", type=int, default=default_port, help="Port number to run the server on"
    )
    parser.add_argument(
        "--reload", type=str, default="false", help="Reload the server on code changes"
    )
    args = parser.parse_args()
    reload = args.reload == "true"
    
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=args.port,
        log_level="info",
        reload=reload,
    )
