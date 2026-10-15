# Stage 6 Plan: Inventory and Equipment

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Date: 2026-05-06

## Baseline Check

- Stage 5 is marked complete in `docs/codex_working_roadmap.md` and `docs/stage-5-site-sources-plan.md`.
- `npm run typecheck` passes.
- `npx tsc -p backend/tsconfig.json` passes.
- Prisma already has `CampaignCharacterState.inventoryJson`, so Stage 6 can start without a schema migration.

## Completion Status

Stage 6 is implemented and smoke-tested on 2026-05-06.

## Stage Goal

Give each campaign character a usable inventory: money, items, quantities, weight, equipment slots, active weapon, damage preview, proficiency warning, item actions, transfer between campaign characters, and action logging.

## Implementation Scope

1. Backend inventory contract
   - Store a sanitized inventory object in `CampaignCharacterState.inventoryJson`.
   - Add endpoint to update campaign character inventory.
   - Add endpoint to transfer item quantities between campaign characters in the same campaign.
   - Create save snapshots for inventory edits and transfers.
   - Broadcast room refresh events after inventory changes.

2. Frontend inventory UI
   - Show inventory only for a selected campaign character state, not for the library-only sheet.
   - Edit money and add items with type, quantity, weight, damage, armor, and proficiency data.
   - Show total carried weight.
   - Equip/unequip weapons, armor, off-hand items, and quick slot items.
   - Show active weapon damage preview.
   - Warn when the active weapon is not marked proficient.
   - Provide row-level item actions and transfer controls.

3. Verification
   - `npm run typecheck` passes.
   - `npx tsc -p backend/tsconfig.json` passes.
   - `npm run build:frontend` passes.
   - Live API smoke test passed:
     - connected two local characters to an existing room;
     - saved sword, potion, and paper inventory entries;
     - equipped the sword as active weapon;
     - transferred one potion to another campaign character;
     - transfer action was persisted through the backend transfer endpoint and save snapshot flow.
   - Full `npm run build` reaches `prisma generate`, but Windows blocks replacing `node_modules/.prisma/client/query_engine-windows.dll.node` while the existing dev backend is running.

## Implemented

- Backend inventory update endpoint: `PATCH /api/campaigns/:campaignId/characters/:characterId/inventory`.
- Backend item transfer endpoint: `POST /api/campaigns/:campaignId/characters/:characterId/transfer-item`.
- Sanitized inventory JSON with money, item kind, quantity, weight, weapon damage, armor class, proficiency, equipment slot, and notes.
- Save snapshot entries for inventory updates and transfers.
- Room refresh broadcasts after inventory changes.
- Campaign character inventory UI with money, item creation, weight total, equipment slots, active weapon preview, proficiency warning, item quantity edits, context action select, and transfer controls.

## Non-Goals

- Do not import full item mechanics from dnd.su yet.
- Do not create marketplace, loot generation, theft, or merchant flows.
- Do not add strict carry capacity or encumbrance rules yet.
