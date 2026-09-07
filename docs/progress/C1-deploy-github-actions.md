# C1 — деплой на сервер через GitHub Actions

**Статус:** выполнено и проверено живым деплоем (2026-09-02).
Коммиты: `f198b424`, `40e85ef7`, `e205729d`, `608dc4e5`.
Прогон: test-all зелёный (run 33659686390), деплой зелёный
(runs 33659967534 — упал на гонке порта, 33661478847 — успех).

## Что сделано

- `.github/workflows/deploy.yml` — **только `workflow_dispatch`** (кнопка
  в Actions, автозапуска нет):
  - job build: buildx `linux/amd64`, пуш в `ghcr.io/yarexlab/presenton`,
    теги `main-<short_sha>` + moving `main`, кэш gha; пропускается, если
    в input `deploy_tag` указан существующий тег;
  - job deploy (SSH через secrets `DEPLOY_SSH_HOST/USER/KEY/PATH`):
    `git pull --ff-only` → `YAREX_IMAGE_TAG=<тег> compose pull` →
    `up -d --no-build`; job запускается и при пропущенном build
    (`if: always() && result in (success, skipped)`);
  - smoke: до 12 попыток `curl /api/v1/auth/status` на
    `127.0.0.1:50521` с сервера;
  - чистка: удаление старых `main-*` образов (кроме текущего) +
    `docker image prune -f`; ошибка чистки не роняет деплой.
- `docker-compose.server.yml`: `image: ghcr.io/yarexlab/presenton:${YAREX_IMAGE_TAG:-main}`,
  `build:` оставлен как ручной fallback.
- `test-all.yml`: триггер — только push в `main` (+ workflow_dispatch),
  `pull_request` убран; добавлен шаг `tsc --noEmit -p tsconfig.codex-check.json`.
- Удалены апстримовские `docker-release.yml`, `sync-releaes-to-r2.yml`.

## Секреты (настроены владельцем)

`DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`;
на сервере — `docker login ghcr.io`.

## Откат

Actions → Deploy → Run workflow → `deploy_tag=main-<sha предыдущего
зелёного деплоя>` (build пропускается, деплой ~15 c).

## Инцидент первого прогона

Первая попытка: контейнер пересоздался, но старт упал «Bind for
0.0.0.0:50521 failed: port is already allocated» — гонка: docker-proxy
старого контейнера ещё не отпустил порт в момент старта нового. Повторный
запуск кнопкой с тем же тегом прошёл без паузы. Если повторится чаще —
смотреть `docker ps --filter publish=50521` на сервере на предмет
постороннего контейнера.
