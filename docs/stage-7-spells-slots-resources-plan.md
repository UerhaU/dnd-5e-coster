# Stage 7 Plan: Spells, Slots, Resources

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Date: 2026-05-06

## Baseline Check

- Stage 6 is marked complete in `docs/codex_working_roadmap.md`.
- `npm run typecheck` passes before starting.
- Prisma already has `CampaignCharacterState.sheetJson`, so Stage 7 can start without a schema migration.

## Completion Status

Stage 7 is implemented and smoke-tested on 2026-05-06.

## Stage Goal

Give each campaign character a usable spellcasting panel: test spell references, cantrips, spell slots, spell cards, components, range, duration, damage/healing preview, slot spending, class resources, and action logging.

## Implementation Scope

1. Backend spellcasting contract
   - Store sanitized spellcasting data inside `CampaignCharacterState.sheetJson`.
   - Add endpoint to update spellcasting state.
   - Add endpoint to cast a spell.
   - Spend a slot only for leveled spells.
   - Create save snapshots for spellcasting edits and spell use.
   - Broadcast room refresh events after spell changes.

2. Frontend spellcasting UI
   - Show spellcasting only for a selected campaign character state.
   - Include a small test spell reference list.
   - Add cantrips and leveled spells to the character.
   - Show slots by level, class resources, and spell cards.
   - Cast cantrips without slots.
   - Cast 1st-level spells by spending a slot.

3. Verification
   - `npm run typecheck` passes.
   - `npx tsc -p backend/tsconfig.json` passes.
   - `npm run build:frontend` passes.
   - Live API smoke test passed:
     - saved a test cantrip and 1st-level spell;
     - cantrip cast spent 0 slots;
     - 1st-level spell cast spent one 1st-level slot;
     - spell use was persisted through the backend cast endpoint and save snapshot flow.

## Implemented

- Backend spellcasting update endpoint: `PATCH /api/campaigns/:campaignId/characters/:characterId/spellcasting`.
- Backend spell cast endpoint: `POST /api/campaigns/:campaignId/characters/:characterId/cast-spell`.
- Sanitized spellcasting JSON with ability, DC, attack bonus, slots, class resource, and spell cards.
- Slot spending for leveled spells; cantrips do not spend slots.
- Save snapshot entries for spellcasting edits and spell use.
- Room refresh broadcasts after spell changes.
- Campaign character spellcasting UI with test references, slots, class resource, spell cards, components, range, duration, damage/healing, and cast buttons.

## Non-Goals

- Do not import full spell mechanics from dnd.su yet.
- Do not implement concentration automation, saving throw DC math, or spell attack rolls yet.
- Do not implement undo; that belongs to Stage 8.
