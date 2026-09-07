# Ошибка генерации: b.ai отклоняет `response_format` (HTTP 400, код 400001)

> **Где чинить:** репозиторий движка **`yarex_presenton`**.
> **Бот `yarex_lab_tg` не при чём** — он корректно создаёт задачу, опрашивает
> статус, возвращает кредит при ошибке и пишет текст ошибки в свою админ-панель
> (Логи → логгер `task_worker` → поле `error_detail`).

## Суть проблемы

При генерации презентации движок Presenton обращается к LLM-провайдеру
**b.ai** (`https://api.b.ai/v1/chat/completions`) через библиотеку `llmai`
и на одном из шагов получает:

```
HTTP 400 Bad Request
{
  "error": {
    "message": "The request is invalid: This response_format type is unavailable now.
                Please check the request body, required fields, and request format.",
    "type": "invalid_request_error",
    "code": "400001"
  }
}
```

В логах движка это выглядит как `openai.BadRequestError` →
`llmai.shared.errors.LLMError: 400: The request is invalid: ...`.

## Симптомы

| Где | Что видно |
|---|---|
| Пользователь в Telegram | «Движок сообщил об ошибке. Кредит вернётся на баланс.» |
| Админ-панель бота (Логи) | `raw_status=error`, `error_detail="The request is invalid: This response_format type is unavailable now..."` |
| Логи движка (`docker logs presenton`) | `openai.BadRequestError: Error code: 400 - {'error': {...'code': '400001'}}` |
| Поллинг статуса | HTTP-запросы к `/async-tasks/status/{id}` — 200 OK (задача создалась), но в теле ответа `status=error` |

Важная деталь: часть вызовов LLM **проходит** (в логах видно
`Generated 9 outlines for the presentation` — шаг outline работает),
а падает шаг(и), где в запрос передаётся `response_format`.

## Причина

В коде движка на некоторых шагах генерации в запрос к LLM передаётся
параметр `response_format`, **тип которого недоступен у b.ai для
используемой модели**. Наиболее вероятные кандидаты:

1. `{"type": "json_schema"}` — b.ai (и многие не-OpenAI провайдеры)
   не поддерживают json_schema для ряда моделей;
2. `{"type": "json_object"}` — тоже поддерживается не всеми моделями b.ai;
3. устаревшая версия `llmai`/`openai`-клиента, из-за которой параметр
   формируется в неактуальном формате.

### Уточнено по коду движка (2026-09-01)

- Движок шлёт **structured outputs**: `response_format` с `json_schema`
  (см. `servers/fastapi/tests/unit/test_generate_slide_content.py`,
  `test_templates_v2_generation.py` — `response_format.json_schema == ...`,
  `name == "SlideLayoutResponse"`).
- Падает шаг **`servers/fastapi/utils/llm_calls/generate_presentation_structure.py`
  (строка ~197)** — генерация структуры презентации.
- Шаг outline («Generated 9 outlines for the presentation») идёт **без**
  json_schema — поэтому проходит; шаги с json_schema получают 400.
- Вывод: **текущая модель b.ai не поддерживает json_schema-режим**
  (structured outputs). Либо у модели нет такой поддержки, либо b.ai
  включает её только для определённого списка моделей.

## Диагностика (на сервере)

```bash
# 1. Какая модель/провайдер подключены в движке:
grep -iE "LLM|MODEL|OPENAI|BASE_URL|API_KEY" ~/yarex_presenton/.env

# 2. Где в коде движка задаётся response_format:
grep -rn "response_format" ~/yarex_presenton --include="*.py" | head -20

# 3. Логи движка вокруг ошибки (какой шаг падает):
docker logs presenton 2>&1 | grep -iB5 -A5 "400001\|response_format" | tail -60
```

## Варианты фикса (по убыванию вероятности)

1. **Отключить/ослабить structured outputs для моделей без поддержки**:
   - найти в коде движка, где формируется `response_format` (например, в
     `generate_presentation_structure.py`), и сделать fallback: если модель
     не поддерживает json_schema — не слать `response_format` вовсе
     (движок парсит JSON из текстового ответа) или слать
     `{"type": "json_object"}`;
   - удобно ввести env-флаг вроде `LLM_STRUCTURED_OUTPUTS=false` для
     быстрого переключения без правок кода.
2. **Сменить LLM-модель** в `.env` движка на модель b.ai, поддерживающую
   `json_schema` (список моделей и их возможностей — в доках b.ai;
   если ни одна не поддерживает — остаётся вариант 1).
