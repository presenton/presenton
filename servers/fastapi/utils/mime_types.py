import mimetypes


_EXPLICIT_MIME_TYPES = {
    ".avif": "image/avif",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".otf": "font/otf",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def init_sandbox_safe_mimetypes() -> None:
    """
    Initialize MIME type lookup without reading OS MIME databases.

    macOS App Store sandboxed builds can be denied access to files such as
    /etc/apache2/mime.types. Starlette's FileResponse calls mimetypes.guess_type
    lazily while serving /static and /app_data, so initialize the stdlib MIME
    table from Python's bundled defaults before the first static file response.
    """
    knownfiles = mimetypes.knownfiles
    try:
        mimetypes.knownfiles = []
        mimetypes.init(files=[])
    finally:
        mimetypes.knownfiles = knownfiles

    for extension, media_type in _EXPLICIT_MIME_TYPES.items():
        mimetypes.add_type(media_type, extension, strict=True)
