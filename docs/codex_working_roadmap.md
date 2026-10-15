# Codex Working Roadmap: D&D 5e Companion

This file is a compact handoff note for future Codex chats. It summarizes the current project decisions, file locations, Notion links, and development order. Use it before starting implementation or updating docs.

## Актуализация 2026-10-15 — читать перед историческими этапами

Основное [ТЗ, редакция 2](./dnd5e_2014_interactive_app_spec.md), заменяет прежние продуктовые требования. [Заметка о пересмотре](./spec-revision-2026-10-15.md) объясняет изменения и ограничения прототипа. Оригинал ТЗ сохранён в `docs/archive`.

- Актуальная готовность находится в [current-status.md](./current-status.md). Созданы каркас, основа локального сервера и импорт DnD.su. Игровые модули — неудовлетворительные прототипы по оценке пользователя, а не завершённые этапы. Старые `completed` отозваны как текущая оценка готовности; они не доказывают даже приёмку прежнего объёма.
- Последний порядок по решению пользователя: **A — локальный персонаж; B — локальные игровые функции; C — законченный локальный интерфейс; D — сетевая игра и защита; E — развитие и дополнительные возможности**. Сначала функционал и внешний вид на одном компьютере, затем сеть и права. Это заменяет прежний приоритет LAN/защиты. Перед рубежом нужен короткий план.
- Ближайший этап A: закончить локальный путь создания, сохранения и повторного открытия персонажа с объяснимым листом. Его интерфейс делается вместе с функционалом. Используется существующий локальный backend; публикация, отдельное развёртывание и сетевые сессии не требуются.
- В A–C допустимы локальные тестовые профили и переключение мастера/игрока. Сохранность данных и игровые расчёты проверяются сразу; сетевые роли, защита доступа и конкурентная игра относятся к D.
- Код пока использует передаваемые клиентом ID и общую загрузку данных; это не готовая изоляция ролей. Откат старого JSON-листа/инвентаря не считается безопасной компенсацией последующих действий.
- 4584 импортированные записи — исторический результат импорта, а не 4584 автоматизированных правила. Покрытие хранится отдельно; неизвестная механика остаётся `assisted`/`display_only`.
- В сетевой игре база кампании и прогресс находятся у мастера. Личная библиотека первой веб-версии разделена по владельцам на текущем сервере; отдельные установки не синхронизируются автоматически.
- Историческое автоматическое включение 69/69 DLC в универсальной кампании заменяется для **новых** кампаний проверенным набором и явным выбором всех совместимых источников. Существующие настройки не сбрасываются; включённый источник не делает все его записи проверенными.
- Интерфейс источников остаётся простым; технические статусы не засоряют список. Предупреждения привязаны к рискованному действию и подробностям.
- Конкретные формулы остаются в `character-creation-rules-engine.md`; дата их сверки не обновлялась при редактуре ТЗ.
- Изменены только документы. При пересмотре ТЗ приложение и база не мигрировались, запуск/сборка не проверялись.

## Current Project

- Workspace: `D:\project\dnd web`
- Main spec: `D:\project\dnd web\docs\dnd5e_2014_interactive_app_spec.md`
- Character content/rules extension architecture (primary): `D:\project\dnd web\docs\character-content-extension-model.md`
- D&D 5e 2014 formulas and character-creation rule reference: `D:\project\dnd web\docs\character-creation-rules-engine.md`
- Short visual overview PDF: `D:\project\dnd web\docs\dnd5e_program_overview.pdf`
- Short visual overview HTML source: `D:\project\dnd web\docs\dnd5e_program_overview.html`
- Local PDF archive, ignored by app logic: `D:\project\dnd web\book`
- Future app storage folder: `D:\project\dnd web\storage`
- DnD.su metadata catalog: `D:\project\dnd web\storage\imports\dndsu-5e2014-catalog.json`
- DnD.su catalog summary: `D:\project\dnd web\docs\dndsu-5e2014-parse-catalog.md`
- DnD.su catalog script: `D:\project\dnd web\scripts\import-dndsu-catalog.mjs`

## Private Workspace Links

Personal Notion links are kept in the ignored local file `docs/private-links.local.md`. They are not required to run the application.

## Core Decisions

