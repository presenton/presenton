# 04. Редакторский REST (правки презентации из Mini App)

Записка к P15 (docs/progress/P15-deck-editor-api.md): маршруты, которые Mini App
использует для редактирования деки без веб-редактора. Все ручки — под
cookie-сессией движка (`POST /api/v1/auth/telegram` → `presenton_session`),
изоляция — owner-скоупом: чужая/несуществующая дека или слайд → 404.

## Структура деки

`GET /api/v1/ppt/presentation/{id}` — презентация + слайды (index по порядку).
У слайда правится **ui** (тексты/картинки/данные живут в элементах ui);
`content` после генерации — копия для аудита, редакторские правки её не трогают.

## Слайд-операции

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/api/v1/ppt/slides/{slide_id}/duplicate` | `{at_index?}` | SlideModel (новый uuid) |
| DELETE | `/api/v1/ppt/slides/{slide_id}` | — | 204 |
| POST | `/api/v1/ppt/presentation/{id}/slides` | `{"layout": "<code>" \| "__blank_slide__", "at_index": N}` | SlideModel |
| PATCH | `/api/v1/ppt/presentation/{id}/slides-order` | `{slide_ids: [uuid…]}` (перестановка) | `{ok, slides}` |
| GET | `/api/v1/ppt/presentation/{id}/layout-catalog` | — | `{catalog:[{code, description}], source, blank}` |

`layout-catalog` — заготовки шаблона деки (`presentation.layout`), `source:
"template"`; для старых дек без каталога — `source: "deck"` (слайды как
заготовки-копии). Максимум слайдов — 50 (`MAX_NUMBER_OF_SLIDES`), нарушение — 400.

## Редакторские проекции

`GET /api/v1/ppt/presentation/{id}/editor-view?slide_id={uuid}`

Плоский список элементов слайда для canvas-редактора:

```json
{
  "slide_id": "...", "presentation_id": "...", "editable": true,
  "width": 1280, "height": 720, "background": "#FFFFFF",
  "elements": [
    {"path": "components[1].elements[0]", "id": "heading", "name": "heading",
     "type": "text", "decorative": false, "rotation": null,
     "rect": {"x": 90, "y": 100, "width": 800, "height": 80},
     "text": "Заголовок", "font": {"size": 44, "color": "#000000"}}
  ]
}
```

Поля по типам: text/math — `text` (+ `font`); image — `image` (url);
`decorative: true` — рисование/фон, править нельзя (кроме перемещения-нет:
полностью защищены). `editable: false` — слайд без ui-лейаута (не
рендерится из ui), правки недоступны (422 на ops).

## Операции над элементами

`PATCH /api/v1/ppt/presentation/{id}/editor-ops`

```json
{"slide_id": "<uuid>", "ops": [{"op": "set_text", "element_path": "components[1].elements[0]", "text": "..."}]}
```

Операции (батч атомарен; ошибка любой — 400, ничего не сохраняется;
ответ — свежий editor-view):

| op | поля | семантика |
|---|---|---|
| `move` | `position {x, y}` | смещение (clamp 0..1280×720), для векторов — points по bbox |
| `resize` | `size {width, height}` | изменение размера |
| `set_text` | `text` | text/math: runs + плоский `text` (math — `latex`) |
| `set_style` | `patch {font?, fill?, alignment?, rotation}` | белый список; font — только text/math/text-list, fill — не text, цвета — hex |
| `set_image_url` | `url` | image: `/app_data/...`, `data:image/...`, http(s) |
| `delete` / `duplicate` | — | запрещены для `decorative`; копия — `id_с суффиксом "_copy"` сразу после оригинала |
| `reorder_element` | `direction` | `front\|back\|forward\|backward` внутри своего контейнера |

После каждой структурной/элементной правки `presentation.updated_at`
обновляется.

## Превью после правок

`POST /api/v1/ppt/presentation/{id}/preview` — тело `{pptx_path?, refresh?}`.
`refresh: true` — собрать свежий PPTX из текущего состояния деки и
перерендерить PNG (правки не трогают старый файл; кэш по mtime был бы
устаревшим). Ответ тот же: `{slides: ["/app_data/..."], width: 1280, height: 720}`.
Платный экспорт файла при этом не запускается; рендер — headless Chromium,
дорого: звать только по действию пользователя.

## Ошибки

404 — чужая/нет деки или слайда; 400 — невалидная операция/не перестановка;
422 — нет каталога/неизвестный layout/слайд без ui; 403 — чужой `pptx_path`.

## M4: editor-state, add_element, set_data, rich-text

- `PATCH /api/v1/ppt/presentation/{id}/editor-state` — `{slide_id, ui: {...}}`
  полная замена ui слайда (опора undo/redo): клиент хранит снимки `ui` из
  ответов editor-view/editor-ops и восстанавливает их. 422 — ui не слайд.
- `editor-view` и `editor-ops` теперь возвращают поле `ui` (полный слайд-снимок).
- Новая op в `editor-ops`: `{"op": "add_element", "type": "text"|"image"|"rectangle", "rect": {x,y,width,height}}` —
  добавляет элемент в компонент с редактируемым контентом (или создаёт новый).
- Новая op: `{"op": "set_data", "element_path": …, "data": …}` — данные сложных
  элементов: для `text-list` — `{items: [string]}`; для `chart` —
  `{categories?: [string], series?: [{name, data: [number]}]}`.
- `set_text` понимает разметку `**жирный**`, `*курсив*`, `<latex>…</latex>`:
  при наличии стилей runs сохраняются стилизованными, плоский `text` не пишется
  (рендер отдаёт приоритет плоскому тексту).
- editor-view для `text-list`/`chart` отдаёт читаемый `complex`-предпросмотр
  (`{kind, items}` / `{kind, categories, series}`) — для форм данных.
