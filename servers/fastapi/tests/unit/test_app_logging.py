import io
import logging

from api.lifespan import _configure_application_logging


def test_configure_application_logging_reuses_uvicorn_terminal_handler(monkeypatch):
    root_logger = logging.getLogger()
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_error_logger = logging.getLogger("uvicorn.error")

    original_root_handlers = list(root_logger.handlers)
    original_root_level = root_logger.level
    original_uvicorn_handlers = list(uvicorn_logger.handlers)
    original_uvicorn_propagate = uvicorn_logger.propagate
    original_uvicorn_error_handlers = list(uvicorn_error_logger.handlers)
    original_uvicorn_error_propagate = uvicorn_error_logger.propagate

    stream = io.StringIO()
    terminal_handler = logging.StreamHandler(stream)
    terminal_handler.setFormatter(logging.Formatter("%(message)s"))

    try:
        root_logger.handlers.clear()
        uvicorn_logger.handlers[:] = [terminal_handler]
        uvicorn_logger.propagate = False
        uvicorn_error_logger.handlers.clear()
        uvicorn_error_logger.propagate = True
        monkeypatch.setenv("LOG_LEVEL", "INFO")

        _configure_application_logging()
        logging.getLogger("templates.v2.generation").info("visible progress log")

        assert terminal_handler in root_logger.handlers
        assert root_logger.level == logging.INFO
        assert "visible progress log" in stream.getvalue()
    finally:
        root_logger.handlers[:] = original_root_handlers
        root_logger.setLevel(original_root_level)
        uvicorn_logger.handlers[:] = original_uvicorn_handlers
        uvicorn_logger.propagate = original_uvicorn_propagate
        uvicorn_error_logger.handlers[:] = original_uvicorn_error_handlers
        uvicorn_error_logger.propagate = original_uvicorn_error_propagate
