# Stage 10: Short and Long Rest

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Status: completed on 2026-05-10.

## Scope

- Campaign-level short rest and long rest.
- Hit dice tracking in campaign character `sheetJson.rest`.
- HP recovery during short rest from spent hit dice.
- Long rest HP recovery to maximum.
- Long rest spell slot recovery to maximum.
- Generic class resource recovery on any rest until class-specific import rules exist.
- Active turn effects end on a confirmed rest.
- If a turn encounter is active, the backend rejects rest until the GM explicitly confirms.
- Rest actions are written to the campaign action history.

## Backend

- Added `POST /api/campaigns/:campaignId/rest`.
- Master-only action.
- Request body:
  - `masterUserId`
  - `type`: `short` or `long`
  - `hitDice`: per-character hit dice spend list
  - `allowUnsafeRest`: required when a turn encounter is still active
- Rest state is stored per campaign character:
  - `hitDiceMax`
  - `hitDiceCurrent`
  - `hitDieSize`
  - `lastRestType`
  - `lastRestAt`

## Frontend

- Added a master rest panel in campaign view.
- GM chooses short or long rest.
- Short rest allows setting hit dice spent per character.
- Long rest previews full HP recovery and hit dice restoration.
- The panel shows HP, hit dice, slots, and class resource state for each character.

## Verification

- Spend HP, spell slot, and class resource.
- Short rest restores HP from selected hit dice and restores class resource while leaving spell slots unchanged.
- Long rest restores HP, spell slots, class resource, and half spent hit dice.
- Rest during active turn mode asks for explicit GM confirmation.
