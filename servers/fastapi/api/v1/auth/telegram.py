"""Проверка initData Telegram Mini App.

Алгоритм из документации Telegram:
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

Подпись считается по декодированным значениям query string, поэтому initData
нельзя пересобирать — принимать надо исходную строку как есть.
"""

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

# initData живёт в WebView долго, а сессия выдаётся на 30 дней — окно короткое.
# Не 5 минут, чтобы не ловить отказы на расхождении часов клиента и сервера.
TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 15 * 60
_FUTURE_SKEW_SECONDS = 60


class InitDataError(ValueError):
    """initData не прошёл проверку: битая подпись, просрочка, нет hash/user."""


def parse_and_verify_init_data(
    init_data: str,
    bot_token: str,
    max_age_seconds: int = TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
) -> dict:
    """Проверяет подпись и свежесть initData, возвращает разобранные поля.

    Поле `user` в результате распарсено из JSON в dict. При любой невалидности
    бросает InitDataError; детали наружу не отдаём (всё это — 401).
    """
    received_hash: str | None = None
    data_pairs: list[tuple[str, str]] = []
    for key, value in parse_qsl(init_data, keep_blank_values=True):
        if key == "hash":
            received_hash = value
        else:
            # signature участвует в data_check_string: по докам в DCS
            # входят ВСЕ получённые поля, кроме hash — новые iOS-клиенты
            # кладут signature в initData, и Telegram учитывает её в хеше
            data_pairs.append((key, value))
    if not received_hash:
        raise InitDataError("missing hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data_pairs))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, received_hash):
        raise InitDataError("invalid signature")

    data = dict(data_pairs)
    try:
        auth_date = int(data["auth_date"])
    except (KeyError, ValueError):
        raise InitDataError("missing or invalid auth_date") from None
    now = int(time.time())
    if now - auth_date > max_age_seconds or auth_date - now > _FUTURE_SKEW_SECONDS:
        raise InitDataError("auth_date expired")

    # user — JSON-строка внутри query string; id нужен как ключ аккаунта.
    try:
        user = json.loads(data["user"])
    except (KeyError, json.JSONDecodeError):
        raise InitDataError("missing or invalid user") from None
    if not isinstance(user, dict) or not isinstance(user.get("id"), int):
        raise InitDataError("missing user id")
    data["user"] = user
    return data
