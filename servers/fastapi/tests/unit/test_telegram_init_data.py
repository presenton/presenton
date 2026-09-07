import time

import pytest

from api.v1.auth.telegram import (
    InitDataError,
    parse_and_verify_init_data,
)
from tests.mocks.telegram import TEST_BOT_TOKEN, make_init_data


def test_valid_init_data_passes_and_parses_user():
    data = parse_and_verify_init_data(make_init_data(), TEST_BOT_TOKEN)

    assert data["user"]["id"] == 123456789
    assert data["user"]["first_name"] == "Test"


def test_tampered_signature_is_rejected():
    init_data = make_init_data().replace("first_name", "Hacker")

    with pytest.raises(InitDataError):
        parse_and_verify_init_data(init_data, TEST_BOT_TOKEN)


def test_missing_hash_is_rejected():
    with pytest.raises(InitDataError):
        parse_and_verify_init_data(make_init_data(with_hash=False), TEST_BOT_TOKEN)


def test_expired_auth_date_is_rejected():
    init_data = make_init_data(auth_date=int(time.time()) - 16 * 60)

    with pytest.raises(InitDataError):
        parse_and_verify_init_data(init_data, TEST_BOT_TOKEN)


def test_signature_from_another_bot_token_is_rejected():
    init_data = make_init_data(bot_token="987654321:other-bot-token")

    with pytest.raises(InitDataError):
        parse_and_verify_init_data(init_data, TEST_BOT_TOKEN)
