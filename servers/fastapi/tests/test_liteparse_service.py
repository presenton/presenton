from types import SimpleNamespace
from unittest.mock import patch

from services.liteparse_service import LiteParseService


def _ok_process(stdout: str = '{"ok": true, "text": "ok"}'):
    return SimpleNamespace(returncode=0, stdout=stdout, stderr="")


class TestLiteParseService:
    def test_parse_uses_safe_defaults(self):
        with patch.dict(
            "os.environ",
            {
                "LITEPARSE_DPI": "",
                "LITEPARSE_NUM_WORKERS": "",
            },
            clear=False,
        ), patch.object(
            LiteParseService,
            "check_runtime_ready",
            return_value=(True, "ok"),
        ), patch(
            "services.liteparse_service.subprocess.run",
            return_value=_ok_process(),
        ) as mock_run:
            service = LiteParseService(timeout_seconds=30)
            service.parse("/tmp/sample.pdf", ocr_enabled=True, ocr_language="eng")

        command = mock_run.call_args.args[0]
        assert "--dpi" in command
        assert command[command.index("--dpi") + 1] == "120"
        assert "--num-workers" in command
        assert command[command.index("--num-workers") + 1] == "1"

    def test_parse_uses_env_overrides(self):
        with patch.dict(
            "os.environ",
            {
                "LITEPARSE_DPI": "96",
                "LITEPARSE_NUM_WORKERS": "2",
            },
            clear=False,
        ), patch.object(
            LiteParseService,
            "check_runtime_ready",
            return_value=(True, "ok"),
        ), patch(
            "services.liteparse_service.subprocess.run",
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
            },
            clear=False,
        ), patch.object(
            LiteParseService,
            "check_runtime_ready",
            return_value=(True, "ok"),
        ), patch(
            "services.liteparse_service.subprocess.run",
            return_value=_ok_process(),
        ) as mock_run:
            service = LiteParseService(timeout_seconds=30)
            service.parse("/tmp/sample.pdf", ocr_enabled=True, ocr_language="eng")

        command = mock_run.call_args.args[0]
        assert command[command.index("--dpi") + 1] == "72"
        assert command[command.index("--num-workers") + 1] == "1"
