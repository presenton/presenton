import os
from types import SimpleNamespace
from unittest.mock import patch

from services.liteparse_service import LiteParseService


def _ok_process(
    stdout: str = "ok",
    returncode: int = 0,
    stderr: str = "",
):
    return SimpleNamespace(returncode=returncode, stdout=stdout, stderr=stderr)


class TestLiteParseService:
    def test_parse_uses_safe_defaults(self):
        with patch.dict(
            "os.environ",
            {
                "LITEPARSE_DPI": "",
                "LITEPARSE_NUM_WORKERS": "",
                "LITEPARSE_RUNNER_OUTPUT": "",
            },
            clear=False,
        ), patch.object(
            LiteParseService,
            "check_runtime_ready",
            return_value=(True, "ok"),
        ), patch.object(
            LiteParseService,
            "_run_plain_bridge_to_text",
            return_value=_ok_process(),
        ) as mock_run:
            service = LiteParseService(timeout_seconds=30)
            r = service.parse("/tmp/sample.pdf", ocr_enabled=True, ocr_language="eng")
            assert r["ok"] is True
            assert r["text"] == "ok"

        command = mock_run.call_args.args[0]
        assert "--dpi" in command
        assert command[command.index("--dpi") + 1] == "120"
        assert "--num-workers" in command
        assert command[command.index("--num-workers") + 1] == str(
            max(os.cpu_count() - 2, 1)
        )
        assert command[command.index("--python-bridge") + 1] == "plain"

    def test_parse_uses_env_overrides(self):
        with patch.dict(
            "os.environ",
            {
                "LITEPARSE_DPI": "96",
                "LITEPARSE_NUM_WORKERS": "2",
                "LITEPARSE_RUNNER_OUTPUT": "",
            },
            clear=False,
        ), patch.object(
            LiteParseService,
            "check_runtime_ready",
            return_value=(True, "ok"),
        ), patch.object(
            LiteParseService,
            "_run_plain_bridge_to_text",
            return_value=_ok_process(),
        ) as mock_run:
            service = LiteParseService(timeout_seconds=30)
            service.parse("/tmp/sample.pdf", ocr_enabled=True, ocr_language="eng")

        command = mock_run.call_args.args[0]
        assert command[command.index("--dpi") + 1] == "96"
        assert command[command.index("--num-workers") + 1] == "2"

    def test_parse_clamps_invalid_env_values(self):
        with patch.dict(
            "os.environ",
            {
                "LITEPARSE_DPI": "-1",
                "LITEPARSE_NUM_WORKERS": "0",
                "LITEPARSE_RUNNER_OUTPUT": "",
            },
            clear=False,
        ), patch.object(
            LiteParseService,
            "check_runtime_ready",
            return_value=(True, "ok"),
        ), patch.object(
            LiteParseService,
            "_run_plain_bridge_to_text",
            return_value=_ok_process(),
        ) as mock_run:
            service = LiteParseService(timeout_seconds=30)
            service.parse("/tmp/sample.pdf", ocr_enabled=True, ocr_language="eng")

        command = mock_run.call_args.args[0]
        assert command[command.index("--dpi") + 1] == "72"
        assert command[command.index("--num-workers") + 1] == "1"

    def test_parse_json_bridge_env(self):
        with patch.dict(
            "os.environ",
            {"LITEPARSE_RUNNER_OUTPUT": "json"},
            clear=False,
        ), patch.object(
            LiteParseService,
            "check_runtime_ready",
            return_value=(True, "ok"),
        ), patch(
            "services.liteparse_service.subprocess.run",
            return_value=_ok_process(stdout='{"ok": true, "text": "legacy"}\n'),
        ) as mock_run:
            service = LiteParseService(timeout_seconds=30)
            r = service.parse("/tmp/sample.pdf", ocr_enabled=True, ocr_language="eng")
            assert r["text"] == "legacy"

        command = mock_run.call_args.args[0]
        assert command[command.index("--python-bridge") + 1] == "json"
