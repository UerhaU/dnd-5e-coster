# Stage 12: Homebrew and Campaign Library

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Status: completed on 2026-05-10.

Update 2026-07-19:

- Homebrew is now stored in a global master library and can be created before any campaign exists.
- Existing campaign-scoped materials are migrated into the master library without losing their previous campaign link.
- A material can be linked to multiple campaigns through `CampaignHomebrewContent`.
- The UI supports selecting multiple materials and multiple campaigns, including all campaigns, then linking or unlinking every selected pair in one action.
- Campaign deletion removes only its links; the master library materials remain available.
- Added global homebrew kinds for race/origin and campaign rule records.

## Scope

- Campaign-level homebrew library.
- Homebrew kinds:
  - item
  - weapon
  - spell
  - effect
- GM creates and edits lightweight payloads.
- GM grants homebrew to a campaign character.
- Permanent and temporary grant modes are tracked in item/effect notes.
- GM can revoke homebrew from a character.
- Effects can be added to active turn mode for round tracking.
- Homebrew effects can be extended or ended.

## Backend

- Added Prisma model `HomebrewContent`.
- Added endpoints:
  - `GET /api/campaigns/:campaignId/homebrew`
  - `POST /api/campaigns/:campaignId/homebrew`
  - `PATCH /api/homebrew/:homebrewId`
  - `POST /api/homebrew/:homebrewId/grant`
  - `POST /api/homebrew/:homebrewId/revoke`
  - `POST /api/homebrew/:homebrewId/effect-duration`

## Frontend

- Replaced the placeholder homebrew screen with a working campaign library.
- GM selects campaign and target character.
- GM creates weapon/item/spell/effect payloads.
- Library rows support grant, temporary grant, revoke, and effect duration controls.

## Verification

- Create weapon `2к4+3` radiant-style damage.
- Grant it to a character and verify it appears in campaign inventory.
- Create a 10-round effect.
- Grant the effect during active turn mode and verify a `TurnEffect` appears.
- Extend and end the active effect.