- The app is local-first and not intended for publication.
- No cloud storage or cloud sync.
- Target: campaign data and campaign progress are authoritative on the GM's local server. Owner isolation is required, but is not yet established as implemented; separate installations require explicit file transfer.
- LAN mode is required for testing: one PC runs the GM room, a second PC connects as a player.
- The full UI must be in Russian.
- English names/content may exist as source metadata, but system UI remains Russian.
- Local PDF books are not used by the app.
- The only active parsing source for rules/content is `dnd.su`.
- `dnd.su` may contain 5e 2014, 5.5/2024, and universal content.
- Each parsed entity needs `editionCompatibility`: `5e_2014`, `5e_2024`, `universal_5e_2014_2024`, `unknown`, or `conflict`.
- Default project scope: use `5e_2014` and `universal_5e_2014_2024`; hide `5e_2024` unless GM explicitly allows it.
- `SourceBook` means source title from `dnd.su`, not a local file.
- Source priority for imported entities is `site`.
- Unknown site source or edition gets `needs_source_review` / `needs_edition_review`.
- Deduplicate by mechanics/source/English name/aliases, not by Russian name alone.
- Master can enable/disable site sources per campaign and override active sources per room.
- Disabled sources do not appear in automatic character options, loot, NPCs, merchants, spells, or search by default.
- GM can explicitly show inactive sources and manually use them.
- Settings can be selected at campaign/room creation.
- A room inherits the campaign setting unless the GM overrides it.

## Special Source Rule

SourceBook: `The Book of Many Things`

Rules:

- Default disabled for new campaigns and rooms while edition/source status is uncertain.
- On enabling, show a warning that this source may need master review before use in a 5e 2014 campaign.
- This rule is about site source/edition confidence, not about local PDF quality.

## Local PDF Archive

The `book` folder may contain PDFs, but the app must ignore them. Do not parse, rename, list, compare, or seed SourceBook records from local PDF files.

## Architecture Direction

Recommended initial stack:

- Frontend: React + TypeScript + Vite.
- Backend: Fastify + TypeScript.
- DB: SQLite through Prisma for MVP.
- Realtime: native WebSocket via `@fastify/websocket` (already used; do not introduce another transport without need).
- Tests: Vitest and Playwright are planned, not installed/configured in the current package scripts.
- Files: local `storage` folder.
- 3D later: Three.js / React Three Fiber.

Initial local addresses:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health endpoint: `http://localhost:3000/health`

LAN test:

- Master PC exposes local URL like `http://192.168.1.10:5173`.
- Second PC opens that URL and joins as player.

## Main Data Concepts

Important entities from the spec:

- User
- Campaign
- GameRoom
- Party
- Setting
- SourceBook
- CampaignSourceBook
- RoomSourceBookOverride
- SourceBookLanguagePreference
- SourceBookQualityFlag
- CampaignMember
- Character
- CharacterLibrary
- CharacterSheetState
- Race, Class, Subclass, Background
- Spell, SpellSlotState, KnownSpell, PreparedSpell
- Feature
- Item, InventoryItem, EquipmentSlot
- Effect
- DiceRoll
- ActionLog
- TurnEncounter, TurnOrderEntry, TurnResourceState
- RestEvent
- HomebrewContent
- Merchant, MerchantInventory, TradeSession, TheftRequest
- NoteDocument, DrawingLayer
- Asset3D
- Folder/List
- SaveSnapshot

## Development Roadmap

The user asked that each stage gets a smaller detailed roadmap before starting. Do not jump straight into a large implementation without clarifying the immediate stage if it is ambiguous.

### Stage 1: App Skeleton

Goal: running frontend, backend, DB, and health check.

Build:

- Vite React TypeScript frontend.
- Fastify TypeScript backend.
- Prisma + SQLite.
- `/health`.
- Basic Russian layout.
- `storage` folder.
- npm scripts.

Check:

- `localhost:5173` opens.
- `localhost:3000/health` responds.
- Prisma creates a local DB.
- No English UI labels except technical identifiers.

### Stage 2: Campaigns, Rooms, Local Data

Goal: local-first master/player foundations.

Build:

- User, Campaign, Party, GameRoom, Character.
- Character library.
- GM creates/loads campaign.
- GM creates room.
- Player cannot create room.
- Autosave.

Check:

- Create a campaign.
- Restart app.
- Campaign remains.
- User has local characters.
- GM can create room.

