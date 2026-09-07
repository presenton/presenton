# AGENTS.md

## 1. Обзор проекта

Форк open-source генератора AI-презентаций Presenton, используется как база для
Telegram-бота генерации презентаций (Telegram-часть — у другого разработчика,
нам принадлежат `servers/fastapi` и `servers/nextjs`).

Стек: backend `servers/fastapi` (Python 3.11, uv, FastAPI, pytest, ruff),
frontend `servers/nextjs` (Next.js 16 / React 19, npm, ESLint, node --test,
Cypress), корневые npm-скрипты для template-конвертеров.

## 2. Быстрые команды

| Команда | Назначение |
|---|---|
| `make setup` | Установка зависимостей (uv sync + npm ci ×2) |
| `make check` | **Обязательный гейт**: ruff + pytest + npm test + lint. Должен давать exit 0 перед коммитом |
| `make check-full` | Полный паритет с CI (test-local.sh: + next build + cypress) |
| `make fix` | Автофиксы: ruff check --fix, ruff format, eslint --fix |

## 3. Роутинг документации (читать по условию)

| Файл | Когда читать |
|---|---|
| `PROGRESS.md` | Всегда при clock-in — там единственная активная задача |
| `docs/architecture.md` | Меняешь структуру или границы компонентов |
| `docs/testing-standards.md` | Пишешь или чинишь тесты |
| `tasks.md` | Выбираешь задачу |
| `tg.md` | Работаешь над Telegram-интеграцией / API-контрактами |
| `docs/progress/` | Закрываешь задачу — архив выполненных |
| `docs/init.md` | Спека harness-системы |

## 4. Жёсткие инварианты

1. **WIP=1**: ровно одна активная задача в `PROGRESS.md`. При clock-out —
   архив в `docs/progress/`, сброс в `No active task`.
2. **pyright остаётся `off`** (`typeCheckingMode = "off"` в pyproject.toml) —
   не включать без отдельной задачи.
3. **tsc входит в гейт** через `tsconfig.codex-check.json`
   (`npx tsc --noEmit -p tsconfig.codex-check.json`, baseline зелёный) —
   не отключать; pyright для Python при этом остаётся `off` (пункт 2).
4. **Схему БД не менять без миграции alembic** (`servers/fastapi/alembic/`).
5. **Никаких `# type: ignore` / `# noqa` без комментария-причины** рядом.
6. **`make check` зелёный до коммита.** Исключения согласуются явно.

## 5. Lifecycle

1. **Clock-In**: прочитать `PROGRESS.md` → взять задачу из `tasks.md` →
   записать её как активную в `PROGRESS.md`.
2. **Execute**: минимальный работающий дифф, инварианты из раздела 4.
3. **Verification**: `make check` → exit 0 (детерминированное доказательство,
   самооценка LLM не засчитывается). Хук `.harness/hooks/post_task_check.sh`.
4. **Clock-Out**: обновить/архивировать `PROGRESS.md` (выполненное — в
   `docs/progress/`, сброс в `No active task`), зелёный гейт, чистый
   `git status` (только осмысленные файлы).

## 6. Что не трогать

- `tasks.md`, `tg.md`, `docs/init.md`, CI-воркфлоу (`.github/`) —
  по содержимому без отдельной задачи.
- Новые зависимости и фреймворки (pre-commit, husky, mypy) — только через
  согласование задачи в `tasks.md`.
