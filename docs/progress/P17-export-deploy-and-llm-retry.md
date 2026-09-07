# P17. Прод-инцидент: экспорт в образе + ретрай апстрим schema-нарушений

Статус: закрыта, в `main` (merge 6881f476, ветка fix/export-deploy-and-llm-retry).

---

## Суть

Прод-инцидент по логам бота:

1. Экспорт падает `ERR_MODULE_NOT_FOUND` — runner импортирует
   `./pptx-svg-fallback.mjs`, а Dockerfile файл в образ не копирует.
2. Апстрим (Sail Research) отдаёт «response_format violated» на слайде —
   вся генерация умирает без ретрая.

## Что сделано

1. Живучий импорт в раннере + COPY модуля `pptx-svg-fallback.mjs` в образ
   и sync.
2. Ретрай upstream schema-нарушений в
   `generate_structured_with_schema_retries`
   (`utils/llm_utils.py`: `_is_upstream_schema_violation`, маркеры
   «response_format violated» / «did not match response json schema» /
   «upstream error from», максимум 2 ретрая, паузы 1–2 c).
3. Один ретрай outline на 429/5xx в generate-хендлере
   (`presentation.py`, блок `collect_outline`).

## Проверка

`make check` exit 0.
