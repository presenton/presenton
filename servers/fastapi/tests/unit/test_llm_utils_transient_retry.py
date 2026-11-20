import pytest
from llmai.shared import ResponseStreamContentChunk

from utils import llm_utils
from utils.llm_utils import is_transient_llm_error, stream_generate_events


class OverloadedThenOkClient:
    def __init__(self, failures):
        self.failures = failures
        self.calls = 0

    def generate(self, **kwargs):
        self.calls += 1
        attempt = self.calls

        def events():
            if attempt <= self.failures:
                raise RuntimeError(
                    "500: Our servers are currently overloaded. Please try again later."
                )
            yield ResponseStreamContentChunk(chunk="ok")

        return events()


class FailsAfterFirstEventClient:
    def __init__(self):
        self.calls = 0

    def generate(self, **kwargs):
        self.calls += 1

        def events():
            yield ResponseStreamContentChunk(chunk="partial")
            raise RuntimeError("Our servers are currently overloaded.")

        return events()


async def _collect(client):
    return [event async for event in stream_generate_events(client)]


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch):
    monkeypatch.setattr(llm_utils, "TRANSIENT_RETRY_DELAYS", (0, 0, 0))


def test_is_transient_llm_error():
    assert is_transient_llm_error(RuntimeError("server_is_overloaded"))
    assert not is_transient_llm_error(ValueError("invalid schema"))


@pytest.mark.asyncio
async def test_retries_overload_before_first_event():
    client = OverloadedThenOkClient(failures=2)

    events = await _collect(client)

    assert client.calls == 3
    assert [event.chunk for event in events] == ["ok"]


@pytest.mark.asyncio
async def test_gives_up_after_retry_budget():
    client = OverloadedThenOkClient(failures=10)

    with pytest.raises(RuntimeError, match="overloaded"):
        await _collect(client)

    assert client.calls == 4


@pytest.mark.asyncio
async def test_does_not_retry_after_events_were_streamed():
    client = FailsAfterFirstEventClient()

    with pytest.raises(RuntimeError, match="overloaded"):
        await _collect(client)

    assert client.calls == 1
