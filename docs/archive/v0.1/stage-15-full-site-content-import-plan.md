# Stage 15 Plan: Full Site Content Import

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

> Последний приоритет пользователя: закончить локальный функционал и внешний вид до работы над сетевым сервером и защитой. Историческая приостановка UI-полировки ниже отменена; импорт расширяется по потребностям очередного локального сценария.

Status: started on 2026-06-01.

First implementation slice completed on 2026-06-01:

- Added `ImportedContent` as the stable storage table for imported site entities.
- Added `npm run import:dndsu:content -- spells`.
- Imported 522 spell records from the existing `dndsu-5e2014-catalog.json` into SQLite.
- Added backend API:
  - `GET /api/rules/imported-content/stats`;
  - `GET /api/rules/imported-content?category=spells`.
- Verified idempotent re-run: second import updated 522 records and created 0 duplicates.

Second implementation slice completed on 2026-06-01:

- Added cached detail-page fetching for spell pages under `storage/imports/cache/dndsu-pages`.
- Imported details for all 522 spell pages with `npm run import:dndsu:content -- spells --details`.
- Extracted reliable spell fields from detail pages: casting time, range, duration, components, material component text, classes, subclasses, description presence, and higher-level text presence.
- Verified the detail import completed with `detailsImported: 522` and `detailErrors: 0`.
- Verified API returns detailed spell payloads and parsed mechanics.

Third implementation slice completed on 2026-06-01:

- Added `magicItems` support to `npm run import:dndsu:content`.
- Imported 934 magic items with `npm run import:dndsu:content -- magicItems --details`.
- Extracted reliable item fields: type/rarity line, recommended price text and parsed gp range, attunement flag, description presence, source and edition metadata.
- Verified the magic item detail import completed with `detailsImported: 934` and `detailErrors: 0`.
- Added `npm run report:dndsu:review`.
- Generated review reports:
  - `storage/imports/dndsu-stage15-review-report.json`;
  - `docs/stage-15-import-review-report.md`.
- Current imported total: 1456 records.

Fourth implementation slice completed on 2026-06-01:

- Added source-record imports for the remaining catalog categories:
  - 16 classes;
  - 48 races/origins;
  - 91 backgrounds;
  - 106 feats;
  - 2867 monster/NPC rows from 2874 catalog entries.
- Monster/NPC source records keep catalog mechanics hints: NPC flag, classic variant flag, challenge value when present, size IDs, type IDs, and alignment IDs.
- The monster catalog contains 7 duplicate canonical IDs; the importer updated existing rows instead of creating duplicate records.
- Current imported total: 4584 stable `ImportedContent` rows.
- Current review report summary:
  - 109 rows without matched `SourceBook`;
  - 210 rows with unknown edition;
  - 31 English-name duplicate candidate groups;
  - 1 mechanics duplicate candidate group.

## Decision

The interface pass is paused here. Current UI only needs to stay usable for testing. Final visual polish, BG3-like composition refinements, item icons, NPC portraits, inventory art, and other images move to a later polish/content-art stage after imported entities have stable IDs.

## Goal

Import real `dnd.su` mechanics and structured content for D&D 5e 2014 without using local PDFs.

## Scope

1. Define import data contracts for site entities:
   - source books;
   - classes, races/origins, backgrounds;
   - spells;
   - items and magic items;
   - monsters/NPC source records;
   - feats/features where available.
2. Extend the parser beyond metadata:
   - keep source URL and source title;
   - preserve Russian names;
   - keep English names when available;
   - extract structured mechanics where reliable;
   - store uncertain fields with review status instead of guessing.
3. Add edition/source confidence:
   - `5e_2014`;
   - `5e_2024`;
   - `universal_5e_2014_2024`;
   - `unknown`;
   - `conflict`.
4. Apply active source filters:
   - campaign sources;
   - room overrides;
   - hidden 2024-only content by default;
   - `The Book of Many Things` disabled by default unless GM enables it.
5. Start with one category, verify, then expand.

## Non-Goals

- Do not parse local PDFs.
- Do not compare site text against local books.
- Do not finish final UI polish in this stage.
- Do not generate final item/NPC images yet; create the data foundation first.

## Acceptance Checklist

- [x] Parser imports one real category from `dnd.su` into stable structured storage.
- [x] Imported rows keep entity URL, source title, edition compatibility, and review status.
- [x] Campaign/room source filtering affects imported options via API.
- 5e 2024-only content is hidden by default.
- Universal 5e content can appear for 5e 2014 campaigns when safe.
- [x] Duplicate review report uses English names and mechanics fingerprints, not Russian name alone.
- [x] The import can be rerun without duplicating records.
- [x] Typecheck passes after the first imported category is wired into the app.
- [x] Spell detail pages are cached and imported without detail errors.
- [x] Magic item detail pages are cached and imported without detail errors.
- [x] Review report lists unmatched sources and duplicate candidates.
- [x] All categories from the current `dndsu-5e2014-catalog.json` are represented in stable imported storage.

## Next Slice

- Review or map the 109 rows without matched `SourceBook`.
- Add deep page parsers for monster stat blocks, class progression/features, races/origins, backgrounds, and feats when those screens need full automation.
- Wire imported categories into character creation, inventory, encounter/NPC tools, and search screens as each UI flow is rebuilt.
