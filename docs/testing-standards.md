# Стандарты тестирования

Правила для тех, кто пишет или чинит тесты. Гейт — `make check` (pytest входит
в него); полный паритет с CI — `make check-full` (добавляет next build и
cypress).

## servers/fastapi (pytest)

### Обязательные env-переменные

Без них тесты не запускаются или лезут в реальные сервисы (см. `Makefile`):

```bash
APP_DATA_DIRECTORY=/tmp/presenton-tests/app-data
TEMP_DIRECTORY=/tmp/presenton-tests/temp
DATABASE_URL=sqlite+aiosqlite:////tmp/presenton-tests/test.db
DISABLE_ANONYMOUS_TRACKING=true
DISABLE_IMAGE_GENERATION=true
```

### Раскладка tests/

| Каталог | Что лежит | Когда класть сюда |
|---|---|---|
| `tests/unit/` | Основная масса (~50 файлов): сервисы, утилиты, auth, миграции, owner-скоупинг | Изолированная логика без поднятия приложения |
| `tests/integration/` | Сквозные потоки: `test_presentation_generation_flow.py`, auth-эндпоинты, images, oauth login | Эндпоинт + БД + сервисы в связке |
| `tests/regression/` | Снапшоты генерации аутлайнов (`snapshots/`, `test_outline_generation_snapshots.py`) | Фиксация поведения, которое нельзя сломать |
| `tests/edge_cases/` | `test_generation_edge_cases.py` — граничные случаи генерации | Нетипичные входы, пустые/битые данные |
| `tests/mocks/` | Фейки: `llm.py` (`FakeLLMClient`, события стрима), `normalizers.py` (нормализация payload для снапшотов) | Общие фейки, переиспользуемые между тестами |
| `tests/` (корень) | Тесты сервисов без подкатегории (chat, image generation, liteparse, mem0, pptx-шрифты) | Наследие; новые тесты лучше класть в подкаталоги |

### conftest.py

Корневой `tests/conftest.py` даёт:

- `fake_async_session` — `FakeAsyncSession`, in-memory фейк AsyncSession
  (add/add_all/delete/commit + счётчики). Для юнит-тестов сервисов без БД.
- `snapshots_dir` / `load_snapshot` — чтение JSON-снапшотов из
  `tests/regression/snapshots/`.

### Конвенции

- LLM не мокаем через unittest.mock по месту — используем `tests/mocks/llm.py`
  (`FakeLLMClient` принимает список событий стрима, записывает вызовы).
- Нестабильный текст перед снапшот-сравнением нормализуем
  `mocks/normalizers.py` (пробелы, сортировка ключей).
- Внешние сервисы (генерация картинок, трекинг, сеть) выключены env-флагами,
  а не try/except в тестах.

### Правило регрессионного теста

На нетривиальный багфикс — тест, который падает без фикса. Эталон:
`tests/unit/test_async_generation_owner_scope.py` — в docstring описано, какое
хрупкое свойство фиксируется (BackgroundTasks видят owner-contextvar) и что
сломается, если его «починить» (презентации уйдут в `owner_id = NULL`).
Пиши так же: тест + объяснение, что именно он страхует.

## servers/nextjs

- `npm test` = `node --test` — юнит-тесты рендеринга в `tests/*.test.mjs`
  (backend-connectivity, infographic/latex/vector rendering, pdf-maker layout).
  Чистая логика без браузера — сюда.
- `npx cypress run --component --browser electron` — компонентные тесты
  (`cypress/`, конфиг `cypress.config.ts`). UI-поведение компонентов — сюда.
  Запускается только в `check-full` (медленно; electron здесь — браузерный
  движок Cypress, не приложение).
- `npm run lint` (ESLint) — часть быстрого гейта.

## Корень

- `npm test` — тесты template-конвертеров (`scripts/convert-template.test.mjs`,
  `scripts/convert-presentation-template.test.mjs`, `package-metadata.test.mjs`)
  через `node --test`. Меняешь конвертер — дополняй его тест.
