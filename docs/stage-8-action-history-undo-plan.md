# Stage 8 Plan: Action History and Undo

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Date: 2026-05-06

## Baseline Check

- Stage 7 is marked complete in `docs/codex_working_roadmap.md`.
- `npm run typecheck` passes before starting.
- Existing `SaveSnapshot` rows already store summary, user, campaign, timestamp, and JSON payload, so Stage 8 can use them as the first `ActionLog` contract without a Prisma migration.

## Completion Status

Stage 8 is implemented and smoke-tested on 2026-05-06.

## Stage Goal

Show a campaign action history and let the GM undo spell use and item transfer while marking reverted actions.

## Implementation Scope

1. ActionLog contract
   - Use `SaveSnapshot` as the persisted action log for this stage.
   - Add structured `payloadJson.actionType` for HP changes, inventory updates, spell casts, item transfers, and undo entries.
   - Add `GET /api/action-log`.

2. Undo
   - For spell casts, store the character state's `sheetJson` before casting.
   - For item transfers, store both source and target `inventoryJson` before transfer.
   - Add `POST /api/action-log/:id/undo`.
   - Restrict undo to campaign GM.
   - Mark the original action as `reverted`.
   - Create an additional undo log entry.

3. Frontend
   - Show campaign history in the campaign detail screen.
   - Display action type, actor, date, and reverted status.
   - Show Undo button for reversible, non-reverted actions.

## Verification

- `npm run typecheck` passes.
- `npx tsc -p backend/tsconfig.json` passes.
- `npm run build:frontend` passes.
- Live API smoke test passed:
  - cast 1st-level spell;
  - saw action in history;
  - undid as GM;
  - slot returned from 1 to 2;
  - original spell action was marked `reverted`.
- Live API transfer undo smoke test passed:
  - transferred one item;
  - undid as GM;
  - item quantity returned from 1 to 2;
  - original transfer action was marked `reverted`.

## Non-Goals

- Do not build full timeline filtering, search, or diff views yet.
- Do not undo HP changes yet.
- Do not implement encounter turn history; that belongs to Stage 9.
