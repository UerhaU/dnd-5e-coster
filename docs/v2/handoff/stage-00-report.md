# Отчёт: этап 0 — Подготовка

Дата: 2026-10-26. Бриф: `stage-00-brief.md`. Ветки: `legacy` (часть А), `stage-00-setup` (часть А, шаги 5–6, и часть Б). Пулл-реквест: [UerhaU/dnd-5e-coster#1](https://github.com/UerhaU/dnd-5e-coster/pull/1).

Статус: готов к приёмке (части А и Б).

## Сделано

### Часть А (шаги 1–7)

- Ветка `legacy` создана от `main`; незакоммиченная работа v0.1 (69 файлов: каталог рас, снаряжение, аудит каталога, полный каталог заклинаний, скрипты и документы к ним) закоммичена в неё — `d416dc8`.
- Тег `legacy` поставлен на `d416dc8`. Ветка и тег отправлены на GitHub с согласия автора.
- Ветка `stage-00-setup` создана от `main`, в неё слита `v2-docs` (перемоткой вперёд, без конфликтов).
- В `stage-00-setup` коммитом `9a56ff3` через `git rm` удалён код v0.1 (74 файла): `backend/`, `src/`, `prisma/`, `public/`, `database/`, `scripts/`, `index.html`, `spellbook.html`, `start-dnd-local.bat`, `start-spellbook-local.bat`, `stop-dnd-local.bat`, `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `.env.example`, `База заклинаний.accdb`.
- 27 документов v0.1 перенесены через `git mv` в `docs/archive/v0.1/` (Р42). В `docs/` остались ТЗ `dnd5e_2014_interactive_app_spec.md`, `character-creation-rules-engine.md`, `docs/v2/`, `docs/archive/`.
- Локальная ветка `local-before-publication` удалена с согласия автора (была `ddc723c`; коммиты `ddc723c`, `4c83dbd` — ранний каркас v0.1.0-alpha.1 — не были ни на GitHub, ни в других ветках).

### Часть Б — уборка диска

- `database/` (15 файлов) и `dnd database.accdb` перенесены в `storage/legacy-v0.1/`: до и после — 16 файлов, 11 148 703 байта, SHA-256 всех файлов совпадают. В корне их нет.
- Удалены с согласия автора: `node_modules/` (657 МБ, v0.1), `dist/` (15 файлов), `backend/` (`dist/` и `tsconfig.tsbuildinfo`), `scripts/__pycache__/`, затем пустая `scripts/`.
- Не тронуты: `.env`, `.env.local` (не открывались), `book/`, `.codex-logs/`, `storage/*`, `docs/dnd5e_program_overview.pdf`, `docs/private-links.local.md`.

### Часть Б — каркас v2 (коммиты `c7162d7`, `32b78aa`, `8143315`, `5767a52`)

- **Монорепозиторий** (раздел 4.3): npm workspaces; `apps/desktop`, `packages/ui`, `server`, `shared`, `db`, `rules`, `importer`; `data/reviewed/`, `data/fixtures/` (с `.gitkeep`); `storage/` в git только `.gitkeep`. `db`, `rules`, `importer` — заготовки: `package.json`, `src/index.ts`, один тест.
- **Проверки**: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint (`typescript-eslint` strict, `react-hooks`), Prettier, Vitest. `npm run check` = `eslint . && prettier --check .` + `tsc --noEmit` по каждому пакету + `vitest run`.
- **Сервер** `packages/server`: `createServer()` с `GET /api/health` → `{ status, appVersion, sqliteVersion }`; `listenLocal()` слушает только `127.0.0.1` на свободном порту. Чтение ответов разрешено только окну программы (заголовок `Access-Control-Allow-Origin` для разрешённых источников). Схема ответа — Zod в `packages/shared`.
- **Окно** `apps/desktop`:
  - `src/main/window.ts` — `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` (и в воркерах/подфреймах), `webSecurity`, без `webview`; запрет новых окон, навигации на чужие адреса и всех запросов разрешений.
  - `src/preload/index.ts` — узкий preload: окну доступна одна функция `window.koster.getServerUrl()`; главный процесс отвечает только запросам из окна программы.
  - CSP вставляется в `index.html` при сборке (`src/main/csp.ts`): в собранной программе `script-src 'self'` без `unsafe-inline`, `connect-src` — только `127.0.0.1`.
  - Собранный интерфейс открывается по адресу `app://koster/` (свой протокол вместо `file://`), файлы отдаются только из папки интерфейса.
  - React-страница `packages/ui/src/App.tsx`: «Костёр» и статус сервера. Без стиля (Р14, Р28).
- **SQLite**: `better-sqlite3` в главном процессе открывает базу в памяти и отдаёт `sqlite_version()` в `/api/health`.
- **Портативные пути** `src/main/paths.ts` (с тестами): `data/` рядом с exe, в разработке `storage/dev-data/`. В самом начале главного процесса, до `ready`, перенастраиваются `userData`, `sessionData` (→ `data/electron/`), `crashDumps` (→ `data/electron/crashes/`), путь логов (→ `data/logs/`). При запуске создаются `data/` и `data/logs/` и проверяется запись; если нельзя — окно ошибки и выход, без записи в другое место. Журнал главного процесса — `data/logs/main.log`.
- **Сборка**: `electron-builder.yml` (`productName`/`executableName` Koster, Windows x64, asar), `scripts/package-zip.mts` упаковывает в `Koster-<версия>-win-x64.zip` с корневой папкой `Koster/` (встроенным в Windows `tar`). В zip — `README.txt` для пользователя (раздел 4.2). Иконка — стандартная Electron. Версия `2.0.0-alpha.0`. Команда `npm run dist`.
- **CI** `.github/workflows/ci.yml`: `windows-latest`, Node 24, `npm ci` → `npm run check` → `npm run dist` → zip как артефакт `koster-win-x64`. На push и пулл-реквест.
- **`README.md`** под v2: что за программа, запуск zip, SmartScreen, команды разработчика, устройство проекта, где v0.1 (`legacy`).
- **`.gitignore`** переписан: `node_modules/`, `out/`, `dist/`, `release/`, `storage/*` (кроме `.gitkeep`), `*.db`, `*.accdb`, `.env`, `.env.*`, `*.local.*` и прежние правила для книг, архивов, логов. **`.gitattributes`**: LF во всех текстовых файлах.
- Ветка `stage-00-setup` отправлена на GitHub с согласия автора; пулл-реквест [#1](https://github.com/UerhaU/dnd-5e-coster/pull/1) `stage-00-setup` → `main` создан с согласия автора.
- Задачи этапа 1 заведены в GitHub Issues с согласия автора: [#2](https://github.com/UerhaU/dnd-5e-coster/issues/2)–[#12](https://github.com/UerhaU/dnd-5e-coster/issues/12), без меток и вех.

## Как проверено

| Проверка | Команда или сценарий | Результат |
| --- | --- | --- |
| Часть А: `legacy` на GitHub = локальной | `git ls-remote origin` против `git rev-parse` | прошло: ветка и тег `d416dc8` |
| Часть А: `main` на GitHub не изменился | `git ls-remote origin` | прошло: `3d3278c` |
| Часть А: в коммит `legacy` не попали базы, кэш, книги, `.env`, сборки, файлы > 10 МБ | `git add -A --dry-run` + размеры; список показан автору | прошло: крупнейший 1,4 МБ |
| Перенос в `storage/legacy-v0.1/` | число файлов, сумма размеров, SHA-256 до и после | прошло: 16 файлов, 11 148 703 байта, суммы совпадают |
| Игнорирование после нового `.gitignore` | `git check-ignore` для `.env`, `.env.local`, `book`, `.codex-logs`, `storage/legacy-v0.1`, `storage/dnd.sqlite`, PDF, `private-links.local.md`, `out`, `release` | прошло: всё игнорируется; `storage/.gitkeep` в git |
| Чистая установка и проверки | `npm ci`, затем `npm run check` | прошло: lint и Prettier без замечаний, typecheck всех 7 пакетов, 26 тестов в 10 файлах |
| Окно изолировано | тест `window.test.ts` + в собранной программе через отладочный порт: `typeof require`/`process` в окне | прошло: Node в окне недоступен, в `window.koster` только `getServerUrl` |
| CSP в собранной программе | чтение `meta` в окне собранной программы | прошло: `script-src 'self'`, без `unsafe-inline` |
| Сервер слушает только 127.0.0.1 | тест `listenLocal` + `netstat -ano` для процессов Koster | прошло, см. ниже |
| `npm run dev` | запуск, чтение окна через отладочный порт | прошло: «Сервер работает. Версия программы 2.0.0-alpha.0, SQLite 3.53.4.»; данные в `storage/dev-data/` |
| `npm run dist` | сборка zip | прошло: `Koster-2.0.0-alpha.0-win-x64.zip`, 141 МБ, внутри `Koster/Koster.exe` |
| Запуск zip в пути с пробелом и кириллицей без Node.js | распаковка в `D:\тест Костёр\`, `PATH` без Node.js (`Get-Command node` → нет), запуск `Koster.exe` | прошло: окно «Сервер работает. Версия программы 2.0.0-alpha.0, SQLite 3.53.4.» |
| Рядом с exe появилась только `data/` | список папок `Koster/` до и после | прошло: до — `locales`, `resources`; после — `data`, `locales`, `resources` |
| AppData не тронут | списки `%APPDATA%` и `%LOCALAPPDATA%` до и после, см. ниже | прошло: совпадают |
| Папка только для чтения | копия программы, `icacls /deny <пользователь>:(WD,AD)`, запуск | прошло: окно «Костёр не может запуститься» с объяснением, `data/` не создана |
| GitHub Actions | запуск на push `5767a52` | прошло: `npm ci`, `npm run check`, `npm run dist`, артефакт zip 141 МБ |

Вывод `netstat -ano` для процессов собранной программы (PID 5064; второй порт — отладочный, включённый для проверки окна):

```
TCP    127.0.0.1:9333         0.0.0.0:0              LISTENING       5064
TCP    127.0.0.1:51546        0.0.0.0:0              LISTENING       5064
```

При запуске без отладочного порта — одна строка: `TCP 127.0.0.1:59443 0.0.0.0:0 LISTENING 20104`.

Сверка AppData (PowerShell):

```
Get-ChildItem -Force $env:APPDATA      | Select-Object -ExpandProperty Name | Sort-Object > appdata-before.txt
Get-ChildItem -Force $env:LOCALAPPDATA | Select-Object -ExpandProperty Name | Sort-Object > localappdata-before.txt
# распаковка, запуск Koster.exe, закрытие
... те же команды в *-after.txt
Compare-Object (Get-Content appdata-before.txt) (Get-Content appdata-after.txt)
```

```
--- APPDATA до/после ---
совпадают (58)
--- LOCALAPPDATA до/после ---
совпадают (101)
--- новое в Temp после запуска (кроме claude) ---
(пусто)
```

Состав `data/` после запуска: `logs/main.log` и `electron/` (кэш и служебные файлы Chromium: `Cache`, `GPUCache`, `Local Storage`, `Network` и др.).

Сообщение при папке только для чтения:

```
Костёр не может запуститься
Костёр не может сохранять данные в папке:
D:\тест Костёр RO\Koster\data

Переместите папку программы туда, где разрешена запись (например, в «Документы» или на флешку), и запустите её снова.
```

GitHub Actions — запуск [40379603500](https://github.com/UerhaU/dnd-5e-coster/actions/runs/40379603500) на `5767a52` (`windows-latest`): **success**. Все шаги прошли: `npm ci`, `npm run check`, `npm run dist`, сохранение zip. Артефакт `koster-win-x64` — 141,0 МБ.

## Не сделано или не проверено

- Запуск на чистой Windows без средств разработки не проверялся (раздел 9 требует этого перед релизом, а не на этапе 0). Проверено на машине автора с `PATH` без Node.js.

## Предлагаемые решения для раздела 2

Главный чат переносит их в техническую документацию только после согласия автора.

- Служебные файлы Electron/Chromium лежат в `data/electron/` — кэш Chromium нельзя отключить полностью; так `data/` остаётся единственным местом записи, а будущие `user.db`, `backups/`, `portraits/` не смешиваются с кэшем.
- Собранный интерфейс открывается по своему протоколу `app://koster`, а не `file://` — у окна постоянный адрес, по нему сервер и главный процесс отличают окно программы от любых других страниц.
- Пакеты монорепозитория подключаются как исходники TS (`exports: ./src/index.ts`) и собираются в бандл `electron-vite`; в программу как зависимости копируются только `fastify` и `better-sqlite3`.
- Версии: Electron 44 (45 вышел за 5 дней до этапа), TypeScript 6.0 (typescript-eslint пока не поддерживает 7), Vite 7 + electron-vite 5. Обновлять отдельной задачей.

## Новые открытые вопросы

- Electron закреплён точной версией `44.9.3` (этого требует electron-builder). Как часто обновлять Electron (безопасность Chromium) — к релизу.
- Окно ошибки до запуска программы имеет системный заголовок «Error» (ограничение Electron до `ready`); текст — по-русски. Устраивает ли — к Д1.

## Что важно знать следующему этапу

- `better-sqlite3` 13 поставляется готовыми сборками Node-API: работает и в Node (Vitest), и в Electron без пересборки, поэтому `npmRebuild: false`. Работа в zip проверена. Если сменить версию или библиотеку — проверять снова в zip.
- В Electron 44 бинарник не скачивается при `npm install`: в `apps/desktop` есть `postinstall: install-electron`.
- `better-sqlite3` не используется в тестах Vitest: сервер получает версию SQLite параметром. Для `packages/db` на этапе 1 это нужно решить заново (тесты сервера — на временных базах, раздел 9).
- Электрон-сборка в `apps/desktop/release/`. В рабочей папке автора приложение Claude держит открытым `release/win-unpacked/resources/app.asar` (наблюдатель за папкой проекта), из-за чего повторный `npm run dist` падает с `EBUSY`. Обход: собирать во внешнюю папку — `npx electron-builder --win dir --x64 -c.directories.output=<папка>`, затем `node scripts/package-zip.mts <папка>`. В CI проблемы нет.
- Prettier проверяет LF; `.gitattributes` закрепляет LF при checkout на Windows.
- Тестовая папка `D:\тест Костёр\` с распакованной программой оставлена на диске автора для ручной проверки.
- Новые маршруты сервера — по образцу `packages/server/src/routes/health.ts`, схемы ответов — в `packages/shared`.

### Список задач этапа 1 (каталог: заклинания)

Составлен по таблице раздела 11 и брифу. Заведены в Issues #2–#12 в том же порядке.

1. `packages/db`: Drizzle и схема `catalog.db` (объекты, ревизии, справочники) по разделу 5.
2. Миграции и их применение при запуске; `catalog.db` попадает в zip.
3. `packages/importer`: разбор кэша DnD.su из `storage/` (cheerio), парсер заклинаний, тесты на `data/fixtures/`.
4. Перенос проверенных правил заклинаний из ветки `legacy` в `data/reviewed/`.
5. `npm run catalog:build`: сборка `catalog.db`; повторная сборка не создаёт дублей.
6. Сверка с v0.1: 524 заклинания, отчёт о расхождениях.
7. API каталога (список с фильтрами, карточка) и схемы Zod в `shared`.
8. Полнотекстовый поиск FTS5 по-русски, «ё = е».
9. Интерфейс: React Router, TanStack Query, временная тема (Р14), экраны поиска и карточки заклинания.
10. Playwright: сценарий «найти заклинание» в собранной программе.
11. Выборка заклинаний для проверки автором.

## Отклонения от брифа

- Часть Б выполнена в том же чате, что и часть А (по решению автора).
- «После запуска появились только `data/` и `data/logs/`»: рядом с exe действительно появилась только `data/`, но внутри неё, кроме `logs/`, есть `data/electron/` — служебные файлы Chromium (см. предложенное решение выше).
- «Пересобирать нативный модуль под Electron»: не понадобилось — `better-sqlite3` 13 работает через Node-API; проверено в zip.
- Уточнение части А: `.env.example` и `База заклинаний.accdb` отслеживались в git и удалены из `stage-00-setup` как файлы v0.1 (остаются в `legacy`).
