# P12. Выпилить Electron

Ветка: `feat/remove-electron`
Статус: закрыта (не слита в `main` — мерж отдельным шагом).

---

## Граница (по разведке)

- `DISABLE_AUTH` остаётся — это режим деплоя без лимитов (tg/03-quota.md),
  опора 6 тест-файлов, к Electron-рантайму не привязан.
- Cypress `--browser electron` в test-all.yml — их браузерный движок, не наше
  приложение.

## Фаза 1. Next.js фронт (закоммичено)

Удалены все ветки `window.electron` из рантайм-кода, 8 файлов:

- `utils/api.ts` — `isElectronRuntime()`, прямое FastAPI-начало для electron;
  остался только query-override.
- `utils/providerUtils.ts` — `isElectronRuntime()`; дефолтный Ollama URL
  всегда `http://host.docker.internal:11434`, localhost-fallback остался
  (полезен и в docker, когда Ollama в том же контейнере).
- `components/OllamaConfig.tsx` — electron-плейсхолдер и подсказка.
- `app/(presentation-generator)/(dashboard)/dashboard/components/DashboardPage.tsx`
  — стейт `isElectronApp`, эффект, баннер «Update Presenton» (electron-only).
- `app/(presentation-generator)/presentation/components/PresentationHeader.tsx`
  — `exportViaIpc`, обе electron-ветки экспорта PPTX/PDF, `exportRuntime`
  в `trackExportLifecycle` (параметр и payload `export_runtime` удалены,
  аналитическое событие осталось).
- `presentation/components/chat/chat-utils.ts` и
  `documents-preview/components/DocumentPreviewPage.tsx` — ветки
  `window.electron.readFile`; чтение всегда через `/api/read-file`.
- `components/OnBoarding/OnboardingPresentonAccount.tsx` — обход
  about:blank-попапа для electron и fallback `window.open` — удалены,
  попап открывается всегда.
- `components/Auth/AuthGate.tsx` + `utils/serverAuth.ts` — сентинел-юзернейм
  `electron` переименован в `local` (это не Electron API, просто строка).
- `types/global.d.ts` — интерфейс `ElectronAPI` и `window.electron` удалены.
- Комментарии в `proxy.ts` и `utils/image-url-converter.ts` переписаны без
  упоминания electron.

## Фаза 2. Конфиг сборки и платформенная ветка рендера (закоммичено)

- `next.config.mjs` — удалён `PRESENTON_ELECTRON_BUILD` и `images.unoptimized`
  (флаг существовал только ради read-only-каталога упакованного electron-приложения).
- `SmartHtmlSlide.tsx` — удалена платформенная развилка
  `NEXT_PUBLIC_PRESENTON_ELECTRON_PLATFORM === "linux"`: компонент
  `LinuxInPageSmartHtmlSlide`, хук `useSlideFontAssets`, проп `executeScripts`
  (после удаления Linux-варианта никем не читался — iframe-вариант всегда
  рендерит через `srcDoc`), конфиг DOMPurify (санитизация жила только в
  Linux-варианте), инлайн-подключение tailwind/chart-скриптов в
  `previewDocument` (нужно было только для in-page исполнения).
  У 3 community-коллаутов снят `executeScripts={false}`.
  Хелперы `useSmartChartInjection`/`TailwindBrowserRuntime` остаются —
  их используют `SmartHtmlEditor` и `PdfMakerPage`.

## Фаза 3. Бэкенд fastapi (закоммичено)

- `services/export_task_service.py` — удалён guard «pinned Electron
  Chromium» (`PRESENTON_ELECTRON=true` → требовал существующий
  `PUPPETEER_EXECUTABLE_PATH`); два теста из `test_runtime_limits.py`
  удалены вместе с ним.
- `mcp_server.py` — MCP-сервер включён всегда: удалены
  `is_mcp_server_enabled()` и ранний return в `main()`; два теста из
  `test_mcp_server_auth.py` удалены.
