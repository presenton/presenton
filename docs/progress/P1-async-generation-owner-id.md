# P1. owner_id при асинхронной генерации

Ветка: `fix/async-generation-owner-id` (влита в `main`, удалена)
Статус: **ЗАКРЫТА. Бага нет**, правка кода не потребовалась. Добавлен
регрессионный тест `servers/fastapi/tests/unit/test_async_generation_owner_scope.py`.

---

## Итог диагностики

Гипотеза не подтвердилась. `owner_id` при асинхронной генерации проставляется
корректно. Правка кода не нужна.

Проверено локально на настоящем uvicorn с настоящими `SessionAuthMiddleware`,
`_stamp_new_owned_rows` и `_scope_owned_selects`, sqlite в tmp:

| Что проверялось | Результат |
|---|---|
| `owner_id` в БД после async-генерации | равен id вызвавшего пользователя |
| Значение contextvar внутри `BackgroundTasks` | живо, корректное |
| Утечка владельца между параллельными запросами (8 юзеров, пересекающиеся задачи) | не воспроизводится, 8/8 верно |
| Поведение `TestClient` против настоящего uvicorn | совпадает |

---

## Почему исходная гипотеза была неверна

Рассуждение было такое: `SessionAuthMiddleware` сбрасывает contextvar в
`finally`, `BackgroundTasks` выполняются после ответа — значит к моменту
создания `PresentationModel` владельца в контексте уже нет.

Первая часть верна. Порядок действительно такой (замерено):

```
middleware: set owner
endpoint: task registered, returning response
middleware: call_next returned
middleware: FINALLY reset owner      ← сброс происходит ДО задачи
background: started (owner='alice')  ← и владелец всё равно на месте
```

Ошибка была в выводе. `_OWNER.reset(token)` действует на тот контекст, в котором
выполняется сам `reset`, — то есть на контекст `dispatch` в middleware. Фоновая
задача выполняется в другой ветви дерева контекстов, унаследованной от места
установки значения. Сброс в родителе не отменяет значение в уже отделившейся
копии.

Конкретно: `BaseHTTPMiddleware.__call__` запускает downstream-приложение через
`task_group.start_soon(coro)`. anyio копирует контекст при создании задачи.
Значение выставлено до `call_next`, поэтому попадает в копию. `BackgroundTasks`
выполняются в `Response.__call__` внутри этой копии, а `finally` в middleware
работает со своей.

Замечание про `BaseHTTPMiddleware`: изначально я считал её источником риска.
Оказалось наоборот — проверил pure-ASGI вариант, он ведёт себя так же. Дело не
в стиле middleware, а в том, что значение выставляется до ответвления задачи.

---

## Регрессионный тест

`servers/fastapi/tests/unit/test_async_generation_owner_scope.py` — фиксирует
поведение. Не потому что что-то сломано, а потому что оно держится на
неочевидном порядке: «сброс раньше задачи» выглядит как баг, и кто-нибудь
однажды «починит» его, переставив `set_current_owner_id`. Тогда асинхронные
генерации молча начнут писаться с `owner_id = NULL`, а синхронный путь
продолжит работать — расхождение, которое ищется долго.

Тест проверен мутацией: при подмене `set_current_owner_id` на no-op он падает с
`assert None is not None`. То есть он действительно ловит регрессию, а не просто
проходит.

Решения по реализации:

- **`tests/unit/`, не `integration`** — LLM не нужен: тест ставит фоновую задачу,
  создающую строку, и не гоняет генерацию целиком. Секунда против минут.
- **Сырой SQL для чтения `owner_id`** — ORM-select отфильтровался бы
  `_scope_owned_selects`, и тест не различал бы «владелец не проставлен» от
  «строка чужая».
- **`monkeypatch` по модулю `api.middlewares`** — импорты там from-import, так
  что патчить надо атрибуты модуля: `async_session_maker`,
  `is_disable_auth_enabled`, `resolve_request_principal`,
  `maybe_proxy_presenton_cloud_request`.

Грабли, на которые я наступил:

- таблица называется `presentations`, а не `presentation` (`async_tasks`, не
  `async_task`);
- SQLite хранит `Uuid`-колонки hex-строкой **без дефисов**, Postgres — с. Сравнивать
  нормализованно: `str(stored).replace("-", "").lower() == expected.hex`;
- middleware отвечает 428 `setup_required`, пока в таблице `user` нет ни одного
  пользователя — в тесте его надо создать до запроса.

Прогон: `700 passed` (`tests/unit tests/integration`).

---

## Побочные находки

Обе относятся к вебхукам, обе стоит учесть в P7, ни одна не блокирует MVP.

**1. Подписки на вебхуки owner-скоупятся, и это работает.**
`WebhookSubscription` входит в `_STRICT_OWNER_MODELS`.
`WebhookService.send_webhook` делает
`select(WebhookSubscription).where(event == ...)`, а `CONCURRENT_SERVICE.run_task`
использует `asyncio.create_task`, который копирует контекст. То есть выборка
подписок фильтруется по владельцу генерации.

Следствие для бота: одна глобальная подписка «на всех» действительно не
сработает — придётся подписывать каждого пользователя. В брифе разработчику это
уже указано, теперь подтверждено кодом.

**2. Электрон-режим не затронут.**
При `DISABLE_AUTH=true` `owner_id` штатно `NULL` (однопользовательский режим),
`_stamp_new_owned_rows` делает ранний `return`. Мы электрон не поддерживаем
(решение принято), но специально ломать этот путь в рамках P1 незачем — тест
пишем только на многопользовательский сценарий.

---

## Скрипты диагностики

Лежат в `/tmp`, в репозиторий не коммитятся — их роль выполнена, остаётся только
тест из шага 1. Перечислены, чтобы воспроизвести при сомнениях:

| Файл | Что показал |
|---|---|
| `owner_ctx_repro.py` | contextvar доживает до фоновой задачи (упрощённая модель) |
| `owner_hooks_repro.py` | настоящие middleware + хуки: `owner_id` в БД корректен |
| `owner_asgi_compare.py` | pure-ASGI middleware ведёт себя так же — дело не в стиле |
| `owner_ordering.py` | таймлайн: `finally` раньше задачи, владелец всё равно на месте |
| `owner_testclient_check.py` | `TestClient` совпадает с uvicorn |
| `owner_concurrency.py` | 8 параллельных юзеров, межзапросной утечки нет |

---

## Как поднималось локально

```bash
cd servers/fastapi && uv sync --locked --dev
```

Отдельного `.env` не потребовалось: скрипты задают
`APP_DATA_DIRECTORY`, `TEMP_DIRECTORY`, `DATABASE_URL` (sqlite в tmp),
`USER_CONFIG_PATH`, `DISABLE_ANONYMOUS_TRACKING=true` и снимают `DISABLE_AUTH`.
Пользователей скрипты создают сами, руками ничего заводить не нужно.
