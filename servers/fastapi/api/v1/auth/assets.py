from urllib.parse import unquote, urlsplit
import uuid


PRIVATE_APP_DATA_ROOTS = {
    "images",
    "exports",
    "uploads",
    "pptx-to-html",
    "pptx-to-json",
}
SHARED_APP_DATA_ROOTS = {"fonts", "templates"}


def normalized_app_data_parts(path_or_uri: str) -> tuple[str, ...] | None:
    """Return a traversal-safe app_data path split into URL path segments."""
    if not isinstance(path_or_uri, str) or not path_or_uri:
        return None

    try:
        path = urlsplit(path_or_uri).path
    except ValueError:
        return None

    # Proxies and ASGI servers do not all expose encoded paths consistently.
    # Decode repeatedly, with a hard cap that fails closed for pathological
    # nesting, so encoded traversal cannot cross this boundary.
    for _ in range(8):
        decoded = unquote(path)
        if decoded == path:
            break
        path = decoded
    else:
        if unquote(path) != path:
            return None

    if "\x00" in path or "\\" in path or not path.startswith("/app_data/"):
        return None

    parts = tuple(path.split("/")[2:])
    if not parts or any(part in {"", ".", ".."} for part in parts):
        return None
    return parts


def is_app_data_path_authorized(
    path_or_uri: str,
    *,
    user_id: uuid.UUID,
    is_admin: bool,
) -> bool:
    """Authorize a browser-visible app_data path for one authenticated user."""
    parts = normalized_app_data_parts(path_or_uri)
    if not parts:
        return False

    root = parts[0]
    if root in SHARED_APP_DATA_ROOTS:
        return True
    if root not in PRIVATE_APP_DATA_ROOTS or len(parts) < 2:
        return False

    relative_parts = parts[1:]
    if relative_parts[0] == "users":
        return (
            len(relative_parts) >= 3
            and relative_parts[1] == str(user_id)
        )

    # Pre-multi-user assets remain in the legacy root and belong only to the
    # migrated primary administrator.
    return is_admin
