import asyncio
import json
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


def test_export_output_path_accepts_file_path_key(monkeypatch, tmp_path):
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    output_path = tmp_path / "preview.png"
    output_path.write_bytes(b"png")

    assert ExportTaskService._resolve_output_path({"file_path": str(output_path)}) == str(
        output_path
    )


def test_convert_pptx_to_html_resolves_relative_asset_directories(
    monkeypatch,
    tmp_path,
):
    app_data = tmp_path / "app-data"
    artifact_dir = app_data / "pptx-to-html" / "session"
    manifest_path = artifact_dir / "presentation.json"
    (artifact_dir / "images").mkdir(parents=True)
    (artifact_dir / "fonts").mkdir()
    manifest_path.write_text(
        json.dumps(
            {
                "slides": ['<img src="images/asset.png">'],
                "font_css": "",
                "width": 1280,
                "height": 720,
                "images_dir": "images",
                "fonts_dir": "fonts",
            }
        ),
        encoding="utf-8",
    )
    pptx_path = tmp_path / "deck.pptx"
    pptx_path.write_bytes(b"pptx")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    service = ExportTaskService(timeout_seconds=10)

    async def fake_run_task(_task_payload, _response_error_detail):
        return {"file_path": str(manifest_path)}

    service._run_task = fake_run_task

    result = asyncio.run(service.convert_pptx_to_html(str(pptx_path)))

    assert result.images_dir == str(artifact_dir / "images")
    assert result.fonts_dir == str(artifact_dir / "fonts")


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
    local_url = "http://127.0.0.1:8000/app_data/pptx-to-json/session/images/photo.svg"
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


def test_render_jsons_to_images_sends_localized_batch_payload(monkeypatch, tmp_path):
    app_data = tmp_path / "app-data"
    asset_path = app_data / "pptx-to-json" / "session" / "images" / "photo.svg"
    asset_path.parent.mkdir(parents=True)
    asset_path.write_text("<svg></svg>", encoding="utf-8")
    output_paths = [tmp_path / "preview-1.png", tmp_path / "preview-2.png"]
    for output_path in output_paths:
        output_path.write_bytes(b"png")
    monkeypatch.setenv("APP_DATA_DIRECTORY", str(app_data))
    monkeypatch.setenv("TEMP_DIRECTORY", str(tmp_path))
    monkeypatch.setenv("DISABLE_AUTH", "true")
    service = ExportTaskService(timeout_seconds=10)
    captured = {}

    async def fake_run_task(task_payload, response_error_detail):
        captured["task_payload"] = task_payload
        captured["response_error_detail"] = response_error_detail
        return {"file_paths": [str(path) for path in output_paths]}

    service._run_task = fake_run_task
    layouts = [
        {
            "elements": [
                {
                    "type": "image",
                    "data": "/app_data/pptx-to-json/session/images/photo.svg",
                }
            ]
        },
        {"elements": [{"type": "text", "text": "Two"}]},
    ]

    result = asyncio.run(
        service.render_jsons_to_images(
            layouts,
            960,
            540,
            fonts={"css": "@font-face {}"},
        )
    )

    assert result.paths == [str(path) for path in output_paths]
    payload = captured["task_payload"]
    assert payload["type"] == "json-to-images"
    assert payload["width"] == 960
    assert payload["height"] == 540
    assert payload["fonts"] == {"css": "@font-face {}"}
    assert payload["jsons"][0]["elements"][0]["data"].startswith("data:image/svg+xml;base64,")
    assert layouts[0]["elements"][0]["data"].startswith("/app_data/")
    assert "JSON-to-images" in captured["response_error_detail"]


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


def test_export_entrypoint_resolves_architecture_independent_runner(tmp_path):
    assert ExportTaskService._resolve_entrypoint_path(str(tmp_path)) == str(tmp_path / "runner.mjs")