### Stage 3: LAN Test

Goal: one PC as GM, second PC as player.

Build:

- Bind frontend/backend to LAN.
- Show GM local IP/URL.
- Join room by invite.
- Player chooses character.
- Realtime updates.

Check:

- Second PC opens LAN URL.
- Player joins room.
- HP update syncs both ways.

### Stage 3.5: DnD.su 5e14 Metadata Catalog

Goal: prepare site source names and rules references before the basic character sheet.

Build:

- Parse `dnd.su` metadata for 5e 2014 categories without storing full rule text.
- Save machine-readable catalog to `storage/imports/dndsu-5e2014-catalog.json`.
- Save human-readable summary to `docs/dndsu-5e2014-parse-catalog.md`.
- Track source titles from the site.
- Keep full mechanics/text import for a later dedicated import stage.
- Ignore local PDFs entirely.

Check:

- `node scripts/import-dndsu-catalog.mjs` completes.
- Current site counts are available: classes 16, races/origins 48, backgrounds 91, feats 106, spells 522, magic items 934, monsters 2874.
- `The Book of Many Things` and unknown-edition sources remain disabled by default until the GM allows them.
- Future implementation uses this catalog for option/source names and does not verify against PDFs.

### Stage 4: Basic Character Sheet

Build:

- Name, portrait, level.
- Class/race/background names can be selected from the DnD.su metadata catalog when available, with manual fallback.
- Do not auto-apply full class, race, spell, feat, or item mechanics yet.
- Ability scores and modifiers.
- HP, AC, speed, initiative.
- Skills and passive perception.
- Passive features block.
- Source hint for selected class/race/background if it exists in `dndsu-5e2014-catalog.json`.
- Autosave.

Check:

- Create level 1 character.
- Edit stats.
- Verify modifiers.
- Reload and confirm persistence.

### Stage 5: Site Sources and Active DLC

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-04, re-audited on 2026-05-06.

Historical prototype behavior below. For new campaign defaults and entity-level review, use section 9 of spec revision 2; do not reimplement the 69/69 default as a current requirement.

Build:

- SourceBook.
- Setting.
- CampaignSourceBook.
- RoomSourceBookOverride.
- List all 69 source titles from `dndsu-5e2014-catalog.json`.
- Select campaign setting.
- Select room setting.
- Enable/disable site sources for campaigns and rooms.
- Show inactive source options only when explicitly requested.
- Auto-enable universal DLC and setting-matched DLC at campaign creation.
- Keep visible source copy focused on `dnd.su`; do not show local PDF or review-needed labels in the source list.

Check:

- Universal campaign enables 69/69 dnd.su sources.
- Forgotten Realms campaign enables core/universal plus matching Forgotten Realms sources, with `The Book of Many Things` off by default.
- Disable one room source and ensure it is not offered automatically.
- `showInactive=true` shows inactive options with inactive state.
- Confirm that local PDFs do not appear as sources.

Current Stage 5 file: `D:\project\dnd web\docs\stage-5-site-sources-plan.md`

### Stage 6: Inventory and Equipment

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-06.

Build:

- Money.
- Items.
- Weight.
- Quantity.
- Weapons and armor.
- Equipment slots.
- Active weapon.
- Damage preview.
- Proficiency warning.
- Context menu.
- Transfer item.

Check:

- Give sword/armor/potion/paper.
- Equip weapon.
- Confirm damage preview.
- Transfer item.
- Action is logged.

Current Stage 6 file: `D:\project\dnd web\docs\stage-6-inventory-equipment-plan.md`

### Stage 7: Spells, Slots, Resources

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-06.

Build:

- Test spell reference.
- Cantrips.
- Spell slots.
- Spell card.
- Components, range, duration.
- Damage/healing.
- Slot spending.
- Class resources.

Check:

- Cantrip does not spend slot.
- 1st-level spell spends slot.
- Action is logged.

Current Stage 7 file: `D:\project\dnd web\docs\stage-7-spells-slots-resources-plan.md`

### Stage 8: Action History and Undo

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-06.

Build:

- ActionLog.
- Log item use, spell use, HP changes, item transfer.
- GM undo for spell use and item transfer.
- Mark reverted actions.

Check:

- Use spell.
- See history.
- Undo as GM.
- Slot returns.