3. **Обновить зависимости движка** (`llmai`, `openai`) — формат параметра мог
   измениться в новых версиях API.

После правки:

```bash
docker restart presenton
# и проверить генерацию: /start → тема → презентация
```

## Как проверить, что починено

1. Создать презентацию в боте (тема → генерация).
2. В логах движка — ни одного `400` на `chat/completions`.
3. В админ-панели бота (Логи) — вместо `error_detail` с текстом ошибки
   появляется запись об успешном завершении задачи (`status=succeeded`),
   файл доставляется пользователю.

---

## Решение (реализовано 2026-09-01)

В движок (`servers/fastapi`) добавлен env-флаг **`LLM_STRUCTURED_OUTPUTS`**
(по умолчанию `true`):

```bash
# .env движка (сервер yarexlab.ru)
LLM_STRUCTURED_OUTPUTS=false
```

При `false` параметр `response_format` (`json_schema`) **не отправляется**
ни в одном LLM-запросе — ни в `utils/llm_calls/*` (структура, контент слайдов,
outline, web-search-запрос и т.д.), ни в `templates/v2/generation.py`.
Движок парсит JSON из текстового ответа модели:

- `extract_structured_content` теперь снимает markdown-фенсы
  (`` ```json ... ``` ``) и вытаскивает сбалансированный `{...}` из прозы
  вокруг ответа, `dirtyjson` продолжает терпеть грязный JSON;
- schema-валидация с фидбек-лупом исправлений работает как раньше
  (`generate_structured_with_schema_retries` валидирует по `json_schema`
  независимо от того, отправлялся ли `response_format`);
- в `templates/v2/generation.py` тот же флаг + толерантный `_parse_json_content`
  с ретраями-починкой JSON.

Проверка: `docker compose up -d --build` (или `docker restart presenton` после
правки `.env`), далее генерация из бота. Тесты: `tests/unit/test_llm_utils_*`,
`test_templates_v2_generation.py` (новые кейсы «флаг выключен»), полный
`make check` зелёный.

Если позже b.ai заведёт поддержку `json_schema` для используемой модели —
достаточно убрать/перевернуть флаг, код менять не нужно.

---

## Дополнение: переход на DeepSeek (2026-09-02)

Сервер переведён с b.ai на DeepSeek (`LLM=deepseek`,
`DEEPSEEK_MODEL=deepseek-v4-flash`). Выводы по факту:

- **DeepSeek работает с `LLM_STRUCTURED_OUTPUTS=true` (дефолт)** — llmai для
  DeepSeek не шлёт сырой `json_schema`, а конвертирует его в function tool
  (DeepSeek поддерживает tool calls), и ответ приходит валидным JSON.
  Проверено на реальном API: outline `{"slides": [...]}` парсится.
  ⇒ Из `.env` на сервере строку `LLM_STRUCTURED_OUTPUTS=false` **убрать**
  (вернуть дефолт `true`). Флаг оставлен в коде для провайдеров вроде b.ai,
  которые `json_schema` отклоняют.
- **Режим `false` требует JSON-инструкций в тексте промпта**: промпт outline
  раньше не упоминал JSON («Must be in Markdown format») — при выключенном
  `response_format` DeepSeek возвращал чистый Markdown, и эндпоинт падал
  («Failed to generate presentation outlines»). Теперь промпт жёстко требует
  голый JSON `{"slides": [{"content": ...}]}`, а оба outline-эндпоинта
  парсят через `extract_structured_content` (фенсы/проза). Это же чинит
  генерацию outline для любых провайдеров в режиме `false`.
- **`DISABLE_THINKING=true` рекомендуется**: `deepseek-v4-flash` по умолчанию
  думает (thinking mode) и на больших промптах (smart-дека) стримит минутами.
  С выключенным thinking smart-генерация 2 слайдов заняла ~15 с.

Итоговый `.env` движка:

```bash
LLM=deepseek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-v4-flash
DISABLE_THINKING=true
# LLM_STRUCTURED_OUTPUTS — не задавать (дефолт true)
```

Проверка: генерация из бота (outline → структура → контент → pptx) и smart-
генерация на сайте без ошибок; в логах `POST https://api.deepseek.com/...`.

---

*Файл создан по факту инцидента 2026-09-01. Текст ошибки движка логируется
ботом в `story_logs` автоматически (фича добавлена в yarex_lab_tg).*
