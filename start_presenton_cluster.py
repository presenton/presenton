import os
import shutil
import subprocess
from pathlib import Path

from dotenv import load_dotenv


ELAGENTE_ROOT = Path("/h/327/chlyahad/Elagente")
PRESENTON_ROOT = ELAGENTE_ROOT / "presenton"
PRESENTON_BACKEND = PRESENTON_ROOT / "servers" / "fastapi"

EXPORT_ROOT = PRESENTON_ROOT / "presentation-export"
EXPORT_RUNTIME = EXPORT_ROOT / "index.cjs"
EXPORT_CONVERTER = EXPORT_ROOT / "py" / "convert-linux-x64"

APP_DATA = PRESENTON_ROOT / "app_data"
TEMP_DIRECTORY = PRESENTON_ROOT / "tmp"

NEXTJS_URL = "http://127.0.0.1:3000"


def find_node() -> Path:
    """Find Node.js from PATH or known NVM installations."""
    node_from_path = shutil.which("node")
    if node_from_path:
        return Path(node_from_path).resolve()

    nvm_roots = [
        ELAGENTE_ROOT / "nvm" / "versions" / "node",
        Path.home() / ".nvm" / "versions" / "node",
    ]

    candidates = []
    for nvm_root in nvm_roots:
        candidates.extend(nvm_root.glob("v*/bin/node"))

    candidates.sort(
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )

    if candidates:
        return candidates[0].resolve()

    raise SystemExit("ERROR: Node.js was not found in PATH or NVM")


def find_chrome() -> Path:
    """Find the newest Chrome installation downloaded by Puppeteer."""
    chrome_root = Path.home() / ".cache" / "puppeteer" / "chrome"

    candidates = list(
        chrome_root.glob("linux-*/chrome-linux64/chrome")
    )
    candidates.sort(
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )

    if candidates:
        return candidates[0].resolve()

    raise SystemExit(
        f"ERROR: Puppeteer Chrome was not found under {chrome_root}"
    )


def require_file(path: Path, description: str) -> None:
    if not path.is_file():
        raise SystemExit(f"ERROR: {description} not found: {path}")


env_candidates = [
    ELAGENTE_ROOT / ".env",
    ELAGENTE_ROOT / "ElAgente" / ".env",
]

env_file = next((path for path in env_candidates if path.is_file()), None)
if env_file is None:
    raise SystemExit(
        "ERROR: Could not find .env in:\n"
        + "\n".join(str(path) for path in env_candidates)
    )

print(f"Loading env from: {env_file}")
load_dotenv(env_file, override=True)

if not os.getenv("OPENAI_API_KEY"):
    raise SystemExit("ERROR: OPENAI_API_KEY was not loaded from .env")

require_file(EXPORT_RUNTIME, "Export runtime")
require_file(EXPORT_CONVERTER, "Export converter")

EXPORT_CONVERTER.chmod(EXPORT_CONVERTER.stat().st_mode | 0o111)

node_path = find_node()
node_directory = node_path.parent

os.environ["PATH"] = (
    str(node_directory)
    + os.pathsep
    + os.environ.get("PATH", "")
)
os.environ["NODE_BINARY"] = str(node_path)

npm_path = shutil.which("npm")
if not npm_path:
    raise SystemExit(
        f"ERROR: npm was not found after adding Node directory: {node_directory}"
    )

chrome_path = find_chrome()
chrome_path.chmod(chrome_path.stat().st_mode | 0o111)

# Chromium's native libraries are installed in Miniforge base.
miniforge_base_lib = Path("/h/327/chlyahad/miniforge3/lib")
if not miniforge_base_lib.is_dir():
    raise SystemExit(
        f"ERROR: Miniforge base libraries not found: {miniforge_base_lib}"
    )

library_paths = [str(miniforge_base_lib)]

# Preserve libraries from the active Conda environment as a secondary source.
conda_prefix = os.getenv("CONDA_PREFIX")
if conda_prefix:
    conda_lib = Path(conda_prefix) / "lib"
    if conda_lib.is_dir():
        library_paths.append(str(conda_lib))