Current Stage 8 file: `D:\project\dnd web\docs\stage-8-action-history-undo-plan.md`

### Stage 9: Turn-Based Mode

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-09.

Build:

- TurnEncounter.
- Participants.
- Initiative.
- Rounds.
- Current turn.
- Action, bonus action, reaction, movement.
- Over-limit warning.
- GM override.
- Effects by rounds/turns.
- Passive feature highlighting.

Check:

- Scene with 2 players and 1 NPC.
- Initiative order advances.
- Second action warns.
- GM can override.

Current Stage 9 file: `D:\project\dnd web\docs\stage-9-turn-based-mode-plan.md`

### Stage 10: Short and Long Rest

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-10.

Build:

- Short rest.
- Long rest.
- Hit dice.
- HP recovery.
- Slot recovery.
- Class resource recovery.
- Effects ending on rest.
- GM confirmation for exceptions.

Check:

- Spend HP, slot, class resource.
- Short rest restores only correct resources.
- Long rest restores according to rules.
- Invalid rest asks GM.

Current Stage 10 file: `D:\project\dnd web\docs\stage-10-short-long-rest-plan.md`

### Stage 11: Merchants and Theft

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-10.

Build:

- GM creates merchant.
- Merchant inventory.
- Merchant money hidden from players.
- Trade scene.
- Active buyer.
- Buy/sell with confirmation.
- Theft request.
- GM resolves theft.

Check:

- Buy item.
- Sell item.
- Request theft.
- GM approves one and rejects another.

Current Stage 11 file: `D:\project\dnd web\docs\stage-11-merchants-theft-plan.md`

### Stage 12: Homebrew and Campaign Library

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-10.

Navigation/data update completed on 2026-07-19: the homebrew library is independent from campaigns, supports many-to-many campaign links, and supports bulk linking/unlinking of selected materials and campaigns.

Build:

- Campaign library.
- Homebrew item, weapon, spell, effect.
- Later: race/class.
- Grant temporary/permanent.
- Revoke.
- Extend/end effect.

Check:

- Create weapon `2d4 + 3` radiant damage.
- Grant to player.
- Damage appears.
- Create 10-round effect.
- Duration ticks in turn mode.

Current Stage 12 file: `D:\project\dnd web\docs\stage-12-homebrew-campaign-library-plan.md`

### Stage 13: GM NPCs and Generators

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-10.

Build:

- GM NPC list.
- Switch active NPC.
- NPC from database.
- Manual NPC.
- Homebrew NPC.
- Random NPC.
- Wealth/social classes.
- NPC loot.
- Theft from NPC.

Check:

- Create random NPC.
- Verify money/items.
- Theft flow works.

Current Stage 13 file: `D:\project\dnd web\docs\stage-13-gm-npcs-generators-plan.md`

### Stage 14: Documents, Notes, Drawing

Status: prototype, not completed or accepted. Previous completion claim withdrawn; historical implementation date: 2026-05-10.

Build:

- Paper item.
- Note item.
- Text editor.
- Mouse drawing.
- Transfer document.
- Show to GM.
- Ink consumption.
- Document history.

Check:

- Write and draw.
- Transfer to another player.
- Content persists.
- Ink decreases.

Current Stage 14 file: `D:\project\dnd web\docs\stage-14-documents-notes-drawing-plan.md`

### Stage 15: Full Site Content Import

Started on 2026-06-01 after the UI checkpoint.

Current Stage 15 status:

- `ImportedContent` table exists for stable imported site entities.
- First category imported: 522 spells from `storage/imports/dndsu-5e2014-catalog.json`.
- Import commands:
  - `npm run import:dndsu:content -- spells`;
  - `npm run import:dndsu:content -- spells --details`.
- Spell detail pages are cached in `storage/imports/cache/dndsu-pages`.
- All 522 spell detail pages were imported on 2026-06-01 with `detailsImported: 522` and `detailErrors: 0`.
- Detailed spell records now include reliable parsed fields from detail pages: casting time, range, duration, components, material component text, classes, subclasses, and detail text presence flags.
- Second category imported: 934 magic items from `storage/imports/dndsu-5e2014-catalog.json`.
- Magic item detail pages were imported on 2026-06-01 with `detailsImported: 934` and `detailErrors: 0`.
- Detailed magic item records include type/rarity line, price text, parsed gp price range where present, attunement flag, and detail text presence flags.
- Remaining catalog categories are represented as stable source records:
  - 16 classes;
  - 48 races/origins;
  - 91 backgrounds;
  - 106 feats;
  - 2867 monster/NPC rows from 2874 catalog entries.
