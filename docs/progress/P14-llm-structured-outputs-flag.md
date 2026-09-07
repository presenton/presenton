# P14. Обход 400001 от b.ai: флаг LLM_STRUCTURED_OUTPUTS

Статус: закрыта, в `main` (не слита — коммит отдельным шагом).

Полный разбор инцидента и диагностика — `docs/engine-response-format-issue.md`.

---

## Суть

b.ai (`https://api.b.ai/v1/chat/completions`) отклоняет `response_format`
с `json_schema` (HTTP 400, код `400001`) для используемой модели. Шаги,
где движок шлёт structured outputs (генерация структуры презентации,
контент слайдов, web-search-запрос, layout-кластеризация), падали с
`openai.BadRequestError` → `LLMError: 400`.

## Что сделано

1. **Env-флаг `LLM_STRUCTURED_OUTPUTS`** (default `true`):
   - `utils/get_env.py` — `get_llm_structured_outputs_env()`;
   - `utils/llm_config.py` — `llm_structured_outputs_enabled()` (отключают
     только явные `0/false/no/off`).
2. **Гейт `response_format`**:
   - `utils/llm_utils.py::get_generate_kwargs` — при выключенном флаге
     параметр не попадает в запрос; покрывает все `utils/llm_calls/*`
     (структура, outline, контент слайдов, edit-slide, web-search-query);
   - `templates/v2/generation.py` — `_generate_preview_candidate` и
     `_generate_with_validation_retries` строят kwargs условно.
3. **Парсинг JSON из текстового ответа** (работает и без
   `response_format`):
   - `extract_structured_content` снимает markdown-фенсы
     (`` ```json ... ``` ``) и вытаскивает сбалансированный `{...}` из
     прозы; `dirtyjson` сохранён для грязного JSON;
   - schema-фидбек-луп `generate_structured_with_schema_retries` работает
     как раньше (валидация идёт по `json_schema`, не по `response_format`);
   - `templates/v2::_parse_json_content` — толерантный парсинг с
     ретраями-починкой (пути уже были заложены).
4. **Операторская документация**: README.md (список env), docker-compose.yml
   (прокидывание в 4 сервиса), PROGRESS.md/tasks.md.

## Тесты

- `tests/unit/test_llm_utils_and_schema.py` — парсинг (фенсы, проза, dirty),
  `get_generate_kwargs` c флагом on/off;
- `tests/unit/test_llm_utils_disconnect.py` — end-to-end без
  `response_format`: фенсовый JSON из текста парсится;
- `tests/unit/test_templates_v2_generation.py` — `generate_slide_layout` и
  `merge_similar_components` без `response_format` с фенсовым ответом.

Гейт: `make check` зелёный (845 pytest + npm test + lint + tsc).

## Деплой

```bash
# на сервере движка: .env
LLM_STRUCTURED_OUTPUTS=false
docker compose up -d --build   # или docker restart presenton
```

Проверка: генерация из бота без `400` на `chat/completions`, в админ-панели
бота `status=succeeded`.
