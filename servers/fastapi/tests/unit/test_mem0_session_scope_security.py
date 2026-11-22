import pytest


@pytest.mark.parametrize(
    ("victim", "attacker"),
    [
        ({"user_id": "alice", "run_id": "proj-x"}, {"run_id": "proj-x&user_id=alice"}),
        ({"agent_id": "alice", "run_id": "proj-x"}, {"agent_id": "alice&run_id=proj-x"}),
        ({"run_id": "proj-x&user_id=alice"}, {"run_id": "proj-x%26user_id%3Dalice"}),
    ],
)
def test_session_history_cannot_cross_scopes(victim, attacker, tmp_path, monkeypatch):
    monkeypatch.setenv("MEM0_DIR", str(tmp_path / "mem0"))
    monkeypatch.setenv("MEM0_TELEMETRY", "false")
    from mem0.memory.main import _build_session_scope
    from mem0.memory.storage import SQLiteManager

    victim_scope = _build_session_scope(victim)
    attacker_scope = _build_session_scope(attacker)
    history = SQLiteManager()
    try:
        history.save_messages([{"role": "user", "content": "private context"}], victim_scope)
        assert history.get_last_messages(attacker_scope) == []
        # Filling another scope must not evict or interleave the victim's history.
        history.save_messages(
            [{"role": "user", "content": "attacker context"}] * 11, attacker_scope
        )
        assert [m["content"] for m in history.get_last_messages(victim_scope)] == [
            "private context"
        ]
        assert len(history.get_last_messages(attacker_scope)) == 10
    finally:
        history.close()


def test_presentation_scope_preserves_ordinary_identifiers(tmp_path, monkeypatch):
    monkeypatch.setenv("MEM0_DIR", str(tmp_path / "mem0"))
    monkeypatch.setenv("MEM0_TELEMETRY", "false")
    from mem0.memory.main import _build_session_scope

    user_id = "presentation:00000000-0000-0000-0000-000000000001"
    assert _build_session_scope({"user_id": user_id}) == f"user_id={user_id}"
    assert _build_session_scope({"user_id": "alice", "run_id": "proj-x"}) == (
        "run_id=proj-x&user_id=alice"
    )
