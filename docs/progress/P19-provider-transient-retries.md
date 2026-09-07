# P19 — ретраи transient-флеймов провайдера (пустой JSON, недобор аутлайнов)

Дата: 2026-09-05. Ветка: `perf/parallel-slide-llm`, коммит `0db9c856`.

## Контекст

Прод (после отключения reasoning в `/settings` — корень проблемы
«генерация 10+ минут при CPU 20–30%», см. P18): 1-я генерация прошла
за 2 минуты, 2-я упала:

```
('error', 'Presentation generation failed',
 '{"status_code": 500, "detail": "Expecting value: line 1 column 1 (char 0)"}')
```

Диагноз: `json.loads()` от пустой строки. Для openai-совместимых
провайдеров llmai парсит structured-ответ незащищённо
(`llmai/openai/client.py:696: return json.loads(text_content)`);
DeepSeek-клиент llmai защищён, но класс ошибки от модели-флейма
(пустой контент) ни в одном варианте не ретраился — ретраились только
schema-нарушения (P17) и, в ветке P18, 429/5xx. Записи старых ошибок
в async_tasks (502 «Sail Research», export ERR_MODULE_NOT_FOUND) —
уже починенные в образе `main-6881f47` инциденты P17.

Второй флейк того же класса — недобор аутлайнов
(`400 "Failed to generate presentation outlines with requested number
of slides"`), воспроизведён дважды на локальном стенде; в проде не
ретраился.

## Что сделано

1. `utils/llm_utils.py`: `_is_transient_parse_error()` + ретрай
   transient parse-ошибок в `generate_structured_with_schema_retries`
   — отдельный счётчик, до 2 повторов с паузами 1/2 c. Ловит и сырой
   `json.JSONDecodeError`, и обёрнутые варианты по маркерам
   (`expecting value`, `invalid json`, `json decode error`), включая
   прод-кейс `HTTPException(500, "Expecting value: ...")`.
2. `api/v1/ppt/endpoints/presentation.py`: сборка аутлайна вынесена в
   `collect_presentation_outlines()` (стрим → tolerant parse →
   normalize → проверка недобора); единый цикл из 2 попыток: один ретрай
   на `_OutlineTransientError` (пустой JSON / недобор слайдов) и на
   429/5xx от стрима (прежнее поведение сохранено), с warning-логом
   `[presentation.generate] outline transient failure ...`. 400 остаётся,
   если оба выстрела не удались — теперь с деталью причины.
3. Тесты: классификация / retry-then-success / кэп (3 вызова) для parse;
   интеграционный `test_generate_presentation_retries_undershooting_outline`
   (первый стрим 2 слайда из 6 → ретрай → полная генерация).

## Верификация

`make check` exit 0 (ruff + pytest + npm test + eslint + tsc).

## Прод-фоллоуапы

- Уехать в прод вместе с merge ветки `perf/parallel-slide-llm`
  (P18: параллельные слайды + 429-ретраи; P19: этот коммит).
- Точный сайт броска «Expecting value» внутри llmai не локализовался
  трейсбеком (прод-лог обрезан grep'ом); движковый ретрай покрывает
  класс независимо от сайта броска. Если флейм повторится часто —
  завести задачу на патч/обёртку в llmai.
