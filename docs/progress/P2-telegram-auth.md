# P2. Авторизация через Telegram

Ветка: `feat/telegram-auth`
Статус: **ЗАКРЫТА**, реализовано. `make check` — exit 0 (ruff, 814 passed,
npm test, lint).

---

## Что сделано

Новый эндпоинт `POST /api/v1/auth/telegram`: принимает `initData` от Telegram
Mini App, проверяет HMAC-подпись и свежесть `auth_date`, находит или создаёт
`User(username="tg_<telegram_id>")` и выдаёт обычную сессионную куку
`presenton_session` через существующие `write_token()` и `_set_login_cookie()`.
Дальше TG-пользователь неотличим от веб-пользователя: та же кука, тот же
owner-скоупинг.

| Файл | Что в нём |
|---|---|
| `servers/fastapi/api/v1/auth/telegram.py` | `parse_and_verify_init_data()` — чистая функция проверки подписи (stdlib `hmac`/`hashlib`), без FastAPI и БД |
| `servers/fastapi/api/v1/auth/router.py` | эндпоинт `POST /api/v1/auth/telegram` |
| `servers/fastapi/api/v1/auth/schemas.py` | `TelegramAuthRequest(init_data)` |
| `servers/fastapi/api/middlewares.py` | путь добавлен в `_PUBLIC_AUTH_PATHS` |
| `servers/fastapi/utils/get_env.py` | аксессор `get_telegram_bot_token_env()` |
| `servers/fastapi/tests/mocks/telegram.py` | генератор валидных `initData` для тестов |
| `servers/fastapi/tests/unit/test_telegram_init_data.py` | 5 юнит-тестов верификации |
| `servers/fastapi/tests/integration/test_telegram_auth_endpoints.py` | 4 интеграционных теста эндпоинта |
| `nginx.conf` | `limit_req_zone auth_telegram` (10 r/m на IP) + location для эндпоинта |
| `docker-compose.yml` | `TELEGRAM_BOT_TOKEN` проброшен во все 4 сервиса |
| `README.md`, `tg.md` | переменная и точный контракт эндпоинта |

## Контракт эндпоинта

```
POST /api/v1/auth/telegram
{ "init_data": "<window.Telegram.WebApp.initData целиком>" }

200: { configured, authenticated, created: bool, id, username: "tg_<id>",
       role: "user", created_at } + Set-Cookie: presenton_session (30 дней)
401: подпись невалидна или auth_date старше 15 минут
429: rate limit nginx (10 r/m с IP, burst 5)
503: TELEGRAM_BOT_TOKEN не задан (ошибка конфигурации, отличима от 500)
```

## Принятые решения

- **Миграция БД не нужна**: `User.username` — уникальный `String(128)`,
  `tg_<id>` ложится. Колонка `telegram_id` — только если понадобится обратный
  поиск.
- **Один `TELEGRAM_BOT_TOKEN`**. Тестовый бот — отдельное развёртывание.
  Список токенов — усложнение под сценарий, которого нет.
- **Rate limiting только в nginx**, отдельная зона по образцу `/auth/login`.
  `LoginRateLimiter` приложения не подключён: он про неудачные пароли, здесь
  их нет; перебор невозможен (HMAC не подделать), лимит — от роста БД.
- **Пароль TG-аккаунта** — хеш от `secrets.token_urlsafe(32)`, сам пароль не
  сохраняется: войти по логину/паролю нельзя, только через Telegram.
  Колонку nullable не делали — миграция плюс ветка «нет пароля» не стоят того.
- **`auth_date` не старше 15 минут** (+60 сек допуска на расхождение часов).
- **`"created": true/false` в ответе** — Mini App может поприветствовать
  нового пользователя.
- **Гонка первого входа**: `IntegrityError` → rollback → перечитывание,
  как в `POST /setup`.

## Проверки

- Юнит: валидная подпись проходит; битая подпись, нет `hash`, просроченный
  `auth_date`, чужой токен — отвергаются. Тестовые `initData` генерируются в
  тесте тем же алгоритмом, настоящие не нужны.
- Интеграция: первый вход создаёт пользователя и ставит куку; повторный —
  тот же аккаунт, `created: false`, без дублей; кукой проходим
  `GET /api/v1/auth/verify`; невалидный initData → 401 без куки; без токена →
  503.
- Живая проверка: подпись, сгенерированная настоящим токеном из `.env`
  (переименован в `TELEGRAM_BOT_TOKEN`), проходит верификацию.
- `make check` — exit 0, `814 passed`.

## Риск на P6 (политика регистрации)

Логин сравнивает имена регистронезависимо (`func.lower(User.username) ==
username.casefold()`). Обычный пользователь мог бы занять имя `tg_123` и тем
перехватить чужой TG-аккаунт при первом входе того в Mini App. Сейчас риск
теоретический — пользователей создаёт только админ — но при открытии
регистрации в P6 это станет дыркой: имена с префиксом `tg_` надо резервировать.

## Чего в задаче не было (осознанно)

- Кука `SameSite=None; Secure` для iframe web.telegram.org — P5, нужен HTTPS.
- Аутентификация самого бота (не Mini App) — открытый вопрос к разработчику
  бота, зафиксирован в `tg.md`.
- Квоты — P4. Политика регистрации — P6.
