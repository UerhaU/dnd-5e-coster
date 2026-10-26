# Stage 5 Plan: Site Sources and Active DLC

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Date: 2026-05-04

Historical implementation record. Source defaults and entity-level eligibility are superseded by section 9 of [spec revision 2, 2026-10-15](./dnd5e_2014_interactive_app_spec.md). Existing campaign settings must be preserved; the 69/69 universal default below is not the target for new campaigns. The source list still avoids permanent technical review labels.

## Completion Status

Stage 5 is implemented and smoke-tested on 2026-05-04.
It was re-audited on 2026-05-06; the only follow-up fix was to keep `The Book of Many Things` disabled by default for setting-scoped campaigns while preserving the user's requested universal-campaign behavior of enabling all DLC.

User-approved UI adjustments:

- Do not show local PDF copy in the source manager; the visible source label is `dnd.su`.
- Do not show `needs review`, `edition not checked`, or similar review labels in the source list.
- Room source controls use only `Enable` and `Disable` in the UI. Initial room state still follows the campaign until the master changes a source for that room.
- Empty/default character and campaign fields remain allowed during current testing. Required-field enforcement is intentionally postponed to a later validation stage.

## Current Baseline

- Prisma has the Stage 5 core tables: `Setting`, `SourceBook`, `CampaignSourceBook`, and `RoomSourceBookOverride`.
- Backend seeds `Setting` rows and imports all 69 `SourceBook` rows from `storage/imports/dndsu-5e2014-catalog.json`.
- Backend exposes:
  - `GET /api/source-books`;
  - `GET /api/settings`;
  - `PATCH /api/campaigns/:id/source-books/:sourceBookId`.
  - `PATCH /api/rooms/:id/source-books/:sourceBookId`;
  - `GET /api/rules/character-options?campaignId=...&roomId=...&showInactive=...`.
- New campaigns receive campaign source links from seeded `SourceBook` rows.
- Campaign creation can auto-enable all site DLC for universal campaigns, or core/universal plus setting-matched DLC for setting campaigns.
- Campaign view shows the full source manager with all catalog sources, search, and filters.
- Character option autocomplete respects active campaign/room sources when context exists.
- Room-specific source overrides are available through API and UI.
- Local PDFs are not used for source seeding or visible source labels.

## Stage Goal

Give the master clear control over which dnd.su site sources are active for a campaign and, when needed, overridden for a room. Disabled sources must not appear in automatic options by default, while the master can explicitly show inactive sources for manual use.

## Stage 5 Scope

1. Source catalog model polish
   - Keep `SourceBook.sourcePriority = site` for dnd.su sources.
   - Keep `fileName` as a technical `dndsu:*` key, not as a local PDF filename.
   - Make source metadata available to the frontend: `editionCompatibility`, `sourcePriority`, `isCore`, `isOfficial`, `quality`, `notes`.
   - Preserve the special default-disabled behavior for `The Book of Many Things`.

2. Campaign source controls
   - Build a full source management panel in the campaign view.
   - Show all 69 site sources from the catalog, not only the first 8.
   - Add search and filters:
     - active;
     - inactive;
     - homebrew;
     - core sources.
   - Allow the master to enable/disable each source.
   - Keep source labels focused on dnd.su catalog status, without review-warning UI copy during this testing stage.

3. Room setting and source overrides
   - Show the campaign setting and active room setting.
   - Let the master change the room setting.
   - Add room-level source override API:
     - force enabled;
     - force disabled.
   - Display effective room state as enabled or disabled. A room starts from campaign state until the master changes it.

4. Active source filtering for automatic options
   - Add backend helper that computes effective active source titles for a campaign/room.
   - Extend character options API so it can receive `campaignId`, `roomId`, and `showInactive`.
   - Default character creation should use only active campaign/room sources when context exists.
   - Manual fallback remains available.
   - If `showInactive` is enabled, inactive options can be shown with a clear inactive-source hint.

5. Review-needed behavior
   - `The Book of Many Things` stays disabled by default for setting-scoped campaigns.
   - Universal campaigns can still enable all DLC automatically when the master leaves the default DLC checkbox on.
   - Avoid visible `review needed` wording in the source list.
   - 5e 2024-only content should remain hidden by default unless later explicitly allowed by GM.

## Implemented

1. Backend source contract
   - Add richer source fields to frontend types.
   - Add source-state helper functions:
     - campaign active source IDs/titles;
     - room effective source state;
     - setting-match detection for site DLC.
   - Add room override endpoints.

2. Character option filtering
   - Update `GET /api/rules/character-options` to support campaign/room filters.
   - Keep `/api/bootstrap` returning unfiltered catalog options for now or add a clearly named filtered payload later.
   - Ensure disabled source options are excluded unless `showInactive=true`.

3. Campaign UI
   - Replace the 8-pill source preview with a full management section.
   - Add search/filter controls and source badges.
   - Add campaign creation toggles for setting/universal DLC and homebrew DLC.

4. Room UI
   - Add room setting selector.
   - Add room source override controls.
   - Show effective enabled/disabled status next to each source.

5. Verification
   - Run `npm run typecheck`.
   - Run `npx tsc -p backend/tsconfig.json`.
   - Run `npm run build:frontend`.
   - Smoke checks:
     - universal campaign enables 69/69 dnd.su sources;
     - Forgotten Realms campaign enables 34/69 sources after excluding `The Book of Many Things`;
     - disabling `Player's Handbook` in a room removes `Fighter/Воин` from default class options;
     - `showInactive=true` shows that class again with `isActive: false`;
     - source manager copy no longer mentions local PDFs.

## Non-Goals

- Do not import full dnd.su mechanics or rule text in this stage.
- Do not parse, inspect, compare, or seed from local PDF files.
- Do not build inventory, spells, loot, merchants, NPCs, or full source-content search yet.
- Do not implement 5e 2024 content enablement beyond storing/flagging compatibility metadata.

## Acceptance Checklist

- [x] All catalog site sources are visible in campaign source management.
- [x] Campaign source enable/disable is persisted and survives restart.
- [x] Room can override campaign source state with Enable/Disable controls.
- [x] Character class/race/background suggestions respect active source filters when a campaign/room context is selected.
- [x] `The Book of Many Things` is disabled by default for new setting-scoped campaigns and remains manually controllable.
- [x] Local PDFs do not appear in source controls.
