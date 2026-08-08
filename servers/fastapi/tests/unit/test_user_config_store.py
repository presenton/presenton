import json
import stat
from concurrent.futures import ThreadPoolExecutor

from utils.user_config_store import read_user_config_file, update_user_config_file


def test_reads_backup_when_primary_json_is_malformed(tmp_path):
    config_path = tmp_path / "userConfig.json"
    config_path.write_text('{"LLM"', encoding="utf-8")
    config_path.with_suffix(config_path.suffix + ".bak").write_text(
        json.dumps({"LLM": "openai"}),
        encoding="utf-8",
    )

    assert read_user_config_file(str(config_path)) == {"LLM": "openai"}


def test_read_secures_existing_config_files_without_changing_contents(tmp_path):
    config_path = tmp_path / "userConfig.json"
    backup_path = config_path.with_suffix(config_path.suffix + ".bak")
    primary_content = json.dumps({"AUTH_PASSWORD_HASH": "preserved"})
    backup_content = json.dumps({"AUTH_PASSWORD_HASH": "backup-preserved"})
    config_path.write_text(primary_content, encoding="utf-8")
    backup_path.write_text(backup_content, encoding="utf-8")
    config_path.chmod(0o644)
    backup_path.chmod(0o644)

    assert read_user_config_file(str(config_path)) == {
        "AUTH_PASSWORD_HASH": "preserved"
    }
    assert config_path.read_text(encoding="utf-8") == primary_content
    assert backup_path.read_text(encoding="utf-8") == backup_content
    assert stat.S_IMODE(config_path.stat().st_mode) == 0o600
    assert stat.S_IMODE(backup_path.stat().st_mode) == 0o600


def test_update_creates_parent_directory_and_writes_valid_json(tmp_path):
    config_path = tmp_path / "missing" / "userConfig.json"

    update_user_config_file(
        str(config_path),
        lambda existing: {**existing, "LLM": "openai"},
    )

    assert json.loads(config_path.read_text(encoding="utf-8")) == {"LLM": "openai"}
    backup_config = json.loads(
        config_path.with_suffix(config_path.suffix + ".bak").read_text(
            encoding="utf-8"
        )
    )
    assert backup_config == {"LLM": "openai"}


def test_concurrent_updates_are_serialized(tmp_path):
    config_path = tmp_path / "userConfig.json"
    update_user_config_file(str(config_path), lambda _: {"count": 0})

    def increment() -> None:
        def update(existing: dict) -> dict:
            existing["count"] = int(existing.get("count", 0)) + 1
            return existing

        update_user_config_file(str(config_path), update)

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(lambda _: increment(), range(25)))

    assert read_user_config_file(str(config_path))["count"] == 25
