import asyncio
import os
import sys
from types import SimpleNamespace

from fastapi import HTTPException
from services.export_task_service import ExportTaskService
from services.liteparse_service import LiteParseService
from utils.runtime_limits import BoundedTextBuffer


def test_bounded_text_buffer_keeps_only_tail():
    buffer = BoundedTextBuffer(limit=5)
    buffer.append("abcdef")
    buffer.append("gh")

    value = buffer.get()

    assert "defgh" in value
    assert "truncated 3 chars" in value


def test_liteparse_plain_bridge_keeps_stdout_and_bounds_stderr(tmp_path):
    service = LiteParseService(timeout_seconds=10)
    service._npm_project_root = str(tmp_path)

    process = service._run_plain_bridge_to_text(
        [
            sys.executable,
            "-c",
            "import sys; sys.stdout.write('x' * 5000); sys.stderr.write('e' * 10000)",
        ]
    )

    assert process.returncode == 0
    assert len(process.stdout) == 5000
    assert "truncated" in process.stderr


def test_export_child_output_is_bounded(tmp_path):
    service = ExportTaskService(timeout_seconds=10)

    result = asyncio.run(
        service._run_bounded_child(
            [
                sys.executable,
                "-c",
                "import sys; sys.stdout.write('o' * 10000); sys.stderr.write('e' * 10000); sys.exit(7)",
            ],
            cwd=str(tmp_path),
            env=os.environ.copy(),
            timeout=10,
        )
    )

    assert result["returncode"] == 7
    assert "truncated" in str(result["stdout"])
    assert "truncated" in str(result["stderr"])


def test_export_node_env_recreates_puppeteer_directories(monkeypatch, tmp_path):
    app_data = tmp_path / "app-data"
    temp_dir = tmp_path / "temp"
    puppeteer_temp = temp_dir / "puppeteer"
    puppeteer_cache = tmp_path / "cache" / "puppeteer"
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))
    monkeypatch.setenv("TEMP_DIRECTORY", str(temp_dir))
    monkeypatch.delenv("NEXT_PUBLIC_FAST_API", raising=False)
    monkeypatch.setenv("PUPPETEER_TMP_DIR", str(puppeteer_temp))
    monkeypatch.setenv("PUPPETEER_CACHE_DIR", str(puppeteer_cache))
    monkeypatch.delenv("PRESENTON_ELECTRON", raising=False)

    service = ExportTaskService(timeout_seconds=10)
    env = service._build_node_env()

    assert env["PUPPETEER_TMP_DIR"] == str(puppeteer_temp)
    assert env["PUPPETEER_CACHE_DIR"] == str(puppeteer_cache)
    assert env["ASSETS_BASE_URL"] == "/app_data"
    assert puppeteer_temp.is_dir()
    assert puppeteer_cache.is_dir()

    puppeteer_temp.rmdir()
    puppeteer_cache.rmdir()

    service._build_node_env()

    assert puppeteer_temp.is_dir()
    assert puppeteer_cache.is_dir()


def test_electron_export_requires_pinned_chromium(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(tmp_path / "app-data"))
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path / "temp"))
    monkeypatch.setenv("PRESENTON_ELECTRON", "true")
    monkeypatch.delenv("PUPPETEER_EXECUTABLE_PATH", raising=False)

    service = ExportTaskService(timeout_seconds=10)

    try:
        service._build_node_env()
        assert False, "Expected the Electron Chromium guard to reject a missing browser"
    except HTTPException as exc:
        assert exc.status_code == 500
        assert "Refusing to download" in exc.detail


def test_electron_export_preserves_valid_pinned_chromium(monkeypatch, tmp_path):
    chromium = tmp_path / "chrome.exe"
    chromium.write_bytes(b"chrome")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(tmp_path / "app-data"))
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path / "temp"))
    monkeypatch.setenv("PRESENTON_ELECTRON", "true")
    monkeypatch.setenv("PUPPETEER_EXECUTABLE_PATH", str(chromium))

    env = ExportTaskService(timeout_seconds=10)._build_node_env()

    assert env["PUPPETEER_EXECUTABLE_PATH"] == str(chromium)


