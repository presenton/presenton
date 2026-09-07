# Progress

## Активная задача

P21 — hardening генерации: локализация (Language Detection), градиентные
фоны вместо белых, семантика графиков (timeseries → line), per-slide
fallback, текстовые bounding box. Аудит пяти прод-багов генерации и
исправления в `servers/fastapi` + `servers/nextjs`; ветка
`fix/generation-quality-hardening`.

Последняя закрытая: P20 — tolerant web-search роутинг. Битое значение
`WEB_SEARCH_PROVIDER` (легаси-провайдер в user-config) бросало HTTP 400
в `generate_ppt_outline` и SSE `/outlines` и валило генерацию целиком.
Теперь `get_selected_web_search_provider()` возвращает новый член
`UNKNOWN` с warning-логом, все маршрутизаторы (native/external/route/
resolve) трактуют его как «поиск недоступен» — генерация продолжается
без поиска. Тест на легаси-`duckduckgo` в test_web_search.py. Ветка
`fix/web-search-tolerant`, `make check` exit 0. Подробности:
docs/progress/P20-web-search-tolerant-routing.md.

Последняя закрытая: P19 — ретраи transient-флеймов провайдера. Прод-кейс
после отключения reasoning: «Expecting value: line 1 column 1 (char 0)»
(пустой JSON модели в structured-вызове, не ретраился) + недобор аутлайнов
(дважды на локальном стенде). Фиксы: ретрай transient parse-ошибок в
`generate_structured_with_schema_retries` (2 попытки, 1/2 c, ловит и
JSONDecodeError, и обёрнутые маркеры) и один ретрай аутлайна на пустой
JSON / недобор слайдов / 429-5xx с warning-логом. Ветка
perf/parallel-slide-llm, коммит 0db9c856, `make check` exit 0. Ожидает
merge в main и деплоя вместе с P18. Подробности:
docs/progress/P19-provider-transient-retries.md.

Последняя закрытая: P18 — параллельная генерация слайдов без барьера батчей
+ ретрай 429/5xx. Симптом «генерация >10 минут при CPU 20–30%»: конвейер
I/O-bound, CPU не при чём. Слайды шли последовательными батчами по 10 —
заменены на семафор `SLIDE_LLM_CONCURRENCY` (default 10) без барьера;
прогресс через reporter-задачу (AsyncSession не трогается из параллельных
задач); при сбое слайда хвост вызовов отменяется; 429/5xx ретраятся
(1/4/8 c, до 3); warning-лог медленного вызова `LLM_SLOW_CALL_WARN_SEC`.
Ветка perf/parallel-slide-llm, `make check` exit 0. Подробности и замер:
docs/progress/P18-parallel-slide-llm.md.

Последняя закрытая: P17 — прод-инцидент: экспорт падает ERR_MODULE_NOT_FOUND
(runner импортирует ./pptx-svg-fallback.mjs, Dockerfile не копирнул модуль
в образ) + апстрим Sail Research «response_format violated» на слайде валил
генерацию без ретрая. Фиксы: живучий импорт в раннере + COPY модуля в образ
и sync; ретрай upstream schema-нарушений в
generate_structured_with_schema_retries (+ один ретрай outline на 429/5xx).
Подробности: docs/progress/P17-export-deploy-and-llm-retry.md.

