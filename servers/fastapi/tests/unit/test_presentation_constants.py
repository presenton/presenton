import pytest

from constants.presentation import (
    DEFAULT_MAX_OUTLINE_WORDS,
    get_max_outline_words,
)


def test_max_outline_words_defaults_to_100(monkeypatch):
    monkeypatch.delenv("MAX_OUTLINE_WORDS", raising=False)

    assert get_max_outline_words() == DEFAULT_MAX_OUTLINE_WORDS == 100


def test_max_outline_words_accepts_positive_integer(monkeypatch):
    monkeypatch.setenv("MAX_OUTLINE_WORDS", "250")

    assert get_max_outline_words() == 250


@pytest.mark.parametrize("value", ["0", "-1", "many"])
def test_max_outline_words_rejects_invalid_values(monkeypatch, value):
    monkeypatch.setenv("MAX_OUTLINE_WORDS", value)

    with pytest.raises(
        ValueError,
        match="MAX_OUTLINE_WORDS must be a positive integer",
    ):
        get_max_outline_words()
