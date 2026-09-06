# P20 — tolerant web-search роутинг: деградация вместо падения генерации

Дата: 2026-09-06. Ветка: `fix/web-search-tolerant`.

## Контекст

Жалоба из продакшена: включение «Поиска в интернете» в Mini App приводит к
ошибке генерации. Внешние сбои поиска в конвейере уже гасились мягко
(`get_web_search_context` возвращает пустую строку), но оставался один
жёсткий путь: `get_selected_web_search_provider()` бросал
`HTTPException 400 «Unsupported web search provider»` на любом невалидном
значении `WEB_SEARCH_PROVIDER` (легаси-провайдер в user-config БД,
опечатка в env). Функция вызывалась безусловно в `generate_ppt_outline`
и в SSE-ручке `/outlines` — то есть битое значение конфига валило
генерацию целиком, а не только поиск.

## Что сделано

- `enums/web_search_provider.py`: добавлен член `UNKNOWN = "unknown"` —
  маркер «конфигурация невалидна».
- `utils/web_search.py`: `get_selected_web_search_provider()` на
  невалидном значении логирует warning и возвращает `UNKNOWN` вместо
  HTTP 400. Все маршрутизаторы учитывают `UNKNOWN` как «поиск
  недоступен»:
  - `should_use_native_web_search()` → False (уже исключён);
  - `should_expose_external_web_search_tool()` → False
    (раньше `!= AUTO` давал True — исправлено заодно);
  - `get_web_search_route()` → `("unavailable", None)`;
  - `resolve_external_web_search_provider()` → None.
- Провайдер задаётся только валидным значением: строгая проверка
  остаётся на стороне сохранения user-config (UI-дропдаун), рантайм
  больше не доверяет конфигу настолько, чтобы падать.
- Тест: `tests/unit/test_web_search.py::
  test_invalid_provider_value_degrades_to_unavailable_instead_of_raising`
  (легаси-значение `duckduckgo` → маршрут unavailable, генерация живёт).
- Гигиена: 8 файлов приведены к `ruff format` (копились с прошлых задач,
  ломали гейт `make check`).

## Как проверено

`make check` exit 0 (ruff + pytest + npm test + eslint + tsc).

## Деплой

Движок пересобрать на VPS (`~/yarex_presenton`) вместе с бот-релизом
`feature/free-draft-form-upload` (yarex_lab_tg): в Mini App тумблер
поиска скрыт до появления рабочего провайдера, а после этого фикса
невалидный `WEB_SEARCH_PROVIDER` больше не влияет на генерацию
(ищем в логах «Unsupported WEB_SEARCH_PROVIDER» для подтверждения
причины продовой ошибки).