existing_library_path = os.environ.get("LD_LIBRARY_PATH", "")
if existing_library_path:
    library_paths.append(existing_library_path)

os.environ["LD_LIBRARY_PATH"] = os.pathsep.join(library_paths)

# Fail immediately if Chromium still has unresolved native dependencies.
chrome_check = subprocess.run(
    ["ldd", str(chrome_path)],
    capture_output=True,
    text=True,
    env=os.environ.copy(),
    check=True,
)

missing_libraries = [
    line.strip()
    for line in chrome_check.stdout.splitlines()
    if "not found" in line
]

if missing_libraries:
    raise SystemExit(
        "ERROR: Chrome requires missing libraries:\n"
        + "\n".join(missing_libraries)
    )

directories = [
    APP_DATA,
    TEMP_DIRECTORY,
    TEMP_DIRECTORY / "chromium-config",
    TEMP_DIRECTORY / "chromium-cache",
    TEMP_DIRECTORY / "chromium-profile",
    APP_DATA / "exports",
    APP_DATA / "images",
    APP_DATA / "uploads",
    APP_DATA / "fonts",
    APP_DATA / "pptx-to-html",
]

for directory in directories:
    directory.mkdir(parents=True, exist_ok=True)

os.environ["APP_DATA_DIRECTORY"] = str(APP_DATA)
os.environ["TEMP_DIRECTORY"] = str(TEMP_DIRECTORY)
os.environ["USER_CONFIG_PATH"] = str(APP_DATA / "userConfig.json")
os.environ["MIGRATE_DATABASE_ON_STARTUP"] = "true"

# The export runtime opens Next.js pages to inspect template schemas.
os.environ["NEXT_PUBLIC_URL"] = NEXTJS_URL

os.environ["PRESENTON_APP_ROOT"] = str(PRESENTON_ROOT)
os.environ["EXPORT_PACKAGE_ROOT"] = str(EXPORT_ROOT)
os.environ["EXPORT_RUNTIME_DIR"] = str(EXPORT_ROOT)
os.environ["BUILT_PYTHON_MODULE_PATH"] = str(EXPORT_CONVERTER)

os.environ["PUPPETEER_EXECUTABLE_PATH"] = str(chrome_path)
os.environ["PUPPETEER_SKIP_DOWNLOAD"] = "true"
os.environ["XDG_CONFIG_HOME"] = str(TEMP_DIRECTORY / "chromium-config")
os.environ["XDG_CACHE_HOME"] = str(TEMP_DIRECTORY / "chromium-cache")

# Presenton is bound to localhost and used only by ElAgente.
os.environ["DISABLE_AUTH"] = "true"

os.environ.pop("AUTH_USERNAME", None)
os.environ.pop("AUTH_PASSWORD", None)
os.environ.pop("AUTH_OVERRIDE_FROM_ENV", None)

os.environ.setdefault("LLM", "openai")
os.environ.setdefault("OPENAI_MODEL", "gpt-4.1")
os.environ.setdefault("DISABLE_IMAGE_GENERATION", "true")
os.environ.setdefault("CAN_CHANGE_KEYS", "false")
os.environ.setdefault("MEM0_REQUIRE_SPACY_MODEL", "false")
os.environ.setdefault("LOG_LEVEL", "INFO")

print("OPENAI_API_KEY loaded: True")
print("Node binary:", node_path)
print("npm binary:", npm_path)
print("Chrome binary:", chrome_path)
print("Chrome native libraries: OK")
print("LD_LIBRARY_PATH:", os.environ["LD_LIBRARY_PATH"])
print("Next.js URL:", NEXTJS_URL)
print("Export runtime:", EXPORT_RUNTIME)
print("Export converter:", EXPORT_CONVERTER)
print("Application data:", APP_DATA)
print("Temporary directory:", TEMP_DIRECTORY)
print("Starting Presenton on 127.0.0.1:8000")

subprocess.run(
    ["python", "server.py", "--port", "8000", "--reload", "false"],
    cwd=PRESENTON_BACKEND,
    env=os.environ.copy(),
    check=True,
)