- Monster/NPC source records keep catalog mechanics hints: NPC flag, classic variant flag, challenge value when present, size IDs, type IDs, and alignment IDs.
- The monster catalog contains 7 duplicate canonical IDs; the importer updates existing rows instead of creating duplicates.
- Current imported total: 4584 rows.
- New API:
  - `GET /api/rules/imported-content/stats`;
  - `GET /api/rules/imported-content?category=spells`;
  - `GET /api/rules/imported-content?category=magicItems`;
  - `GET /api/rules/imported-content?category=monsters`;
  - also supports `classes`, `races`, `backgrounds`, and `feats`.
- Re-running imports is idempotent: existing canonical IDs are updated instead of duplicated.
- Review reports:
  - `D:\project\dnd web\storage\imports\dndsu-stage15-review-report.json`;
  - `D:\project\dnd web\docs\stage-15-import-review-report.md`.
- Report summary: 109 rows without matched `SourceBook`, 210 rows with unknown edition, 31 English-name duplicate candidate groups, and 1 mechanics duplicate candidate group.
- Stage 15 has imported catalog/detail data, but is not complete as an integrated game feature. Deep parsers, mechanic validation and integration remain unfinished.

UI note:

- The early BG3-inspired interface pass is intentionally not final.
- Updated priority, 2026-10-15: build the local interface together with each functional flow; complete the main visual pass before LAN/security work. The old pause on UI work is superseded.
- Item/NPC art may be added as local screens mature. Optional 3D and desktop-only presentation remain separate extensions.
- Import only the content needed for the next complete local game flow; importing more rows is not the primary milestone.

Build:

- Full parser for `dnd.su`.
- SourceBook import format.
- Types: rules, setting, adventure, mixed.
- Metadata and mechanics import from site pages.
- Test one category.
- Active source filter.
- Source and edition warnings.
- Alias mapping for different names with same mechanics.
- Edition compatibility detection: 5e 2014 vs 5.5/2024 vs universal.
- Conflict review statuses: unchecked, needs_source_review, needs_edition_review, confirmed.
- No local PDF parsing or site-vs-book comparison.

Check:

- Parse one category from `dnd.su`.
- Add one SourceBook.
- Enable in campaign.
- Disable in room.
- Filter works.
- Verify 5e 2014 content is included.
- Verify universal 5e/5.5 content is included.
- Verify 5.5-only content is hidden by default.
- Confirm same entity when names differ but mechanics match.
- Mark conflict when names are similar but mechanics differ.

Current Stage 15 file: `D:\project\dnd web\docs\stage-15-full-site-content-import-plan.md`

### Stage 16: Polish and Future Extensions

Later:

- 3D item viewer.
- `.glb` / `.gltf`.
- Compact overlay.
- Dockable GM interface.
- Manual export/import character.
- Manual export/import campaign.
- Visual polish.
- Expanded tests.
- Late-stage validation: forbid creating empty or unchanged/default records in production-like play mode, while keeping quick default creation convenient during testing.
- Updated validation rule (2026-10-15, supersedes the previous bullet): drafts may be incomplete; finalization checks meaningful required fields and game constraints. Valid default values are allowed. Quick test creation belongs to explicit development mode.

## Important UX Rules

- Do not make a marketing landing page.
- The first screen should be useful app UI.
- UI language: Russian.
- Master has final authority.
- Rules engine helps, warns, calculates, and logs; it does not replace GM decisions.
- Disabled sources do not appear automatically.
- The user wants BG3-like interaction feel, not BG3 rules.
- Frontend should be practical and dense enough for actual play.
- The app should now be shaped like a game/application shell, not an admin dashboard.
- The first screen is the main menu.
- Main menu items:
  - `Подключение к кампании`;
  - `Создать персонажа`;
  - `Просмотр персонажей`;
  - `Создать кампанию`;
  - `Просмотр кампаний`;
  - `Хоумбрю`;
  - `Настройки`.
