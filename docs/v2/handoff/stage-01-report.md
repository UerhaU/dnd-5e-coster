# Отчёт: этап 1 — Каталог: заклинания

Дата: 2026-10-27. Бриф: `stage-01-brief.md`. Ветка: `stage-01-spells`. Пулл-реквест: не создан.

Статус: **промежуточный** — часть А (данные, Issues #2–#7) выполнена и проверена; часть Б (Issues #8–#12) не начата.

## Сделано

### Кэш: какой выбран

| Кэш | Что внутри | Дата | Решение |
| --- | --- | --- | --- |
| `storage/spell-fill/` | 524 страницы `5e14.dnd.su/spells/…` + `index.json` (список сайта с фильтрами: классы, TCE, подклассы, источники, типы урона) | 2026-10-16 | **Выбран**: полный, свежий, только редакция 2014 |
| `storage/imports/cache/dndsu-pages/` | 523 страницы `dnd.su/spells/…` (и предметы, расы) | 2026-06-01 | Не используется: старее, на одну страницу меньше, другой адрес сайта |

Кэши не смешиваются. Недостающих страниц нет (`npm run catalog:fetch` → «Нет в кэше: 0»), ничего не скачивалось.

### Issue #2 — `packages/db`: Drizzle и схема `catalog.db`

- Схема `packages/db/src/catalog/schema.ts` по разделу 5.2: `sources`, `content_entities`, `content_revisions`, `entity_sources`, `spell_index`, `spell_index_classes`, `content_links`, справочники `magic_schools`, `damage_types`, `abilities`, `conditions`, `catalog_info`. Таблиц других категорий нет.
- `content_search` — FTS5 (`unicode61 remove_diacritics 2`, индексы префиксов 2 и 3), отдельной ручной миграцией: Drizzle не описывает виртуальные таблицы.
- Миграции в git: `packages/db/drizzle/catalog/` (`npm run db:generate -w @koster/db`).
- `openCatalogReadOnly` (только чтение, файл обязан существовать), `createCatalog` (миграции + справочники), `normalizeSearchText` (нижний регистр, ё → е — одна функция для индекса и для поиска).
- Схемы Zod в `packages/shared/src/catalog/`: `spell/v1` (`spell.ts`), механика `spell-rules/v1` (`spell-rules.ts`), состав материалов (`material.ts`), блоки текста без HTML (`text-blocks.ts`), коды справочников и классов (`codes.ts`), ID по Р11 (`entity.ts`). Неразобранное поле — `null` и строка в отчёте импорта.

### Issue #3 — `catalog.db` в программе

- Путь — функция `resolveCatalogFile` в модуле путей этапа 0 (`apps/desktop/src/main/paths.ts`): в программе `resources/catalog.db`, в разработке `apps/desktop/resources/catalog.db`.
- `electron-builder.yml`: `extraResources` кладёт `catalog.db` в `resources/`. Главный процесс открывает его только для чтения и пишет версию в журнал (`apps/desktop/src/main/catalog.ts`). Передача в сервер — часть Б.
- CI: перед `npm run dist` собирается тестовый каталог из `data/fixtures/` (`--fixtures --strict`), по Р47.

### Issue #4 — импортёр (cheerio)

Цепочка раздела 6 в `packages/importer/src/`:

| Шаг | Где |
| --- | --- |
| fetch (только недостающее, 1 запрос/с, 3 повтора) | `dndsu/fetch-missing.ts`, `npm run catalog:fetch` |
| parse | `spells/parse-page.ts`, `dndsu/text.ts` |
| normalize | `spells/normalize-spell.ts`, `spells/parse-fields.ts` |
| review | `reviewed/reviewed-spells.ts` |
| validate | Zod `spell/v1` и `spell-rules/v1` в `build/collect-spells.ts` |
| build | `build/write-catalog.ts` |
| report | `report/write-report.ts` → `storage/imports/reports/catalog-build-<время>.md/.json` |

- Ошибка одной страницы не останавливает импорт; ID по Р11 (`spell:fireball`), при совпадении — суффикс источника (совпадений нет).
- Фильтр редакции (Р12): метки-ссылки на 5.5 (`PH24`, `FRHoF` → `next.dnd.su`) не считаются источниками; запись только с источниками 5.5 пропускается с отметкой в отчёте. В кэше таких нет — пропущено 0.
- Страница сверяется с фильтрами списка сайта (уровень, ритуал, концентрация, классы, TCE): расхождений 0.
- Тестовые страницы: `data/fixtures/dndsu/spells/` — 22 заклинания, только карточка (без комментариев и скриптов), 156 КБ. Пересоздаются `node packages/importer/src/cli/make-spell-fixtures.ts`; там же список случаев.

### Issue #5 — ручные исправления v0.1 → `data/reviewed/spells/`

- 305 файлов (один на заклинание, проверяются Zod): **47 проверенных правил**, 280 составов материалов (461 требование, как в v0.1), 25 записей о числе целей, 1 исправление компонентов (`fixes`, «Подарок болтуна»).
- Откуда 47, а не 46: в v0.1 «46» = 42 правила из `spell-reviewed-rules.mjs` + 4 исходные записи (Огненный шар, Лечение ран, Опознание, Благословение), правила которых лежали только в `storage/spell-catalog.sqlite`. Их я переписала вручную по таблицам `effects`/`spell_effects`/`spell_scaling`. 47-е — «Волшебная стрела Джима»: правило в файле v0.1 есть, но v0.1 его не применяла из-за апострофа в ключе (на сайте название без апострофа). Автор решил оставить 47 (вопрос 2).
- Перенос — скриптом `scripts/legacy/convert-spell-reviewed.mts` (читает ветку `legacy`, неизвестное поле эффекта — ошибка, чтобы ничего не потерять). Автоматически выделенные механики v0.1 не перенесены.
- У 47 заклинаний `review_status: rules_verified`, `automation: assisted`, заполнен `rules_json`; у остальных 477 — `parsed`, `display_only`, `rules_json` пустой.
- Для исправления ошибок страницы есть поле `fixes.components` (с обязательной причиной) — пока не используется.

### Issue #6 — `npm run catalog:build`

- `npm run catalog:build` — полный каталог; `-- --fixtures` — тестовый; `--fresh` — без переноса ревизий; `--strict` — код 1 при ошибках.
- Ревизии прошлой сборки переносятся как есть; новая — только если изменились `data_json` или `rules_json` (SHA-256 канонического JSON). Пропавший объект остаётся с ревизиями и пометкой `withdrawn`.
- `catalog_info`: `catalog_version` растёт только при изменениях, `content_hash`, `built_at`, `importer_version`, `source_site`, `source_checked_on`, `source_kind`.
- Защита истории: перед заменой прошлая сборка копируется в `storage/backups/catalog/`; тестовый каталог отказывается заменить полный без `--force`.

### Issue #7 — сверка с v0.1

`npm run catalog:compare-legacy` → `storage/imports/reports/compare-legacy.md/.json`. Сравниваются все поля каждого заклинания. 524 = 524, лишних и пропавших нет. Расхождения:

| Поле | Заклинания | Объяснение | Кто прав |
| --- | --- | --- | --- |
| description — только формат (56) | 6, 7, 8, … | Пробелы, переносы, таблицы. В v0.1 были разорванные слова («испускаю т», «( Расследование )»), в v2 их нет | v2 |
| description + higherLevels (4) | 474 Крошечный слуга, 2341 Волшебная стрела Джима | v0.1 относила к «На больших уровнях» всё до конца страницы («Бестиарий: …», врезку об авторских отчислениях); v2 — только сам абзац | v2 |
| description + higherLevels | 2444 Притяжение, 4664 Разбрасывание карт | На сайте «На больших уровнях .» с пробелом: v0.1 не распознала и оставила абзац в описании | v2 |
| components, royaltyCp | 2340 Сверкающая монета Джима | «С, М (монетка), А (2 зм)»: v0.1 не записала цену отчислений, v2 — 2 зм | v2 |
| components, material, royaltyCp | 1922 Подарок болтуна | На сайте «В, С, М (А 2 зм)». По решению автора это компонент А за 2 зм: исправлено в `data/reviewed/spells/gift-of-gab.json` (`fixes.components`). Расхождения с v0.1 больше нет | v0.1, исправлено |

## Как проверено

| Проверка | Команда или сценарий | Результат |
| --- | --- | --- |
| Линтер, типы, тесты | `npm run check` | прошло: 72 теста в 15 файлах |
| Тесты парсера на fixtures | `packages/importer/src/spells/parse-spell.test.ts` | прошло: 19 тестов, 22 страницы, разные случаи |
| Тесты сборки на временных базах | `build/build-catalog.test.ts`, `packages/db/src/catalog/catalog.test.ts` | прошло: повтор, новая ревизия, withdrawn, битая страница, только чтение |
| Полная сборка | `npm run catalog:build` | 524 заклинания, 0 ошибок, 1 предупреждение (4664: вид дистанции `null`) |
| Повторная сборка | `npm run catalog:build` второй раз | 0 новых ревизий, 0 изменённых, версия 1 |
| Исправление 1922 | `npm run catalog:build -- --strict` после `gift-of-gab.json` | 1 изменённое заклинание, 1 новая ревизия (всего 525), версия каталога 2; сверка: у 1922 расхождений нет |
| Источники без дублей | запрос к `sources` | 15 книг, по одной строке |
| Поиск FTS5 | `MATCH 'name_ru: огнен*'` | находит Огненный шар, Огненные ладони… |
| Тестовый каталог | `npm run catalog:build -- --fixtures --out <временный файл>` | 22 заклинания, 0 ошибок |
| Сверка с v0.1 | `npm run catalog:compare-legacy` | таблица выше |
| Каталог в программе | `npx electron-builder --win dir --x64 -c.directories.output=<scratchpad>`, `node scripts/package-zip.mts <scratchpad>`, запуск `Koster.exe` | в zip есть `Koster/resources/catalog.db`; журнал: «Каталог 1 от …: …\resources\catalog.db»; в `data/` только `electron/` и `logs/`; рядом с `catalog.db` файлов не появилось |

## Не сделано или не проверено

- Часть Б (Issues #8–#12) — по брифу в отдельном чате.
- `npm run dist` в рабочей папке не запускался (известный `EBUSY` этапа 0); собрано обходом во внешнюю папку. CI с новым шагом (тестовый каталог перед zip) прошёл на GitHub после push ветки, проверил автор.
- Связи `content_links` к предметам и классам не заполняются — **долг этапов 2–3**: материалы хранятся текстом и деревом состава без `itemIds`, классы — кодами `class:…` без проверки ссылки, подклассы — названием, классом и номером фильтра DnD.su (ID подклассов появятся на этапе 3).
- `sources.name_ru` пустое: DnD.su показывает названия книг только по-английски.
- Типы урона (`damageTypes`) взяты из фильтра списка сайта, а не из текста.
- Issues #2–#7 не закрыты и не изменены — жду согласия.

## Предлагаемые решения для раздела 2

- **Скрипты разработчика запускаются Node 24 напрямую (type stripping), без `tsx`.** Для этого в `shared`, `db`, `importer` относительные импорты пишутся с `.ts`, в `tsconfig.base.json` включено `allowImportingTsExtensions`. Почему: не нужна новая библиотека; Vite и Vitest такие импорты понимают.
- **Механика заклинаний — схема `spell-rules/v1`** (`packages/shared/src/catalog/spell-rules.ts`), поля перенесены из v0.1 без потерь. В разделе 5.5 упомянута `character-rules/v1` из `docs/character-content-extension-model.md`, но этого файла в `main` нет. Почему: движок правил (этап 4) уточнит словарь `stat`/`trigger`, а данные уже проверяются.
- **Кэш заклинаний — `storage/spell-fill/`** (как оставила v0.1), а не `storage/cache/` из раздела 6; путь задаётся `--cache`. Почему: не трогать файлы автора без нужды. Можно перенести позже.
- **История ревизий хранится только в `catalog.db` автора** (тексты в git нельзя, Р47). Предлагаю закрепить копии в `storage/backups/catalog/` (уже делается) и сборку релиза только с компьютера автора. Почему: если файл потерять, номера ревизий начнутся заново и ссылки персонажей (Р21) сломаются.
- Новые зависимости: `drizzle-orm` (Р20), `drizzle-kit` (миграции Drizzle, только для разработки; `npm audit` — 4 умеренных уязвимости в его старом `esbuild`, в программу не попадает), `cheerio` (раздел 4.4), `domhandler` (типы узлов для cheerio, ставится вместе с ним).
- Раздел 5.2: добавить `spell_index_classes` (класс, вид доступа `standard`/`optional` для TCE), поле `content_entities.withdrawn`, `content_revisions.content_hash`/`created_at`; раздел 10: команды `catalog:fetch`, `catalog:compare-legacy`, флаги `catalog:build`.

## Новые открытые вопросы

1. ~~«Подарок болтуна» (dnd.su 1922)~~ — **решено**: автор подтвердил компонент А за 2 зм, исправлено через `data/reviewed/spells/gift-of-gab.json`.
2. ~~«Волшебная стрела Джима»~~ — **решено**: автор оставил 47 проверенных правил.
3. **Компонент А** (авторские отчисления: цена в золотых за накладывание) — по решению автора отдельный компонент заклинания, не часть М. В данных: `components.royalty {text, costCp}` (1 зм = 100 мм). Сейчас таких 3: «Подарок болтуна» (2 зм), «Сверкающая монета Джима» (2 зм), «Волшебная стрела Джима» (1 зм). Части Б: показывать А на карточке отдельной буквой рядом с В, С, М.

## Что важно знать следующему этапу

- Открыть каталог: `openCatalogReadOnly(file)` из `@koster/db`; в главном процессе соединение уже открыто (`catalog` в `apps/desktop/src/main/index.ts`) — его нужно передать в `createServer`.
- Поиск: в `content_search` тексты уже в нижнем регистре и с «е» вместо «ё»; запрос нормализовать тем же `normalizeSearchText`. Поиск по началу слова — `огнен*`; по полю — `name_ru: огнен*`. Показывать названия из `content_entities`, не из индекса.
- Фильтры: `spell_index` (уровень, школа, ритуал, концентрация), `spell_index_classes` (класс, `standard`/`optional`), `entity_sources` + `sources` (книга, номер и адрес DnD.su).
- Карточка: `content_revisions.data_json` — канонический JSON (ключи по алфавиту) по `spellDataSchema`; описание — блоки `paragraph`/`heading`/`list`/`table`/`quote`, только текст. Неизвестное — `null`: например, у «Разбрасывания карт» `range.kind = null`, показывать `range.text`.
- `catalog_info` для `/api/health`: `catalog_version`, `content_hash`, `built_at`.
- Тестовый каталог для тестов API: `buildCatalog({ cacheDir: DEFAULT_PATHS.spellFixtures, … })` во временный файл — как в `build-catalog.test.ts`.
- В рабочей папке `apps/desktop/resources/catalog.db` — полный каталог версии 1. Не собирать поверх него `--fixtures` (команда откажется без `--force`).

## Отклонения от брифа

- В `data/reviewed/spells/` 47 проверенных правил вместо 46 — см. «Сделано», Issue #5, и вопрос 2.
- Issue #3 «миграции применяются при запуске программы»: для `catalog.db` миграции применяются при сборке (раздел 5.6: каталог не мигрирует, файл заменяется). Миграций `user.db` на этом этапе нет — `user.db` не входит в этап.
- Кроме перечисленных в брифе таблиц добавлены `conditions` (на состояния ссылаются проверенные правила) и `spell_index_classes`.
