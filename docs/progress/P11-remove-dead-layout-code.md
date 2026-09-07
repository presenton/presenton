# P11. Удалить мёртвый код связи с фронтом

Ветка: `feat/remove-dead-layout-code`
Статус: закрыта, влита в `main`.

---

## Что удалено (339 строк + 89 строк тестов)

Разведка показала: цепочка мёртвая целиком, не только три файла из задачи.

- `api/v1/ppt/endpoints/layouts.py` — роутер LAYOUTS_ROUTER не зарегистрирован
  в `api/v1/ppt/router.py`, внутри хардкод `http://localhost:3000/api/layouts`.
- `templates/layout_code_validation.py` — 0 импортёров (grep по всем
  классам/функциям).
- `templates/get_layout_by_name.py` — единственный «живой» вызывающий был
  мёртвый роутер; HTTP-fallback на `http://localhost/api/template` из
  прошлой архитектуры.
- `utils/get_layout_by_name.py` — 5-строчный re-export, нужен только
  удалённому роутеру.
- `templates/custom_layout_from_db.py` — звал только `get_layout_by_name`;
  компилировал кастомные шаблоны через `http://localhost/api/template/custom`.
- Тесты `test_get_layout_by_name_*` (3 шт. + helper) из
  `test_small_surfaces_coverage.py`.

## Что НЕ тронуто и почему

- Генерация шаблонов не задета: `_resolve_generation_layout` в
  `presentation.py` читает `TemplateV2` из БД / bundled-JSON и никогда не
  звал удалённую цепочку (проверено по call graph).
- `TemplateModel` / `PresentationLayoutCodeModel` остаются в
  `bootstrap.py`, `services/database.py`, `alembic/env.py` — таблицы в БД,
  трогать без миграции нельзя (инвариант 4).
- Единственная живая зависимость бэкенда от Next.js — экспорт
  (`utils/export_utils.py` → `/pdf-maker` в headless Chromium).

Тесты: 732 backend (было 735 — минус 3 удалённых), полный гейт зелёный.