- Each main section opens as its own full-screen view and returns through a single `Назад` action.
- Do not restore the persistent sidebar/mobile menu; navigation belongs on the main-menu screen.
- The current "server" is the user's local PC. Future stages should still treat it as the authoritative server for campaigns and campaign progress.
- A base character belongs to the player's library, but campaign progress belongs to the campaign on the server.
- A character can have separate campaign states in multiple campaigns. Example: level 1 in the menu, level 2 in campaign `Волшебные узы`, and a different state in campaign `Зеленая ведьма`.
- Campaigns and characters have stable IDs. Matching campaign progress must use IDs, not only names.

## Interface Roadmap Update

### Current UI Direction

Build the interface as if it will later become a standalone game-like app:

- persistent main menu;
- large usable play surface;
- separate player and master flows;
- no marketing/landing screen;
- dense but readable D&D companion controls;
- all visible UI in Russian.

### Stage 2 UI Additions

Completed/current scope:

- Main menu shell.
- Connect to campaign by room/campaign code.
- Base character creation.
- Character browser with library state and campaign-specific states.
- Campaign creation that immediately opens a room.
- Campaign browser for the master with code, players, characters, sources.
- Basic settings screen.
- Server-side campaign character state model.

### Stage 3 UI Additions

When LAN/realtime begins:

- Show LAN address and campaign code more prominently for the master.
- Show connected/disconnected player state.
- Sync room participants and HP without page refresh.
- Make "Подключиться к кампании" work naturally from a second device.

Current Stage 3 file: `D:\project\dnd web\docs\stage-3-lan-realtime-plan.md`

Implemented Stage 3 foundation:

- `@fastify/websocket` powers room realtime.
- WebSocket endpoint: `ws://<host>:3000/ws/rooms/:roomId?userId=:userId`.
- Frontend helper: `src/realtime.ts`.
- Connected room clients refresh automatically on `room:joined`, `room:participant-status`, `character:hp-updated`, and `room:refreshed`.
- Room participant statuses are visible in the campaign view.
- Player can explicitly leave the current room/campaign; this broadcasts `room:left` and stores participant status `left`.

### Stage 4 UI Additions

Implemented current scope:

- Backend exposes `GET /api/rules/character-options` and includes `characterOptions` in `/api/bootstrap`.
- Character options come from `storage/imports/dndsu-5e2014-catalog.json`: classes 16, races/origins 48, backgrounds 91.
- Character creation uses dnd.su option autocomplete with manual fallback.
- Character library view now has an editable basic sheet.
- Sheet stores level, portrait URL, class, race/origin, background, HP, AC, speed, six ability scores, skill proficiencies, passive perception, initiative, proficiency bonus, and passive features.
- Extended sheet fields are saved in `CharacterSheetState.sheetJson`, so no new Prisma migration was needed.
- Campaign character state copies library sheet JSON when a character joins a campaign.

### LAN/Realtime Preparation Already Added

Before starting the LAN/realtime implementation, Stage 2 received a small contract layer:

- `GET /api/network/info` returns local/LAN frontend and backend URLs.
- `PATCH /api/campaigns/:campaignId/characters/:characterId/hp` updates campaign-specific HP state.
- `PATCH /api/rooms/:roomId/participants/:participantId/status` stores room participant connection status.
- Room participant status values are: `joined`, `online`, `offline`, `left`, `reconnecting`.
- Planned realtime events are: `room:joined`, `room:left`, `room:participant-status`, `character:hp-updated`, `campaign:snapshot-created`, `room:refreshed`.
- Frontend API helpers live in `src/api.ts`.
- The campaign view shows the invite code and primary LAN URL for the master.

## Review Before Starting a New Chat

Before coding in a new chat:

1. Open `docs/dnd5e_2014_interactive_app_spec.md`.
2. Open `docs/character-content-extension-model.md` if work touches character creation, races, classes, backgrounds, rules packages, choices, effects, or derived statistics.
3. Open `docs/character-creation-rules-engine.md` if work touches concrete D&D formulas, equipment, attacks, spells, or validation examples.
4. Open this file.
5. Open `docs/dndsu-5e2014-parse-catalog.md` if work touches rules, site sources, classes, races, spells, items, monsters, or character options.
6. Check current project files.
7. Ask or infer which stage is next.
8. If starting a stage, create/update a small stage-specific plan first.
9. Implement, run checks, and summarize results.
