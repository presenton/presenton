# P8. Отображение квоты в профиле веб-фронта

Ветка: `feat/quota-profile-ui`
Статус: закрыта, влита в `main`.

---

## Что сделано

- `servers/nextjs/utils/quota.ts` — типизированный клиент `GET /api/v1/quota`
  (эндпоинт из P4): `normalizeQuotaStatus` валидирует payload (битый ответ =
  `null`, не падение), `fetchQuotaStatus` не бросает никогда — сбой API не
  должен ломать страницу настроек; форматтеры `formatQuotaSummary` /
  `formatResetCountdown` (интервалы «2h 2m / 5m / 45s»).
- `UserQuotaSection.tsx` — секция «Generation quota» в Account-настройках
  (`UserAccountSettings.tsx`): остаток «X of Y left», прогресс-бар
  использованного, обратный отсчёт до освобождения слота, «Unlimited
  generations» при `remaining: null` (безлимит/однопользовательский режим),
  аккуратное «unavailable» при недоступном бэкенде.
- Тесты `tests/quota-summary.test.mjs` (node --test + esbuild): нормализация
  валидных/битых payload, форматтеры, fetch на 500 и на 200.

Стиль секции повторяет карточку аккаунта (lucide-иконка в #F4F3FF,
#7C51F8-акцент, те же скругления/бордеры).

## Явно НЕ делаем

- Автообновление по таймеру — данные нужны на момент открытия настроек.
- Отдельная страница квоты — секция в существующих настройках достаточно.
