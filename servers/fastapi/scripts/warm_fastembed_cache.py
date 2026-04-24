from pathlib import Path
import sys


FASTAPI_ROOT = Path(__file__).resolve().parents[1]
if str(FASTAPI_ROOT) not in sys.path:
    sys.path.insert(0, str(FASTAPI_ROOT))


from services.icon_finder_service import ICON_FINDER_SERVICE


def main() -> None:
    if not ICON_FINDER_SERVICE.ensure_initialized():
        raise RuntimeError("Failed to prepare fastembed cache for icon search")

    print(
        f"Fastembed cache prepared at {ICON_FINDER_SERVICE.cache_directory}"
    )


if __name__ == "__main__":
    main()
