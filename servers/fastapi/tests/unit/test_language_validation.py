import pytest

from utils.language_validation import (
    detect_script_counts,
    expected_script_for_language,
    get_language_mismatch_errors,
    iter_content_strings,
    resolve_prompt_language,
)


def test_expected_script_for_language_labels():
    assert expected_script_for_language("Russian (Русский)") == "cyrillic"
    assert expected_script_for_language("Russian") == "cyrillic"
    assert expected_script_for_language("русский") == "cyrillic"
    assert expected_script_for_language("English") == "latin"
    assert expected_script_for_language("German") == "latin"
    assert expected_script_for_language("Chinese") == "han"
    assert expected_script_for_language("ru") == "cyrillic"
    assert expected_script_for_language("en") == "latin"


def test_expected_script_auto_and_unknown_have_no_expectation():
    assert expected_script_for_language(None) is None
    assert expected_script_for_language("") is None
    assert expected_script_for_language("Auto") is None
    assert expected_script_for_language("Auto (English)") is None
    assert expected_script_for_language("auto-detect") is None
    assert expected_script_for_language("Klingon") is None


def test_resolve_prompt_language_never_hints_english():
    assert resolve_prompt_language("Auto (English)") == (
        "auto-detect from the slide content and use the same language as the slide content"
    )
    assert resolve_prompt_language("Auto") != "Auto"
    assert resolve_prompt_language("Russian (Русский)") == "Russian (Русский)"
    assert resolve_prompt_language(None).startswith("auto-detect")
    assert resolve_prompt_language("  ").startswith("auto-detect")


def test_detect_script_counts():
    counts = detect_script_counts("Привет world")
    assert counts["cyrillic"] == 6
    assert counts["latin"] == 5


def test_iter_content_strings_skips_asset_prompts():
    content = {
        "title": "Заголовок",
        "__image_prompt__": "abstract business background",
        "image": {"icon_query": "growth chart"},
        "items": ["Один", "Два"],
    }
    values = [value for _path, value in iter_content_strings(content)]
    assert "abstract business background" not in values
    assert "growth chart" not in values
    assert "Заголовок" in values


def test_language_mismatch_detected_for_russian_request():
    content = {
        "title": "Market Overview",
        "body": "The company demonstrated strong growth across all segments "
        "during the last fiscal year and expanded into new regions.",
    }
    errors = get_language_mismatch_errors(content, "Russian")
    assert errors
    assert "language mismatch" in errors[0]


def test_matching_language_passes():
    content = {
        "title": "Обзор рынка",
        "body": "Компания показала уверенный рост по всем направлениям "
        "за последний финансовый год и вышла на новые рынки.",
    }
    assert get_language_mismatch_errors(content, "Russian (Русский)") == []


def test_short_content_and_unknown_language_are_skipped():
    assert get_language_mismatch_errors({"title": "Q1 2024"}, "Russian") == []
    assert get_language_mismatch_errors({"title": "Only latin words here"}, None) == []


def test_mixed_but_dominant_expected_language_passes():
    # Числа и бренды — не алфавитные символы, кириллица доминирует.
    content = {
        "metrics": ["Выручка 2024: 24 млрд ₽", "ROI 120%"],
        "title": "Итоги 2024 года",
    }
    assert get_language_mismatch_errors(content, "Russian") == []


@pytest.mark.parametrize(
    "language",
    ["Russian (Русский)", "Russian", "ru", "русский"],
)
def test_validator_ignores_auto_variants(language):
    assert expected_script_for_language(language) == "cyrillic"
