# Stage 14: Documents, Notes, Drawing

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Status: completed on 2026-05-10.

## Scope

- Campaign documents.
- Owner character for each document.
- Text editor.
- Mouse/pointer drawing pad.
- Transfer document to another character.
- Show document to GM flag.
- Ink usage counter based on drawing strokes.
- Compact document history.

## Backend

- Added Prisma model `NoteDocument`.
- Added endpoints:
  - `GET /api/campaigns/:campaignId/documents`
  - `POST /api/campaigns/:campaignId/documents`
  - `PATCH /api/documents/:documentId`
  - `POST /api/documents/:documentId/transfer`

## Frontend

- Added a campaign document panel.
- Users can create a document for a selected character.
- Users can edit text and draw strokes in an SVG pad.
- Documents can be saved, shown to GM, and transferred.
- Last history entries are displayed in the panel.

## Verification

- Create a document.
- Save text and drawing.
- Show to GM.
- Transfer to another character.
- Verify content and history persist.
