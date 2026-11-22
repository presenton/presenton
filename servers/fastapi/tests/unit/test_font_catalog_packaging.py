import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

from templates import pptx_font_utils


def test_font_catalog_loads_outside_backend_working_directory(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    pptx_font_utils.get_static_font_catalog.cache_clear()
    assert pptx_font_utils.get_static_font_url("DM Sans") == (
        "/vendor/fonts/sans_serif/dmsans/DMSans[opsz,wght].ttf"
    )
    assert pptx_font_utils.get_static_font_url("Not A Real Font") is None


def test_wheel_contains_and_loads_font_catalog_without_source_tree(tmp_path):
    backend = Path(__file__).resolve().parents[2]
    source = tmp_path / "backend"
    source.mkdir()
    # Build the real templates package with the production packaging configuration.
    shutil.copytree(
        backend / "templates",
        source / "templates",
        ignore=shutil.ignore_patterns("__pycache__"),
    )
    for name in ("pyproject.toml", "LICENSE", "NOTICE"):
        shutil.copyfile(backend / name, source / name)
    wheels = tmp_path / "wheels"
    subprocess.run(
        [
            sys.executable,
            "-c",
            "from setuptools.build_meta import build_wheel; "
            f"build_wheel({str(wheels)!r})",
        ],
        cwd=source,
        check=True,
        capture_output=True,
        text=True,
    )
    (wheel,) = wheels.glob("*.whl")
    with zipfile.ZipFile(wheel) as archive:
        assert "templates/assets/fonts.json" in archive.namelist()

    # Load directly from the wheel in a fresh process so neither pytest's imports
    # nor the backend checkout can supply the missing catalog by accident.
    result = subprocess.run(
        [sys.executable, "-c", r"""
import json
from templates import pptx_font_utils
assert '.whl/' in pptx_font_utils.__file__.replace('\\', '/')
print(json.dumps(pptx_font_utils.get_static_font_catalog()))
"""],
        cwd=tmp_path,
        env={**os.environ, "PYTHONPATH": str(wheel)},
        check=True,
        capture_output=True,
        text=True,
    )
    catalog = json.loads(result.stdout)
    assert catalog["dm sans"][1] == (
        "/vendor/fonts/sans_serif/dmsans/DMSans[opsz,wght].ttf"
    )
    assert "not a real font" not in catalog