- `utils/get_env.py` — удалена `is_presenton_electron_desktop()`.
- `api/v1/auth/router.py` — сентинел-юзернейм `"electron"` → `"local"`
  (зеркалит фазу 1; `DISABLE_AUTH`-ответы остались без изменений по форме).
- `services/liteparse_service.py` — убран кандидат-путь
  `electron/resources/document-extraction/…`.
- Комментарии без Electron-рантайма: CORS в `api/main.py`, политика
  oauth-прокси (`presenton_oauth.py`, `middlewares.py`), квоты
  (`quota_service.py`), пути ассетов (`asset_directory_utils.py`,
  `path_helpers.py`, `get_env.py`).

## Фаза 4. Каталог electron/ и CI (закоммичено)

- `git rm -r electron/` — 89 файлов (~20.5k строк): app (main, preload,
  ipc, sentry, updater), build-ресурсы, scripts, package-метаданные.
- Удалён CI-workflow `electron-linux-ubuntu22.yml`.
- Удалён `docs/macos/` (гайды по подписи/notarization десктопа).
- `liteparse_runner.mjs` перенесён из `electron/resources/document-extraction/`
  в `resources/document-extraction/` — backend уже резолвит этот путь
  (`liteparse_service.py`), `Dockerfile`/`Dockerfile.dev` обновлены.
- `scripts/package-metadata.test.mjs` — убраны electron-проверки
  выравнивания версий; проверки root-lockfile и пиннинга export-рентайма
  в Docker остались (тест зелёный).
- `test_server.py` (стаб version-check для десктопного апдейтера) удалён.

## Фаза 5. Доки (закоммичено)

- `README.md` — секции Electron Desktop App / Presenton Desktop, bullet
  в «Why Presenton», заметка MCP-in-Electron удалены; бейдж Platform →
  Docker; Quickstart ведёт на docs-quickstart.
- `CONTRIBUTING.md` — скоуп и setup переписаны под web/Docker-only.
- `.dockerignore` — убран allowlist-блок electron/liteparse.
- `docs/architecture.md` — пометка об удалении; `docs/testing-standards.md`
  — уточнение, что `--browser electron` в Cypress это движок, не наше
  приложение; `AGENTS.md` — electron/ убран из «не трогать»;
  `tasks.md` — P12 отмечена выполненной.

## Что НЕ тронуто

- `image-url-converter.ts` — функция осталась, только комментарий; она
  нормализует `<img>` через общий резолвер и нужна docker/web.
- `trackExportLifecycle` — события аналитики сохранены, убран только
  параметр рантайма.
- Сервер (`PRESENTON_ELECTRON`, `is_presenton_electron_desktop`), CI-workflow
  electron, каталог `electron/` — отдельные фазы.

## Что осталось осознанно

- `cypress --browser electron` в `test-all.yml`, `test-local.sh`,
  `.github/workflows/README.md`, `docs/testing-standards.md` — браузерный
  движок Cypress, к удалённому приложению отношения не имеет.
- Упоминания «Electronics» в `templates/momentum/template.json` — это
  содержимое демо-презентации.
- `LICENSE`/`NOTICE` сторонних пакетов — тексты лицензий.
- `DISABLE_AUTH` и `owner_id = NULL` — не тронуты: это режим деплоя без
  лимитов, к Electron не привязан.

## Проверка

- Repo-wide grep по `electron` (без node_modules/.next/.venv/.git/
  graphify-out): остаются только Cypress-движок, демо-шаблон, лицензии
  и этот архив.
- Frontend: `tsc --noEmit` 0 ошибок; eslint 0 ошибок; `npm run build` —
  успешно (после каждой фазы).
- Backend: ruff check/format чисто; pytest 833 passed (дважды).
- Гейт `make check` — exit 0 перед коммитами фаз 2 и 4; root `npm test`
  (template-конвертеры + package-metadata) — pass.
- prettier: репо не prettier-чистый и в HEAD, форматирование вне скоупа.