def test_export_output_path_accepts_file_path_key(monkeypatch, tmp_path):
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    output_path = tmp_path / "preview.png"
    output_path.write_bytes(b"png")

    assert ExportTaskService._resolve_output_path({"file_path": str(output_path)}) == str(
        output_path
    )


def test_render_html_to_image_sends_html_task_payload(monkeypatch, tmp_path):
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    output_path = tmp_path / "preview.png"
    output_path.write_bytes(b"png")
    service = ExportTaskService(timeout_seconds=10)
    captured = {}

    async def fake_run_task(task_payload, response_error_detail):
        captured["task_payload"] = task_payload
        captured["response_error_detail"] = response_error_detail
        return {"file_path": str(output_path)}

    service._run_task = fake_run_task

    result = asyncio.run(service.render_html_to_image("<html></html>", 320, 180))

    assert result.path == str(output_path)
    assert captured["task_payload"] == {
        "type": "html-to-image",
        "html": "<html></html>",
        "width": 320,
        "height": 180,
    }
    assert "HTML-to-image" in captured["response_error_detail"]


def test_render_json_to_image_sends_json_task_payload(monkeypatch, tmp_path):
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    output_path = tmp_path / "preview.png"
    output_path.write_bytes(b"png")
    service = ExportTaskService(timeout_seconds=10)
    captured = {}

    async def fake_run_task(task_payload, response_error_detail):
        captured["task_payload"] = task_payload
        captured["response_error_detail"] = response_error_detail
        return {"file_path": str(output_path)}

    service._run_task = fake_run_task
    data = [{"type": "text", "runs": [{"text": "Preview"}]}]

    result = asyncio.run(
        service.render_json_to_image(
            data,
            1280,
            720,
            fonts={"Inter": "https://example.com/inter.css"},
        )
    )

    assert result.path == str(output_path)
    assert captured["task_payload"] == {
        "type": "json-to-image",
        "data": data,
        "width": 1280,
        "height": 720,
        "fonts": {"Inter": "https://example.com/inter.css"},
    }
    assert "JSON-to-image" in captured["response_error_detail"]


def test_render_json_to_image_embeds_protected_local_assets(monkeypatch, tmp_path):
    app_data = tmp_path / "app-data"
    asset_path = app_data / "pptx-to-json" / "session" / "images" / "photo.svg"
    asset_path.parent.mkdir(parents=True)
    asset_path.write_text("<svg></svg>", encoding="utf-8")
    output_path = tmp_path / "preview.png"
    output_path.write_bytes(b"png")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    monkeypatch.setenv("DISABLE_AUTH", "true")

    service = ExportTaskService(timeout_seconds=10)
    captured = {}

    async def fake_run_task(task_payload, response_error_detail):
        captured["task_payload"] = task_payload
        return {"file_path": str(output_path)}

    service._run_task = fake_run_task
    local_url = (
        "http://127.0.0.1:8000/app_data/pptx-to-json/"
        "session/images/photo.svg"
    )
    external_url = "https://example.com/photo.png"
    data = [
        {
            "type": "group",
            "children": [
                {"type": "image", "data": local_url},
                {"type": "image", "data": external_url},
            ],
        }
    ]

    asyncio.run(service.render_json_to_image(data, 1280, 720))

    rendered_children = captured["task_payload"]["data"][0]["children"]
    assert rendered_children[0]["data"].startswith("data:image/svg+xml;base64,")
    assert rendered_children[1]["data"] == external_url
    assert data[0]["children"][0]["data"] == local_url


