# Stage 11: Merchants and Theft

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Status: completed on 2026-05-10.

## Scope

- GM creates campaign merchants.
- Merchant inventory and hidden merchant money are stored on the campaign server.
- GM chooses the active buyer.
- GM-confirmed buy and sell actions.
- Player-facing theft request flow represented as pending requests.
- GM resolves theft by approving or rejecting.
- Approved theft transfers one item from merchant to the character.
- Trade and theft resolution are written to campaign action history.

## Backend

- Added Prisma models:
  - `Merchant`
  - `TheftRequest`
- Added endpoints:
  - `GET /api/campaigns/:campaignId/merchants`
  - `POST /api/campaigns/:campaignId/merchants`
  - `PATCH /api/merchants/:merchantId`
  - `POST /api/merchants/:merchantId/items`
  - `POST /api/merchants/:merchantId/buy`
  - `POST /api/merchants/:merchantId/sell`
  - `POST /api/merchants/:merchantId/theft-requests`
  - `POST /api/merchants/:merchantId/theft-requests/:requestId/resolve`

## Frontend

- Added a campaign merchant panel.
- GM can create merchants and add placeholder catalog items as stock.
- GM selects active buyer from campaign characters.
- Merchant stock supports buy and theft request actions.
- Active buyer inventory supports sell actions.
- Pending theft requests show approve/reject controls for GM.

## Verification

- Create merchant.
- Add item to merchant inventory.
- Buy item with active buyer.
- Sell item back to merchant.
- Create theft request.
- GM approves one theft request and rejects another.
