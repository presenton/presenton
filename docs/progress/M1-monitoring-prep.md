# M1 — подготовка репозитория к мониторинг-стеку

Дата: 2026-09-03. Ветка `chore/monitoring-prep`. Гейт: `make check` exit 0.

## Задача

Подготовить движок к self-hosted мониторинг-стеку (Grafana + Loki + Alloy +
Prometheus) на сервере yarexlab.ru. Стек собирается в отдельном репо
`yarex_monitoring`; приложения к нему подключаются по контракту, без своего
кода мониторинга.

## Что сделано

1. `docker-compose.server.yml`: у сервиса `presenton` задана ротация логов
   контейнера — `json-file`, `max-size: 10m`, `max-file: 5`. Без явных лимитов
   Docker пишет логи без ограничений (дефолт демона может не быть настроен) —
   диск со временем закончится. Локальные json-файлы остаются fallback'ом для
   сборщика (Alloy), если Loki недоступен, `docker logs` продолжает работать.
2. `docs/monitoring.md` — контракт наблюдаемости для репозитория мониторинга:
   - приложение логирует только в stdout/stderr (start.js пробрасывает вывод
     FastAPI и Next.js), формат текстовый, JSON-логов нет;
   - уровень — env `LOG_LEVEL` (default INFO, `api/lifespan.py`);
   - ошибки можно доставлять штатным upstream-механизмом Sentry через
     `SENTRY_DSN` (+ `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_SEND_DEFAULT_PII`);
   - smoke-эндпоинт `GET /api/v1/auth/status` на `127.0.0.1:50521`;
   - имена compose-проекта (`yarex-presenton`) и контейнера (`presenton`),
     внешняя сеть `yarex-net`;
   - своего `/metrics` нет — приложение не требует ничего, host/контейнерные
     метрики собираются через docker.sock.

Код приложений не менялся: движок уже пишет всё в stdout, менять нечего.

## Что дальше (вне этого репо)

- Репо `yarex_monitoring`: сборка стека по промту (`PROMPT.md` в нём) — Loki +
  Alloy + Prometheus + cAdvisor + node_exporter + Grafana, алерты в Telegram.
- На сервере: проверить/задать дефолтную ротацию `/etc/docker/daemon.json`
  (fallback поверх пер-контейнерных лимитов).
- Позже, отдельными задачами: `/metrics` движка
  (prometheus-fastapi-instrumentator), структурированные (JSON) логи,
  решение по Sentry.
