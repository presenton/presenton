# Контракт наблюдаемости движка (для мониторинг-стека)

Документ-договор между этим репозиторием и репозиторием `yarex_monitoring`
(Grafana + Loki + Prometheus + Alloy на сервере yarexlab.ru). Мониторинг-стек
опирается на перечисленное ниже; менять это без синхронного обновления
мониторинга нельзя. Изменения в сам мониторинг-стек — только в его репозитории,
в этом репо ничего про Grafana/Loki/Prometheus не конфигурируется.

## Логи

- Приложение (FastAPI + Next.js, оба процесса внутри одного контейнера)
  пишет **только в stdout/stderr**; `start.js` пробрасывает вывод дочерних
  процессов в stdout контейнера. Логи файлов/БД у движка нет.
- Формат — текст (uvicorn/Next.js по умолчанию). Структурированные JSON-логи
  движку не заведены; парсинг на стороне Loki — по текстовым паттернам
  (`level=`, статус-коды в access-логах uvicorn).
- Docker-драйвер — `json-file` с ротацией (`max-size: 10m`, `max-file: 5`)
  в `docker-compose.server.yml`: локальные файлы на хосте остаются fallback'ом,
  если Loki недоступен.
- Уровень — env `LOG_LEVEL` (default `INFO`), читается в `api/lifespan.py`;
  uvicorn access-логи включены.

## Контейнеры и сеть

| Что | Значение |
|---|---|
| Compose-проект | `yarex-presenton` |
| Контейнер | `presenton` (задан явно через `container_name`) |
| Образ | `ghcr.io/yarexlab/presenton:<main-<sha>|main>` |
| Порт наружу (хост) | `127.0.0.1:50521` → контейнер `:80`; TLS терминирует nginx хоста |
| Сеть | внешняя docker-сеть `yarex-net` (общая с проектом `yarex-lab-tg`) |

Для Alloy docker-SD: автоматические метки `com.docker.compose.project=yarex-presenton`,
`com.docker.compose.service=presenton`, имя контейнера `presenton`. Своих
дополнительных меток compose не задаёт.

## Метрики и алерты (текущее состояние)

- Своего `/metrics` у движка нет. Host/контейнерные метрики мониторинг-стек
  получает через cAdvisor/node_exporter по docker.sock — приложению это не
  требует ничего. Приложенные бизнес-метрики (RPS, latency по эндпоинтам) —
  отдельная будущая задача (кандидат: `prometheus-fastapi-instrumentator`).
- Ошибки в приложение уже можно доставлять штатно: upstream-механизм Sentry
  включается env-переменными `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`,
  `SENTRY_SEND_DEFAULT_PII` (см. `api/main.py`). Решение о подключении —
  вне этого репозитория.

## Здоровье

- Smoke-эндпоинт деплоя: `GET /api/v1/auth/status` на
  `http://127.0.0.1:50521` (используется CI-деплоем, см.
  `docs/progress/C1-deploy-github-actions.md`).
- Docker healthcheck у контейнера не задан; рестарты/падения мониторинг-стек
  видит по событиям docker (docker.sock) и логам.

## Что мониторинг вправе предполагать

1. Все сервисы этого репо на сервере запущены из `docker-compose.server.yml`
   (проект `yarex-presenton`), деплой — из CI (GHCR + кнопка workflow_dispatch).
2. Логи контейнера читаются через docker.json-файлы
   (`/var/lib/docker/containers/...`) — доступ даётся сборщику (Alloy) на хосте.
3. Перечисленные выше имена/порты/переменные — стабильный интерфейс; их
   изменение требует задачи в обоих репозиториях.