def test_render_htmls_to_images_sends_batch_task_payload(monkeypatch, tmp_path):
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    output_paths = [tmp_path / "preview-1.png", tmp_path / "preview-2.png"]
    for output_path in output_paths:
        output_path.write_bytes(b"png")
    service = ExportTaskService(timeout_seconds=10)
    captured = {}

    async def fake_run_task(task_payload, response_error_detail):
        captured["task_payload"] = task_payload
        captured["response_error_detail"] = response_error_detail
        return {"file_paths": [str(path) for path in output_paths]}

    service._run_task = fake_run_task

    result = asyncio.run(
        service.render_htmls_to_images(["<html>1</html>", "<html>2</html>"], 320, 180)
    )

    assert result.paths == [str(path) for path in output_paths]
    assert captured["task_payload"] == {
        "type": "html-to-images",
        "htmls": ["<html>1</html>", "<html>2</html>"],
        "width": 320,
        "height": 180,
    }
    assert "HTML-to-images" in captured["response_error_detail"]


def test_render_htmls_to_images_falls_back_for_older_runtime(tmp_path):
    output_paths = [tmp_path / "preview-1.png", tmp_path / "preview-2.png"]
    for output_path in output_paths:
        output_path.write_bytes(b"png")
    service = ExportTaskService(timeout_seconds=10)
    rendered_htmls = []

    async def fake_run_task(_task_payload, _response_error_detail):
        raise HTTPException(status_code=500, detail="Export task failed: Invalid task type")

    async def fake_render_html_to_image(html, width, height):
        rendered_htmls.append((html, width, height))
        return SimpleNamespace(path=str(output_paths[len(rendered_htmls) - 1]))

    service._run_task = fake_run_task
    service.render_html_to_image = fake_render_html_to_image

    result = asyncio.run(
        service.render_htmls_to_images(["<html>1</html>", "<html>2</html>"], 320, 180)
    )

    assert result.paths == [str(path) for path in output_paths]
    assert rendered_htmls == [
        ("<html>1</html>", 320, 180),
        ("<html>2</html>", 320, 180),
    ]


def test_render_htmls_to_images_falls_back_when_batch_render_fails(tmp_path):
    output_paths = [tmp_path / "preview-1.png", tmp_path / "preview-2.png"]
    for output_path in output_paths:
        output_path.write_bytes(b"png")
    service = ExportTaskService(timeout_seconds=10)
    rendered_htmls = []

    async def fake_run_task(_task_payload, _response_error_detail):
        raise HTTPException(
            status_code=500,
            detail=(
                "Export task failed. returncode=244 stderr="
                "[index] Failed to render HTML to images stdout="
            ),
        )

    async def fake_render_html_to_image(html, width, height):
        rendered_htmls.append((html, width, height))
        return SimpleNamespace(path=str(output_paths[len(rendered_htmls) - 1]))

    service._run_task = fake_run_task
    service.render_html_to_image = fake_render_html_to_image

    result = asyncio.run(
        service.render_htmls_to_images(["<html>1</html>", "<html>2</html>"], 320, 180)
    )

    assert result.paths == [str(path) for path in output_paths]
    assert rendered_htmls == [
        ("<html>1</html>", 320, 180),
        ("<html>2</html>", 320, 180),
    ]


def test_export_converter_resolver_accepts_linux_amd64_name(tmp_path, monkeypatch):
    monkeypatch.delenv("BUILT_PYTHON_MODULE_PATH", raising=False)
    monkeypatch.setattr("services.export_task_service.sys_platform", lambda: "linux")
    monkeypatch.setattr("services.export_task_service.sys_arch", lambda: "x64")
    converter = tmp_path / "py" / "convert-linux-amd64"
    converter.parent.mkdir()
    converter.write_text("binary")

    assert ExportTaskService._resolve_converter_path(str(tmp_path)) == str(converter)


def test_export_converter_resolver_prefers_existing_configured_path(
    tmp_path, monkeypatch
):
    configured = tmp_path / "custom-converter"
    configured.write_text("binary")
    converter = tmp_path / "py" / "convert-linux-x64"
    converter.parent.mkdir()
    converter.write_text("binary")
    monkeypatch.setenv("BUILT_PYTHON_MODULE_PATH", str(configured))

    assert ExportTaskService._resolve_converter_path(str(tmp_path)) == str(configured)
