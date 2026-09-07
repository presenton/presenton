# P15 — Редакторский REST для Mini App

Архив задачи. Ветка/коммиты: см. git log (M1 редакторского REST).
Гейт: `make check` зелёный (fastapi: 877 passed).

## Проблема

Веб-редактор (Next.js) правит деку через `PATCH /presentation/update`
(структурные изменения = полная замена всех строк slides delete+insert) и
`PATCH /presentation/slide_update` (один слайд, но index/id не меняются).
Для Mini App это неудобно и рискованно (гонки, потеря uuid, большой payload),
а «сырой» правки ui-JSON на клиенте не дают валидации. Чат-инструменты движка
умеют всё, но живут только внутри `/chat/message`.

## Что добавлено (все — cookie-сессия, owner-скоуп на уровне SQL)

### Слайд-операции (`api/v1/ppt/endpoints/slide_ops.py`)
| Маршрут | Семантика |
|---|---|
| `POST /api/v1/ppt/slides/{slide_id}/duplicate` `{at_index?}` | копия слайда (content/ui/properties/html), вставка со сдвигом, переиндексация |
| `DELETE /api/v1/ppt/slides/{slide_id}` | удаление + переиндексация |
| `POST /api/v1/ppt/presentation/{id}/slides` `{layout: code \| __blank_slide__, at_index?}` | новый слайд: blank (BLANK_PRESENTATION_SLIDE_UI) или ui по заготовке из `presentation.layout` (тот же путь, что при генерации — `_template_slide_ui`) |
| `PATCH /api/v1/ppt/presentation/{id}/slides-order` `{slide_ids: [...]}` | перестановка: набор обязан быть перестановкой текущих слайдов, index переписываются по порядку |
| `GET /api/v1/ppt/presentation/{id}/layout-catalog` | каталог заготовок текущего шаблона: `{catalog: [{code, description}], source: template\|deck, blank}` |

Лимит слайдов — `MAX_NUMBER_OF_SLIDES` (50). После изменений структуры
`presentation.updated_at` обновляется (инвалидация кэшей).

### Редакторские проекции (`slide_editor.py` + `services/deck_editor_service.py`)
- `GET /presentation/{id}/editor-view?slide_id=…` — плоский список элементов
  слайда: `{path, id, name, description, type, decorative, rotation, rect
  {x,y,width,height} (1280×720), text/image/font/fill}`. Пути —
  `components[i].elements[j].child.elements[k]…` в формате чат-инструментов.
- `PATCH /presentation/{id}/editor-ops` `{slide_id, ops: [...]}` — атомарный
  батч валидируемых операций; ответ — свежий editor-view:
  - `move`/`resize` — позиция/размер с clamp к сцене; вектор — масштабирование
    `points` по bbox (семантика движкового редактора);
  - `set_text` — text (runs + плоский `text`) и math (`latex`), ограничения
    длины; пустой текст очищает runs;
  - `set_style` — белый список: `font{size,family,color,bold,…}` (только
    text/math/text-list), `fill{color,opacity}` (не text), `alignment`,
    `rotation`; цвета — hex;
  - `set_image_url` — image: `/app_data/*` или `data:image/…` или http(s);
  - `delete`/`duplicate` — запрещены для `decorative`; копия получает
    `id = "<id>_copy"` и вставляется сразу после оригинала;
  - `reorder_element` — `front|back|forward|backward` внутри своего
    контейнера.
  Ошибка любой опции → 400, изменения не сохраняются (работаем на deepcopy).

Модель данных: правки пишутся в `slide.ui` (тексты/картинки/данные живут в
ui-элементах — так делает и чат-редактор, и рендеры); `slide.content` не
трогается.

### Превью после правок (`slide_preview.py`)
`POST /presentation/{id}/preview` получил флаг `refresh: bool = false`:
при `refresh=true` всегда собирается свежий PPTX из текущего состояния деки
(`export_presentation`) и PNG перерендериваются, игнорируя кэш по mtime
(правки не меняют старый файл экспорта). Дорого (Chromium), но только по
явному запросу Mini App; платный экспорт файла при этом не запускается.

## Тесты
- `tests/integration/test_deck_editor_api.py` — 17 интеграционных (sqlite +
  TestClient + owner-ContextVar): дубликат/удаление/добавление blank и по
  заготовке/порядок/каталог/editor-view/ops (set_text, move, resize, style,
  атомарность, decorative-запреты, дубликат+delete+reorder, чужой владелец
  → 404).
- `tests/unit/test_deck_editor_service.py` — 13 unit-тестов сервиса.
- `tests/integration/test_slide_preview_endpoints.py` — +1 тест refresh.

## Ограничения первой версии
- Координаты элементов считаются абсолютными как хранятся в ui; компоненты со
  смещением ≠ 0 на деках default-шаблонов не встречаются (позиция (0,0)).
- editor-view не отдаёт контентные данные chart/table/text-list (только text/
  image + геометрия) — расширение (M4) отдельной задачей.
- Гонка одновременных автосейвов между двумя клиентами не покрыта (веб-редактор
  из пользовательского UI убран, редактирует только Mini App).