Последняя закрытая: PPTX-экспорт — SVG-иконки без растрового fallback
(«Не удалось отобразить рисунок» в PowerPoint-вьюверах). Диагноз по реальным
файлам прода: `<a:blip>` без `r:embed`, только svgBlip-ext; дефект в
@presenton/export-core (все версии 1.0.14–1.0.26 вырезают r:embed при
native-svg патче). Фикс на нашей стороне: scripts/pptx-svg-fallback.mjs —
после runTask каждому svg-only blip'у добавляется PNG-копия SVG (sharp из
deps export-core, density под размер, кэш, идемпотентно, сбой растеризации
одной иконки файл не роняет; PDF не трогается). Вызов в раннере только для
type=export и .pptx. Тесты: 6 кейсов (fallback, идемпотентность, нетронутые
blip'ы, сбой растеризации, slideLayouts). Проверено на реальном битом файле
прода: 28/28 svg-blip починены, 0 битых media-ссылок, zip/XML валидны.
make check exit 0 (ruff + tsc + 888 pytest + npm test). Ветка
fix/pptx-svg-fallback.

Последняя закрытая: CI deploy.yml — ротация образов presenton: после build
удаляются версии пакета ghcr.io/yarexlab/presenton кроме 10 последних
(GHCR API, continue-on-error), в «Prune old images on server» добавлены
docker builder prune (старше 7 дней) и docker system df в лог. make check
exit 0. Ветка chore/ci-image-cleanup.

Последняя закрытая: `/preview` — in-flight дедупликация на presentation_id
(модульный dict `asyncio.Lock`): параллельные POST по одной деке дожидаются
идущего рендера вместо запуска параллельного Chromium — без этого ручные
обновления из Mini App штамповали по несколько рендеров, и шторм CPU на VPS
тормозил одновременные генерации («раньше 1–5 минут, сейчас больше 15»).
Плюс duration-логи стадий конвейера генерации (outline/structure/slides/
assets/export) в generate-хендлере: `stage=<name> done duration_s=<t>` — на
живом стенде видно, где именно буксует. Тест: preview-lock сериализуется по
деке и независим между деками. make check: ruff + 888 pytest + npm test,
exit 0. Ветка fix/preview-inflight-lock.

Последняя закрытая: M1 — подготовка репо к мониторинг-стеку (ветка
`chore/monitoring-prep`): ротация docker-логов в `docker-compose.server.yml`
(json-file, max-size 10m / max-file 5) и контракт наблюдаемости
`docs/monitoring.md` для репо `yarex_monitoring` (stdout-логи, LOG_LEVEL,
SENTRY_DSN, smoke, имена контейнеров). Код приложений не менялся — движок уже
логирует в stdout. Подробности: docs/progress/M1-monitoring-prep.md.

Последняя закрытая: P16 (M4, движковая часть) — editor-state (undo/redo),
op add_element (text/image/rectangle), op set_data (text-list/chart), rich
text-разметка **/*/<latex> в set_text, ui и complex-предпросмотр в
editor-view. Подробности: docs/tg/04-editor-api.md.

Последняя закрытая: P15 — редакторский REST для редактирования из
Telegram Mini App (слайд-операции duplicate/delete/add/order/layout-catalog,
editor-view + editor-ops, preview refresh). `make check` зелёный (fastapi
877 passed). Подробности: docs/progress/P15-deck-editor-api.md.

Ранее: C1 — деплой на сервер (yarexlab.ru) через GitHub
Actions: кнопка workflow_dispatch (build → `ghcr.io/yarexlab/presenton:
main-<sha>` → SSH `git pull` + compose pull/up → smoke `/api/v1/auth/status`
→ чистка старых образов), тесты — только push в main. Проверено живым
деплоем 2026-09-02. Откат — кнопкой с `deploy_tag`. Подробности:
docs/progress/C1-deploy-github-actions.md.

Ранее: P14 — обход HTTP 400 400001 от b.ai: флаг
`LLM_STRUCTURED_OUTPUTS=false` (не слать `response_format`/`json_schema`,
парсить JSON из текста; гейты в `get_generate_kwargs` и
`templates/v2/generation.py`, толерантный `extract_structured_content`).
Источник: инцидент 2026-09-01 (`docs/engine-response-format-issue.md`),
задача в TASKS.md репо presenton. На сервере: выставить
`LLM_STRUCTURED_OUTPUTS=false` в `.env` движка и перезапустить контейнер.

Ранее: P10 — ребрендинг Yarex + hardening внутренней админки
(servers/nextjs): видимый ребренд + иконки, рестайл purple→blue,
телеметрия default off, регистрация закрыта по дизайну (setup 409).
Подробности: docs/progress/P10-yarex-rebrand-admin.md.

Ещё ранее: T-04 — cookie samesite=none+secure за https-прокси (десктоп-Telegram),
мерж в main `c8c97f44`. Следующая связанная: T-09 — живой smoke против
движка (ждёт сервера/домена; вайтлист testers вписан в .env движка).
