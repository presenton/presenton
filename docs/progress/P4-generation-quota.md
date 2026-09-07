# P4. Квоты на генерацию по пользователям

Ветка: `feat/generation-quota`
Статус: в работе.

P3 закрыта и влита в `main` — см. `docs/progress/P3-slide-preview-images.md`.
Критический путь MVP (P1–P3) пройден; P4 — первая задача блока «нужно до
открытия наружу».

---

## Цель

Один пользователь не может выжечь общий LLM-бюджет: `ProviderSettings` —
синглтон, ключи общие, а регистрация через Telegram открыта всем (P2).

## Дизайн

- **Счётчик**: таблица `generation_usage(id, owner_id, created_at)` — строка
  на запуск генерации. Неудачные генерации тоже жгут бюджет, поэтому считаем
  старты, а не готовые презентации.
- **Период**: скользящие 24 часа (`created_at > now - 24h`), без эффекта
  «двойного лимита в полночь».
- **Лимит**: env `GENERATION_QUOTA_PER_DAY` (дефолт 10, `0` = без лимита) +
  колонка `user.generation_limit` (NULL = дефолт) для персонального
  переопределения.
- **Не ограничены**: суперпользователи и режим `DISABLE_AUTH` (owner
  отсутствует — electron/локальная установка).
- **Отказ**: 429 + `Retry-After` (секунды до освобождения старейшего слота).
- Гонка двух запросов на последнем слоте — превышение на 1 допустимо.

## План работ

1. Модель `GenerationUsage` + `user.generation_limit` + миграция alembic
   (down_revision = `e4c7a9b2d6f1`, текущий head).
2. `services/quota_service.py`: `quota_for_user()` + `enforce_generation_quota()`;
   вызов из `check_if_api_request_is_valid` (покрывает sync и async).
3. `GET /api/v1/quota` + `PUT /api/v1/admin/users/{id}/quota`.
4. Тесты: блокировка на лимите, безлимит при 0, пропуск админа, override,
   endpoint остатка, кейс миграции.
5. `docker-compose.yml`, README, записка `docs/tg/03-quota.md`.
6. `make check`, коммит, мерж, архив.

## Не делаем

- Учёт токенов/стоимости LLM — позже.
- Квоты на `/edit`, `/derive`, превью — только запуск генерации.
- Политику регистрации — P6.
