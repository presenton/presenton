import asyncio
import threading
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from api.v1.ppt.endpoints import codex_auth as auth
from utils.oauth.openai_codex import CodexAccountProfile, TokenFailure, TokenSuccess


@pytest.fixture
def auth_session(monkeypatch):
    state = SimpleNamespace(
        id=str(uuid.uuid4()), started=threading.Event(), release=threading.Event(),
        exchanges=0, stores=0, closes=0,
        outcome=TokenSuccess(access="fixture-access", refresh="fixture-refresh", expires=1),
        store_error=None,
    )

    class Callback:
        def get_code_nowait(self):
            return "fixture-code"

        def close(self):
            state.closes += 1

    session = {
        "server": Callback(), "server_started": True, "verifier": "fixture-verifier",
        "state": "fixture-state", "credentials": object(),
    }
    state.session = session
    auth._sessions[state.id] = session

    def exchange(code, verifier):
        assert code == "fixture-code"
        assert verifier == "fixture-verifier"
        state.exchanges += 1
        state.started.set()
        assert state.release.wait(5), "Test must release the token exchange"
        return state.outcome

    def store(result, *, expected):
        assert result is state.outcome
        assert expected is session["credentials"]
        state.stores += 1
        if state.store_error:
            raise state.store_error
        return CodexAccountProfile(account_id="fixture-account")

    monkeypatch.setattr(auth, "exchange_authorization_code", exchange)
    monkeypatch.setattr(auth, "_store_token", store)
    yield state
    state.release.set()
    auth._sessions.pop(state.id, None)


def manual_request(state):
    return auth.ExchangeRequest(session_id=state.id, code="fixture-code#fixture-state")


async def wait_for_exchange(state):
    assert await asyncio.to_thread(state.started.wait, 2)


def assert_completed_once(state):
    assert state.exchanges == 1
    assert state.stores == 1
    assert state.closes == 1
    assert state.id not in auth._sessions


def test_overlapping_polls_share_exchange_and_store(auth_session):
    async def operation():
        state = auth_session
        first = asyncio.create_task(auth.poll_codex_auth_status(state.id))
        await wait_for_exchange(state)
        second = asyncio.create_task(auth.poll_codex_auth_status(state.id))
        await asyncio.sleep(0)
        assert state.exchanges == 1
        state.release.set()
        results = await asyncio.gather(first, second)
        assert [result.status for result in results] == ["success", "success"]
        assert_completed_once(state)
    asyncio.run(operation())


def test_manual_exchange_during_poll_returns_conflict_without_reusing_code(auth_session):
    async def operation():
        state = auth_session
        pending = asyncio.create_task(auth.poll_codex_auth_status(state.id))
        await wait_for_exchange(state)
        with pytest.raises(HTTPException) as error:
            await auth.exchange_codex_code(manual_request(state))
        assert error.value.status_code == 409
        state.release.set()
        assert (await pending).status == "success"
        assert_completed_once(state)
    asyncio.run(operation())


def test_poll_joins_manual_exchange_without_a_callback_listener(auth_session):
    async def operation():
        state = auth_session
        state.session["server_started"] = False
        manual = asyncio.create_task(auth.exchange_codex_code(manual_request(state)))
        await wait_for_exchange(state)
        poll = asyncio.create_task(auth.poll_codex_auth_status(state.id))
        await asyncio.sleep(0)
        state.release.set()
        manual_result, poll_result = await asyncio.gather(manual, poll)
        assert manual_result.account_id == "fixture-account"
        assert poll_result.status == "success"
        assert_completed_once(state)
    asyncio.run(operation())


@pytest.mark.parametrize("entrypoint", ["poll", "manual"])
def test_cancelled_http_waiter_cannot_cancel_or_duplicate_exchange(auth_session, entrypoint):
    async def operation():
        state = auth_session
        request = auth.poll_codex_auth_status(state.id) if entrypoint == "poll" else auth.exchange_codex_code(manual_request(state))
        caller = asyncio.create_task(request)
        await wait_for_exchange(state)
        shared = state.session["exchange_task"]
        caller.cancel()
        with pytest.raises(asyncio.CancelledError):
            await caller
        assert not shared.cancelled()
        next_poll = asyncio.create_task(auth.poll_codex_auth_status(state.id))
        await asyncio.sleep(0)
        state.release.set()
        assert (await next_poll).status == "success"
        assert_completed_once(state)
    asyncio.run(operation())


def test_shared_provider_failure_preserves_poll_and_manual_error_contracts(auth_session):
    async def operation():
        state = auth_session
        state.outcome = TokenFailure(reason="fixture-provider-failure")
        manual = asyncio.create_task(auth.exchange_codex_code(manual_request(state)))
        await wait_for_exchange(state)
        poll = asyncio.create_task(auth.poll_codex_auth_status(state.id))
        await asyncio.sleep(0)
        state.release.set()
        with pytest.raises(HTTPException) as error:
            await manual
        assert error.value.status_code == 502
        result = await poll
        assert result.status == "failed"
        assert result.detail == "fixture-provider-failure"
        assert state.exchanges == 1
        assert state.stores == 0
        assert state.closes == 1
        assert state.id not in auth._sessions
    asyncio.run(operation())


def test_shared_store_conflict_cleans_up_and_reaches_every_waiter(auth_session):
    async def operation():
        state = auth_session
        state.store_error = HTTPException(status_code=409, detail="Fixture credentials changed")
        first = asyncio.create_task(auth.poll_codex_auth_status(state.id))
        await wait_for_exchange(state)
        second = asyncio.create_task(auth.poll_codex_auth_status(state.id))
        await asyncio.sleep(0)
        state.release.set()
        results = await asyncio.gather(first, second, return_exceptions=True)
        assert all(isinstance(error, HTTPException) and error.status_code == 409 for error in results)
        assert_completed_once(state)
    asyncio.run(operation())
