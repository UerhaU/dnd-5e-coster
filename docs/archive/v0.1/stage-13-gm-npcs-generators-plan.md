# Stage 13: GM NPCs and Generators

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Status: completed on 2026-05-10.

## Scope

- Campaign NPC list for the GM.
- Manual NPC creation.
- Random NPC creation from small placeholder pools.
- Active NPC switch.
- NPC social class and wealth tier.
- NPC stats and inventory storage.
- NPC loot generator.
- Theft requests from NPC inventory.
- GM approve/reject flow for NPC theft.

## Backend

- Added Prisma models:
  - `NpcProfile`
  - `NpcTheftRequest`
- Added endpoints:
  - `GET /api/campaigns/:campaignId/npcs`
  - `POST /api/campaigns/:campaignId/npcs`
  - `PATCH /api/npcs/:npcId`
  - `POST /api/npcs/:npcId/generate-loot`
  - `POST /api/npcs/:npcId/theft-requests`
  - `POST /api/npcs/:npcId/theft-requests/:requestId/resolve`

## Frontend

- Added an NPC master panel in campaign view.
- GM can create manual or random NPCs.
- GM can switch active NPC.
- NPC summary shows AC, HP, speed, and hidden money.
- NPC loot supports theft requests and GM resolution.

## Verification

- Create random NPC.
- Verify generated wealth, stats, and loot.
- Generate extra loot.
- Request theft from NPC.
- GM approves one theft and rejects another.
