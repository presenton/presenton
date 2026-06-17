import hashlib

MAX_EXPORT_BASENAME_BYTES = 200


def safe_export_basename(name: str, max_bytes: int = MAX_EXPORT_BASENAME_BYTES) -> str:
    name = (name or "").strip() or "presentation"

    encoded = name.encode("utf-8")

    if len(encoded) <= max_bytes:
        return name

    suffix = hashlib.md5(encoded).hexdigest()[:8]
    budget = max_bytes - len(suffix) - 1
    truncated = encoded[:budget].decode("utf-8", errors="ignore").rstrip()

    return f"{truncated}_{suffix}" if truncated else suffix
