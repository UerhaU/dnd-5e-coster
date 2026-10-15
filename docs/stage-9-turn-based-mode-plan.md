# Stage 9: Turn-Based Mode Plan

> Актуализация 2026-10-15: это историческая запись о прототипе, не завершённый и не принятый игровой этап. Старые заявления `completed`/`implemented` ниже не подтверждают готовность. Текущая оценка: [сводка готовности](./current-status.md).

Status: completed on 2026-05-09.

## Goal

Add a real MVP turn-based mode for a campaign room: initiative order, rounds, current turn, action economy, master override, round-based effects, and passive feature visibility.

## Backend

- Add persistent `TurnEncounter`, `TurnParticipant`, and `TurnEffect` models.
- Include active encounters in campaign bootstrap data.
- Add endpoints to:
  - create an encounter from campaign characters;
  - add an NPC;
  - update initiative;
  - advance to the next turn;
  - mark action, bonus action, reaction, and movement usage;
  - allow master override for over-limit actions;
  - add and expire turn effects;
  - close the encounter.
- Log turn events through the existing action history.
- Broadcast `turn:updated` to room clients.

## Frontend

- Add a campaign turn-mode panel in the master campaign view.
- Show initiative order, round, current turn, and participants.
- Let the master start/end an encounter, add a test NPC, edit initiative, advance turns, and trigger override.
- Show action economy state: action, bonus action, reaction, and movement.
- Show warnings when a second action exceeds the normal limit.
- Show active effects and passive feature hints.

## Checks

- Create a scene with available campaign characters and a test NPC.
- Edit initiative order.
- Advance turns and rounds.
- Use a second action and see an over-limit warning.
- Confirm master override logs the action.
- Add an effect and see it tick down when turns advance.
