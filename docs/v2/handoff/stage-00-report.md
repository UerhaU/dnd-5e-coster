# Отчёт: этап 0 — Подготовка

Дата: 2026-10-26. Бриф: `stage-00-brief.md`. Ветка: `legacy` (часть А, шаги 1–4), `stage-00-setup` (шаги 5–6). Пулл-реквест: не создан.

Статус: промежуточный — часть А готова, часть Б не начата.

## Сделано

Часть А (шаги 1–7 брифа):

- Ветка `legacy` создана от `main`; незакоммиченная работа v0.1 (69 файлов: каталог рас, снаряжение, аудит каталога, полный каталог заклинаний, скрипты и документы к ним) закоммичена в неё — `d416dc8`.
- Тег `legacy` поставлен на `d416dc8`. Ветка и тег отправлены на GitHub с согласия автора.
- Ветка `stage-00-setup` создана от `main`, в неё слита `v2-docs` (перемоткой вперёд, без конфликтов).
- В `stage-00-setup` коммитом `9a56ff3` через `git rm` удалён код v0.1 (74 файла): `backend/`, `src/`, `prisma/`, `public/`, `database/`, `scripts/`, `index.html`, `spellbook.html`, `start-dnd-local.bat`, `start-spellbook-local.bat`, `stop-dnd-local.bat`, `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `.env.example`, `База заклинаний.accdb`.
- 27 документов v0.1 перенесены через `git mv` в `docs/archive/v0.1/` (Р42). В `docs/` остались ТЗ `dnd5e_2014_interactive_app_spec.md`, `character-creation-rules-engine.md`, `docs/v2/`, `docs/archive/`.
- В git оставлены: `README.md`, `.gitignore`, `design/`, `storage/.gitkeep`.
- Локальная ветка `local-before-publication` удалена с согласия автора (была `ddc723c`; коммиты `ddc723c`, `4c83dbd` — ранний каркас v0.1.0-alpha.1 — не были ни на GitHub, ни в других ветках).

## Как проверено

| Проверка | Команда или сценарий | Результат |
| --- | --- | --- |
| Нет пересечений `v2-docs` с незакоммиченной работой | `git diff --stat main v2-docs` — только `docs/v2/`, `design/` | прошло |
| В коммит `legacy` не попали базы, кэш, книги, `.env`, `*.local.*`, сборки, файлы > 10 МБ | `git add -A --dry-run` + размеры и фильтр по именам; список показан автору | прошло: крупнейший файл `database/spells/full-catalog.json`, 1,4 МБ |
| `legacy` чистая после коммита | `git status --short` | прошло: пусто |
| Ветка и тег на GitHub совпадают с локальными | `git ls-remote origin` против `git rev-parse refs/heads/legacy refs/tags/legacy` | прошло: оба `d416dc8…` на GitHub и локально |
| `main` на GitHub не изменился | `git ls-remote origin` | прошло: `3d3278c` |
| В `stage-00-setup` нет кода v0.1 | `git ls-files` | прошло: остались только файлы из списка выше |
| `storage/` и `book/` на диске целы | `ls -d storage book` | прошло |
| Ветки `local-before-publication` нет | `git branch -vv` | прошло |

## Не сделано или не проверено

- Часть Б (каркас монорепозитория, Electron, Fastify, сборка, CI, README, задачи этапа 1) — по плану в отдельном чате.
- `stage-00-setup` на GitHub не отправлена — отправка не входила в часть А; push — с согласия автора в части Б.
- На диске остались неотслеживаемые (игнорируемые) файлы v0.1: `node_modules/`, `dist/`, `backend/dist/`, `backend/tsconfig.tsbuildinfo`, `database/` (9 сохранённых страниц и JSON снаряжения в `database/equipment/`, 5 бэкапов Access в `database/spells/backups/`, `database/spells/work/`), `scripts/__pycache__/`, `.env`, `.env.local`, `dnd database.accdb`. Не тронуты: брифом разрешено удалять только `node_modules/` и `dist/` и только после показа автору. Часть `database/` может пригодиться этапам 1–2 — предлагается решить с автором до удаления.
- `.gitignore` пока от v0.1 — переписывается в части Б.

## Предлагаемые решения для раздела 2

- Нет.

## Новые открытые вопросы

- Игнорируемые рабочие файлы в `database/` (страницы DnD.su по снаряжению, бэкапы Access) есть только на диске, в `legacy` их нет. Нужны ли они этапу 1 и не переложить ли их в `storage/` — до чистки диска в части Б.

## Что важно знать следующему этапу

- Ветка и тег называются одинаково (`legacy`), поэтому короткое имя git считает неоднозначным. В командах писать `refs/heads/legacy` или `refs/tags/legacy`.
- Файла лицензии в репозитории нет (бриф говорит «оставить лицензию» — оставлять было нечего).
- Часть Б начинается в ветке `stage-00-setup` (последний коммит `9a56ff3`); `.gitignore` и `README.md` там ещё от v0.1.
- Локальная `legacy` не связана с `origin/legacy` (push шёл по полным именам ссылок без `-u`) — на работу не влияет.

## Отклонения от брифа

- Нет. Уточнение: `.env.example` и `База заклинаний.accdb` отслеживались в git и удалены из `stage-00-setup` как файлы v0.1 (остаются в `legacy`).
