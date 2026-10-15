import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import type { WebSocket } from 'ws';
import { prisma } from './db/prisma.js';

const appVersion = '0.1.0-alpha.1';
const databaseProvider = 'sqlite';
const dndsuCatalogPath = join(process.cwd(), 'storage', 'imports', 'dndsu-5e2014-catalog.json');

type LocalRole = 'master' | 'player';

type CreateCampaignBody = {
  name?: string;
  description?: string;
  masterUserId?: string;
  settingId?: string | null;
  includeSettingDlc?: boolean;
  includeHomebrewDlc?: boolean;
};

type UpdateCampaignBody = Partial<CreateCampaignBody> & {
  status?: string;
};

type CreateRoomBody = {
  name?: string;
  masterUserId?: string;
  partyId?: string | null;
  settingId?: string | null;
};

type UpdateRoomBody = Partial<CreateRoomBody> & {
  status?: string;
};

type CreateCharacterBody = {
  ownerUserId?: string;
  name?: string;
  level?: number;
  ancestry?: string | null;
  className?: string | null;
  portraitUrl?: string | null;
  maxHp?: number;
  currentHp?: number;
  armorClass?: number;
  speed?: number;
  sheetJson?: unknown;
};

type UpdateCharacterBody = Partial<CreateCharacterBody>;

type ToggleCampaignSourceBookBody = {
  masterUserId?: string;
  isEnabled?: boolean;
  language?: string | null;
};

type ToggleRoomSourceBookBody = {
  masterUserId?: string;
  isEnabled?: boolean | null;
  language?: string | null;
  reason?: string | null;
  inherit?: boolean;
};

type JoinRoomBody = {
  userId?: string;
  characterId?: string;
  inviteCode?: string;
};

type JoinByCodeBody = JoinRoomBody;

type DeleteConfirmBody = {
  userId?: string;
  masterUserId?: string;
  confirmText?: string;
};

type PartyCharacterBody = {
  masterUserId?: string;
  characterId?: string;
};

type UpdateCampaignCharacterHpBody = {
  userId?: string;
  masterUserId?: string;
  currentHp?: number;
  maxHp?: number;
};

type InventoryItemInput = {
  id?: unknown;
  name?: unknown;
  kind?: unknown;
  quantity?: unknown;
  weight?: unknown;
  gpValue?: unknown;
  damageDice?: unknown;
  damageType?: unknown;
  armorClass?: unknown;
  proficient?: unknown;
  equippedSlot?: unknown;
  notes?: unknown;
};

type InventoryInput = {
  cp?: unknown;
  sp?: unknown;
  ep?: unknown;
  gp?: unknown;
  pp?: unknown;
  items?: unknown;
};

type UpdateCampaignCharacterInventoryBody = {
  userId?: string;
  masterUserId?: string;
  inventory?: InventoryInput;
};

type TransferCampaignItemBody = {
  userId?: string;
  masterUserId?: string;
  targetCharacterId?: string;
  itemId?: string;
  quantity?: number;
};

type SpellInput = {
  id?: unknown;
  name?: unknown;
  level?: unknown;
  school?: unknown;
  castingTime?: unknown;
  range?: unknown;
  duration?: unknown;
  components?: unknown;
  damage?: unknown;
  healing?: unknown;
  prepared?: unknown;
  notes?: unknown;
};

type SpellcastingInput = {
  spellcastingAbility?: unknown;
  spellSaveDc?: unknown;
  spellAttackBonus?: unknown;
  slots?: unknown;
  resources?: unknown;
  spells?: unknown;
};

type UpdateCampaignCharacterSpellcastingBody = {
  userId?: string;
  masterUserId?: string;
  spellcasting?: SpellcastingInput;
};

type CastCampaignSpellBody = {
  userId?: string;
  masterUserId?: string;
  spellId?: string;
  slotLevel?: number;
};

type RestType = 'short' | 'long';

type RestHitDiceUseInput = {
  characterId?: unknown;
  hitDice?: unknown;
  heal?: unknown;
};

type CampaignRestBody = {
  masterUserId?: string;
  type?: string;
  hitDice?: unknown;
  allowUnsafeRest?: boolean;
  notes?: string;
};

type CreateMerchantBody = {
  masterUserId?: string;
  name?: string;
  description?: string;
  inventory?: InventoryInput;
  priceMultiplier?: number;
};

type UpdateMerchantBody = Partial<CreateMerchantBody> & {
  status?: string;
  activeBuyerStateId?: string | null;
};

type MerchantItemBody = {
  masterUserId?: string;
  item?: InventoryItemInput;
};

type MerchantTradeBody = {
  masterUserId?: string;
  characterStateId?: string;
  itemId?: string;
  quantity?: number;
};

type TheftRequestBody = {
  userId?: string;
  masterUserId?: string;
  characterStateId?: string;
  itemId?: string;
  dc?: number;
  notes?: string;
};

type ResolveTheftRequestBody = {
  masterUserId?: string;
  approved?: boolean;
  roll?: number;
  notes?: string;
};

type HomebrewKind = 'item' | 'weapon' | 'spell' | 'effect' | 'race' | 'rule';

type CreateHomebrewBody = {
  masterUserId?: string;
  name?: string;
  kind?: string;
  payload?: unknown;
  notes?: string;
  status?: string;
};

type GrantHomebrewBody = {
  masterUserId?: string;
  characterStateId?: string;
  mode?: string;
  durationRounds?: number;
};

type HomebrewEffectDurationBody = {
  masterUserId?: string;
  campaignId?: string;
  characterStateId?: string;
  rounds?: number;
  end?: boolean;
};

type BulkHomebrewCampaignBody = {
  masterUserId?: string;
  homebrewIds?: unknown;
  campaignIds?: unknown;
  action?: string;
};

type CreateNpcBody = {
  masterUserId?: string;
  name?: string;
  sourceType?: string;
  role?: string;
  socialClass?: string;
  wealthTier?: string;
  random?: boolean;
  stat?: unknown;
  inventory?: InventoryInput;
  notes?: string;
};

type UpdateNpcBody = Partial<CreateNpcBody> & {
  isActive?: boolean;
};

type CreateNoteDocumentBody = {
  userId?: string;
  masterUserId?: string;
  characterStateId?: string;
  title?: string;
};

type UpdateNoteDocumentBody = {
  userId?: string;
  masterUserId?: string;
  title?: string;
  textContent?: string;
  drawing?: unknown;
  inkDelta?: number;
  isShownToGm?: boolean;
};

type TransferNoteDocumentBody = {
  userId?: string;
  masterUserId?: string;
  targetCharacterStateId?: string;
};

type UndoActionBody = {
  masterUserId?: string;
};

type CreateTurnEncounterBody = {
  masterUserId?: string;
  roomId?: string | null;
  name?: string;
  participantStateIds?: unknown;
};

type AddTurnNpcBody = {
  masterUserId?: string;
  name?: string;
  initiative?: number;
  armorClass?: number;
  currentHp?: number;
  maxHp?: number;
  speed?: number;
};

type UpdateTurnParticipantBody = {
  masterUserId?: string;
  initiative?: number;
  currentHp?: number;
  isActive?: boolean;
};

type UseTurnResourceBody = {
  userId?: string;
  masterUserId?: string;
  resource?: string;
  movement?: number;
  allowOverride?: boolean;
  notes?: string;
};

type AddTurnEffectBody = {
  masterUserId?: string;
  participantId?: string | null;
  name?: string;
  remainingRounds?: number;
  timing?: string;
  notes?: string;
};

type CloseTurnEncounterBody = {
  masterUserId?: string;
};

type UpdateRoomParticipantStatusBody = {
  userId?: string;
  masterUserId?: string;
  status?: string;
};

type LeaveRoomBody = {
  userId?: string;
};

const roomParticipantStatuses = new Set(['joined', 'online', 'offline', 'left', 'reconnecting']);
const roomSockets = new Map<string, Set<WebSocket>>();
const roomUserSockets = new Map<string, Set<WebSocket>>();
const pendingRealtimeWrites = new Set<Promise<unknown>>();

type RealtimeEvent = {
  type:
    | 'room:connected'
    | 'room:joined'
    | 'room:left'
    | 'room:participant-status'
    | 'character:hp-updated'
    | 'campaign:snapshot-created'
    | 'turn:updated'
    | 'room:refreshed'
    | 'error';
  roomId?: string;
  campaignId?: string;
  userId?: string;
  characterId?: string;
  payload?: unknown;
  at: string;
};

const defaultUsers: Array<{ id: string; displayName: string; defaultRole: LocalRole; authCode: string }> = [
  { id: 'local-master', displayName: 'Мастер', defaultRole: 'master', authCode: 'MASTER-LOCAL-0001' },
  { id: 'local-player-1', displayName: 'ERHA', defaultRole: 'player', authCode: 'ERHA-LOCAL-0001' },
  { id: 'local-player-2', displayName: 'ERHACHECK', defaultRole: 'player', authCode: 'ERHACHECK-LOCAL-0001' },
];

const defaultSettings = [
  {
    slug: 'universal',
    titleRu: 'Универсальная кампания',
    titleOriginal: null,
    description: 'Без жесткой привязки к одному миру.',
    isDefault: true,
  },
  {
    slug: 'forgotten-realms',
    titleRu: 'Забытые Королевства',
    titleOriginal: 'Forgotten Realms',
    description: 'Классический сеттинг для Sword Coast и многих базовых приключений.',
    isDefault: false,
  },
  {
    slug: 'eberron',
    titleRu: 'Эберрон',
    titleOriginal: 'Eberron',
    description: 'Магитех, дома драконьих меток и послевоенные интриги.',
    isDefault: false,
  },
  {
    slug: 'wildemount',
    titleRu: 'Уайлдмаунт',
    titleOriginal: 'Wildemount',
    description: 'Сеттинг Critical Role для кампаний в Экзандрии.',
    isDefault: false,
  },
  {
    slug: 'spelljammer',
    titleRu: 'Спеллджаммер',
    titleOriginal: 'Spelljammer',
    description: 'Космические путешествия, астральное море и корабли между мирами.',
    isDefault: false,
  },
  {
    slug: 'planescape',
    titleRu: 'Планскейп',
    titleOriginal: 'Planescape',
    description: 'Планы, Сигил и путешествия между измерениями.',
    isDefault: false,
  },
  {
    slug: 'ravenloft',
    titleRu: 'Равенлофт',
    titleOriginal: 'Ravenloft',
    description: 'Готический хоррор и владения ужаса.',
    isDefault: false,
  },
];

function getHealthStatus() {
  return {
    status: 'ok',
    service: 'dnd-5e-coster-api',
    version: appVersion,
    timestamp: new Date().toISOString(),
  };
}

function getLanAddresses() {
  return Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) =>
      (addresses ?? []).map((address) => ({
        name,
        address: address.address,
        family: address.family,
        internal: address.internal,
      })),
    )
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
}

function getNetworkInfo(frontendOrigin?: string) {
  const backendPort = Number(process.env.PORT ?? 3000);
  const originUrl = frontendOrigin ? new URL(frontendOrigin) : null;
  const frontendPort = Number(originUrl?.port || process.env.FRONTEND_PORT || 5173);
  const lanAddresses = getLanAddresses();

  return {
    host: process.env.HOST ?? '0.0.0.0',
    backendPort,
    frontendPort,
    lanAddresses,
    localFrontendUrl: `http://127.0.0.1:${frontendPort}`,
    localBackendUrl: `http://127.0.0.1:${backendPort}`,
    lanFrontendUrls: lanAddresses.map((address) => `http://${address}:${frontendPort}`),
    lanBackendUrls: lanAddresses.map((address) => `http://${address}:${backendPort}`),
    participantStatuses: Array.from(roomParticipantStatuses),
    realtimeEvents: [
      'room:connected',
      'room:joined',
      'room:left',
      'room:participant-status',
      'character:hp-updated',
      'campaign:snapshot-created',
      'turn:updated',
      'room:refreshed',
    ],
  };
}

function createRealtimeEvent(event: Omit<RealtimeEvent, 'at'>): RealtimeEvent {
  return {
    ...event,
    at: new Date().toISOString(),
  };
}

function sendRealtime(socket: WebSocket, event: RealtimeEvent) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(event));
  }
}

function broadcastRoom(roomId: string, event: Omit<RealtimeEvent, 'roomId' | 'at'>) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) {
    return;
  }

  const realtimeEvent = createRealtimeEvent({ ...event, roomId });
  for (const socket of sockets) {
    sendRealtime(socket, realtimeEvent);
  }
}

function trackRoomSocket(roomId: string, userId: string, socket: WebSocket) {
  const roomSet = roomSockets.get(roomId) ?? new Set<WebSocket>();
  roomSet.add(socket);
  roomSockets.set(roomId, roomSet);

  const userKey = `${roomId}:${userId}`;
  const userSet = roomUserSockets.get(userKey) ?? new Set<WebSocket>();
  userSet.add(socket);
  roomUserSockets.set(userKey, userSet);

  return () => {
    roomSet.delete(socket);
    if (roomSet.size === 0) {
      roomSockets.delete(roomId);
    }

    userSet.delete(socket);
    if (userSet.size === 0) {
      roomUserSockets.delete(userKey);
      return true;
    }

    return false;
  };
}

function trackRealtimeWrite<T>(promise: Promise<T>) {
  pendingRealtimeWrites.add(promise);
  void promise.finally(() => pendingRealtimeWrites.delete(promise));
  return promise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asBody<T extends Record<string, unknown>>(value: unknown): T {
  return (isRecord(value) ? value : {}) as T;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return text(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function integerOr(value: unknown, fallback: number, min: number, max: number) {
  return Math.floor(clampNumber(value, fallback, min, max));
}

function badRequest(reply: FastifyReply, message: string) {
  return reply.code(400).send({ message });
}

function forbidden(reply: FastifyReply, message: string) {
  return reply.code(403).send({ message });
}

function notFound(reply: FastifyReply, message: string) {
  return reply.code(404).send({ message });
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function hasDeleteConfirmation(value: unknown) {
  return typeof value === 'string' && value.trim().toLocaleLowerCase('ru-RU') === 'удалить';
}

type DndsuCatalogSource = {
  title: string;
  sourceType?: string;
  editionCompatibility?: string;
  defaultEnabled?: boolean;
  quality?: string;
  reviewStatus?: string;
};

type DndsuCatalogEntity = {
  canonicalId: string;
  russianName: string;
  englishName?: string | null;
  sourceTitle?: string;
  url?: string;
  sourcePriority?: string;
  editionCompatibility?: string;
  reviewStatus?: string;
};

type DndsuCatalog = {
  sources?: DndsuCatalogSource[];
  categories?: {
    classes?: DndsuCatalogEntity[];
    races?: DndsuCatalogEntity[];
    backgrounds?: DndsuCatalogEntity[];
  };
};

const siteSourceTitleRu = new Map<string, string>([
  ['Bigby Presents: Glory of the Giants', 'Бигби представляет: Слава гигантов'],
  ["Dungeon Master's Guide", 'Руководство мастера'],
  ['Eberron: Rising from the Last War', 'Эберрон: Восстание из Последней войны'],
  ["Explorer's Guide to Wildemount", 'Путеводитель исследователя по Уайлдмаунту'],
  ["Fizban's Treasury of Dragons", 'Сокровищница драконов Физбана'],
  ["Krenko's Way", 'Путь Кренко'],
  ['Monster Manual', 'Энциклопедия чудовищ'],
  ["Mordenkainen's Tome of Foes", 'Том врагов Морденкайнена'],
  ['Planescape: Adventures in the Multiverse', 'Planescape: Приключения в Мультивселенной'],
  ["Player's Handbook", 'Книга игрока'],
  ['Spelljammer: Adventures in Space', 'Spelljammer: Приключения в космосе'],
  ['Strixhaven: A Curriculum of Chaos', 'Стриксхейвен: Учебная программа хаоса'],
  ["Sword Coast Adventurer's Guide", 'Путеводитель приключенца по Побережью Мечей'],
  ["Tasha's Cauldron of Everything", 'Котел всего Таши'],
  ['The Book of Many Things', 'Книга многих вещей'],
  ["Van Richten's Guide to Ravenloft", 'Путеводитель Ван Рихтена по Равенлофту'],
  ["Volo's Guide to Monsters", 'Путеводитель Воло по монстрам'],
  ["Xanathar's Guide to Everything", 'Руководство Занатара обо всем'],
]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-zа-яё0-9]+/giu, '-')
    .replace(/^-+|-+$/g, '');
}

function readDndsuCatalogSources(): DndsuCatalogSource[] {
  const catalog = readDndsuCatalog();
  return Array.isArray(catalog?.sources) ? catalog.sources.filter((source) => text(source.title)) : [];
}

function readDndsuCatalog(): DndsuCatalog | null {
  if (!existsSync(dndsuCatalogPath)) {
    return null;
  }

  return JSON.parse(readFileSync(dndsuCatalogPath, 'utf8')) as DndsuCatalog;
}

type CharacterOptionFilter = {
  activeSourceTitles?: Set<string>;
  showInactive?: boolean;
};

function isReviewNeededMetadata(value: {
  sourceTitle?: string | null;
  editionCompatibility?: string | null;
  quality?: string | null;
  reviewStatus?: string | null;
}) {
  return (
    !value.sourceTitle ||
    value.sourceTitle === 'unknown' ||
    value.editionCompatibility === 'unknown' ||
    value.editionCompatibility === 'conflict' ||
    value.quality === 'site_needs_review' ||
    value.reviewStatus === 'needs_source_review' ||
    value.reviewStatus === 'needs_edition_review'
  );
}

function isFutureEdition(editionCompatibility?: string | null) {
  return editionCompatibility === '5e_2024';
}

function getCharacterOptions(filter: CharacterOptionFilter = {}) {
  const catalog = readDndsuCatalog();
  const toOption = (entity: DndsuCatalogEntity) => {
    const sourceTitle = entity.sourceTitle ?? 'unknown';
    const isActive = filter.activeSourceTitles ? filter.activeSourceTitles.has(sourceTitle) : true;

    return {
      id: entity.canonicalId,
      russianName: entity.russianName,
      englishName: entity.englishName ?? null,
      sourceTitle,
      url: entity.url ?? null,
      sourcePriority: entity.sourcePriority ?? 'site',
      editionCompatibility: entity.editionCompatibility ?? 'unknown',
      reviewStatus: entity.reviewStatus ?? 'site_catalog',
      isActive,
      isReviewNeeded: isReviewNeededMetadata(entity),
    };
  };

  const filterOptions = (items: DndsuCatalogEntity[] = []) =>
    items.map(toOption).filter((option) => {
      if (!filter.showInactive && isFutureEdition(option.editionCompatibility)) {
        return false;
      }

      if (!filter.showInactive && filter.activeSourceTitles && !option.isActive) {
        return false;
      }

      return true;
    });

  return {
    classes: filterOptions(catalog?.categories?.classes),
    ancestries: filterOptions(catalog?.categories?.races),
    backgrounds: filterOptions(catalog?.categories?.backgrounds),
  };
}

function getSiteSourceProfile(source: DndsuCatalogSource) {
  const titleOriginal = source.title;
  const sourceKey = `dndsu:${slugify(titleOriginal)}`;
  const isCore = ["Player's Handbook", "Dungeon Master's Guide", 'Monster Manual'].includes(titleOriginal);
  const isManyThings = titleOriginal === 'The Book of Many Things';

  return {
    fileName: sourceKey,
    filePath: null,
    titleRu: siteSourceTitleRu.get(titleOriginal) ?? titleOriginal,
    titleOriginal,
    sourceType: source.sourceType ?? 'unknown',
    language: 'russian',
    quality: isManyThings ? 'site_needs_review' : (source.quality ?? 'site'),
    editionCompatibility: source.editionCompatibility ?? 'unknown',
    sourcePriority: 'site',
    isCore,
    isOfficial: true,
    isEnabledByDefault: isManyThings ? false : (source.defaultEnabled ?? false),
    notes: 'Источник: dnd.su',
  };
}

function isHomebrewSource(sourceBook: {
  titleOriginal: string | null;
  titleRu: string;
  sourceType: string;
  notes: string | null;
}) {
  const searchable = `${sourceBook.titleOriginal ?? ''} ${sourceBook.titleRu} ${sourceBook.sourceType} ${sourceBook.notes ?? ''}`;
  return /homebrew|хоумбрю/i.test(searchable);
}

function getSourceSettingTags(sourceBook: { titleOriginal: string | null; titleRu: string }) {
  const title = `${sourceBook.titleOriginal ?? ''} ${sourceBook.titleRu}`.toLowerCase();
  const tags = new Set<string>();

  if (/eberron/.test(title)) {
    tags.add('eberron');
  }

  if (/wildemount|tal[’']?dorei|netherdeep|critical role/.test(title)) {
    tags.add('wildemount');
  }

  if (/spelljammer|astral adventurer|boo[’']?s astral|xaryxis/.test(title)) {
    tags.add('spelljammer');
  }

  if (/planescape|sigil|outlands|mortuary/.test(title)) {
    tags.add('planescape');
  }

  if (/ravenloft|strahd|van richten/.test(title)) {
    tags.add('ravenloft');
  }

  if (
    /forgotten realms|sword coast|baldur|waterdeep|phandelver|lost mine|dragon heist|mad mage|icewind|avernus|tiamat|dragon queen|storm king|princes of the apocalypse|tomb of annihilation|out of the abyss|candlekeep|icespire|divine contention|sleeping dragon|storm lord/.test(
      title,
    )
  ) {
    tags.add('forgotten-realms');
  }

  return tags;
}

function shouldEnableSourceForCampaign(
  settingSlug: string,
  sourceBook: {
    titleOriginal: string | null;
    titleRu: string;
    sourceType: string;
    isCore: boolean;
    isEnabledByDefault: boolean;
    editionCompatibility: string;
    notes: string | null;
  },
  includeHomebrewDlc: boolean,
) {
  const title = `${sourceBook.titleOriginal ?? ''} ${sourceBook.titleRu}`.toLowerCase();

  if (isFutureEdition(sourceBook.editionCompatibility)) {
    return false;
  }

  if (isHomebrewSource(sourceBook)) {
    return includeHomebrewDlc;
  }

  if (settingSlug === 'universal') {
    return true;
  }

  if (/book of many things|книга многих вещей/.test(title)) {
    return false;
  }

  if (sourceBook.isCore || sourceBook.isEnabledByDefault) {
    return true;
  }

  if (['core_rules', 'rules_expansion', 'bestiary_expansion'].includes(sourceBook.sourceType)) {
    return true;
  }

  return getSourceSettingTags(sourceBook).has(settingSlug);
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function incomingJsonObject(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return parseJsonObject(value);
  }

  return {};
}

const inventoryItemKinds = new Set(['weapon', 'armor', 'consumable', 'tool', 'treasure', 'note']);
const equipmentSlots = new Set(['mainHand', 'offHand', 'armor', 'quick']);

function sanitizeInventoryItem(value: unknown): InventoryItemInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = text(value.name);
  if (!name) {
    return null;
  }

  const kind = text(value.kind);
  const equippedSlot = text(value.equippedSlot);

  return {
    id: text(value.id) ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.slice(0, 80),
    kind: kind && inventoryItemKinds.has(kind) ? kind : 'note',
    quantity: integerOr(value.quantity, 1, 1, 9999),
    weight: clampNumber(value.weight, 0, 0, 9999),
    gpValue: clampNumber(value.gpValue, 0, 0, 999999),
    damageDice: text(value.damageDice)?.slice(0, 24) ?? '',
    damageType: text(value.damageType)?.slice(0, 32) ?? '',
    armorClass: integerOr(value.armorClass, 10, 0, 40),
    proficient: value.proficient === true,
    equippedSlot: equippedSlot && equipmentSlots.has(equippedSlot) ? equippedSlot : null,
    notes: text(value.notes)?.slice(0, 280) ?? '',
  };
}

function sanitizeInventory(value: unknown) {
  const source = isRecord(value) ? value : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.map(sanitizeInventoryItem).filter((item): item is InventoryItemInput => item !== null);
  const occupiedSlots = new Set<string>();

  for (const item of items) {
    const slot = typeof item.equippedSlot === 'string' ? item.equippedSlot : null;
    if (!slot || occupiedSlots.has(slot)) {
      item.equippedSlot = null;
      continue;
    }
    occupiedSlots.add(slot);
  }

  return {
    cp: integerOr(source.cp, 0, 0, 999999),
    sp: integerOr(source.sp, 0, 0, 999999),
    ep: integerOr(source.ep, 0, 0, 999999),
    gp: integerOr(source.gp, 0, 0, 999999),
    pp: integerOr(source.pp, 0, 0, 999999),
    items,
  };
}

function parseInventory(value: string | null | undefined) {
  if (!value) {
    return sanitizeInventory({});
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return sanitizeInventory({ items: parsed });
    }
    return sanitizeInventory(parsed);
  } catch {
    return sanitizeInventory({});
  }
}

function getInventoryItemBasePrice(item: InventoryItemInput) {
  const explicitPrice = Number(item.gpValue);
  if (Number.isFinite(explicitPrice) && explicitPrice > 0) {
    return explicitPrice;
  }

  const kind = text(item.kind);
  if (kind === 'weapon') {
    return 5;
  }
  if (kind === 'armor') {
    return 10;
  }
  if (kind === 'consumable') {
    return 2;
  }
  if (kind === 'treasure') {
    return 25;
  }
  return 1;
}

function getInventoryItemPrice(item: InventoryItemInput, quantity: number, multiplier = 1) {
  return Math.max(1, Math.ceil(getInventoryItemBasePrice(item) * quantity * multiplier));
}

function cloneInventoryItemForMove(item: InventoryItemInput, quantity: number): InventoryItemInput {
  return {
    ...item,
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    quantity,
    equippedSlot: null,
  };
}

function addInventoryItemStack(inventory: ReturnType<typeof sanitizeInventory>, item: InventoryItemInput) {
  const quantity = integerOr(item.quantity, 1, 1, 9999);
  const matching = inventory.items.find(
    (current) =>
      text(current.name) === text(item.name) &&
      text(current.kind) === text(item.kind) &&
      text(current.damageDice) === text(item.damageDice) &&
      integerOr(current.armorClass, 0, 0, 40) === integerOr(item.armorClass, 0, 0, 40) &&
      Number(current.gpValue ?? 0) === Number(item.gpValue ?? 0),
  );

  if (matching) {
    matching.quantity = integerOr(Number(matching.quantity) + quantity, quantity, 1, 9999);
  } else {
    inventory.items.push(cloneInventoryItemForMove(item, quantity));
  }
}

function removeInventoryItemStack(inventory: ReturnType<typeof sanitizeInventory>, itemId: string, quantity: number) {
  const item = inventory.items.find((current) => text(current.id) === itemId);
  if (!item) {
    return null;
  }

  const available = integerOr(item.quantity, 1, 1, 9999);
  const usedQuantity = Math.min(quantity, available);
  item.quantity = available - usedQuantity;
  inventory.items = inventory.items.filter((current) => integerOr(current.quantity, 0, 0, 9999) > 0);

  return cloneInventoryItemForMove(item, usedQuantity);
}

function sanitizeSpell(value: unknown): SpellInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = text(value.name);
  if (!name) {
    return null;
  }

  return {
    id: text(value.id) ?? `spell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.slice(0, 80),
    level: integerOr(value.level, 0, 0, 9),
    school: text(value.school)?.slice(0, 40) ?? '',
    castingTime: text(value.castingTime)?.slice(0, 40) ?? '',
    range: text(value.range)?.slice(0, 40) ?? '',
    duration: text(value.duration)?.slice(0, 60) ?? '',
    components: text(value.components)?.slice(0, 80) ?? '',
    damage: text(value.damage)?.slice(0, 60) ?? '',
    healing: text(value.healing)?.slice(0, 60) ?? '',
    prepared: value.prepared !== false,
    notes: text(value.notes)?.slice(0, 280) ?? '',
  };
}

function sanitizeSpellcasting(value: unknown) {
  const source = isRecord(value) ? value : {};
  const rawSlots = isRecord(source.slots) ? source.slots : {};
  const slots: Record<string, { max: number; current: number }> = {};

  for (let level = 1; level <= 9; level += 1) {
    const key = String(level);
    const rawSlot = isRecord(rawSlots[key]) ? rawSlots[key] : {};
    const max = integerOr(rawSlot.max, 0, 0, 99);
    const current = integerOr(rawSlot.current, max, 0, max);
    slots[key] = { max, current };
  }

  const rawResources = isRecord(source.resources) ? source.resources : {};
  const resources = {
    primaryName: text(rawResources.primaryName)?.slice(0, 60) ?? 'Классовый ресурс',
    max: integerOr(rawResources.max, 0, 0, 99),
    current: integerOr(rawResources.current, integerOr(rawResources.max, 0, 0, 99), 0, 99),
  };
  resources.current = Math.min(resources.current, resources.max);

  const rawSpells = Array.isArray(source.spells) ? source.spells : [];

  return {
    spellcastingAbility: text(source.spellcastingAbility)?.slice(0, 40) ?? 'Интеллект',
    spellSaveDc: integerOr(source.spellSaveDc, 10, 0, 40),
    spellAttackBonus: integerOr(source.spellAttackBonus, 0, -20, 40),
    slots,
    resources,
    spells: rawSpells.map(sanitizeSpell).filter((spell): spell is SpellInput => spell !== null),
  };
}

function getSpellcastingFromSheetJson(sheetJson: string | null | undefined) {
  const sheet = parseJsonObject(sheetJson);
  return sanitizeSpellcasting(sheet.spellcasting);
}

type RestState = {
  hitDiceMax: number;
  hitDiceCurrent: number;
  hitDieSize: number;
  lastRestType: RestType | null;
  lastRestAt: string | null;
};

type RestHitDiceUse = {
  characterId: string;
  hitDice: number;
  heal: number | null;
};

function sanitizeRestState(value: unknown, level: number): RestState {
  const source = isRecord(value) ? value : {};
  const max = integerOr(source.hitDiceMax, Math.max(1, level), 1, 40);
  const rawType = text(source.lastRestType);

  return {
    hitDiceMax: max,
    hitDiceCurrent: integerOr(source.hitDiceCurrent, max, 0, max),
    hitDieSize: integerOr(source.hitDieSize, 8, 4, 12),
    lastRestType: rawType === 'short' || rawType === 'long' ? rawType : null,
    lastRestAt: text(source.lastRestAt) ?? null,
  };
}

function getRestStateFromSheetJson(sheetJson: string | null | undefined, level: number) {
  const sheet = parseJsonObject(sheetJson);
  return sanitizeRestState(sheet.rest, level);
}

function getAverageHitDieHealing(hitDieSize: number) {
  return Math.max(1, Math.floor(hitDieSize / 2) + 1);
}

function restoreSpellcastingForRest(spellcasting: ReturnType<typeof sanitizeSpellcasting>, restType: RestType) {
  const next = sanitizeSpellcasting(spellcasting);

  if (restType === 'long') {
    for (const slot of Object.values(next.slots)) {
      slot.current = slot.max;
    }
  }

  next.resources.current = next.resources.max;
  return next;
}

function normalizeRestHitDiceUses(value: unknown): Map<string, RestHitDiceUse> {
  const uses = new Map<string, RestHitDiceUse>();
  const rawEntries: unknown[] = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.entries(value).map(([characterId, hitDice]) => ({ characterId, hitDice }))
      : [];

  for (const entry of rawEntries) {
    if (!isRecord(entry)) {
      continue;
    }

    const characterId = text(entry.characterId);
    if (!characterId) {
      continue;
    }

    const previous = uses.get(characterId);
    const hitDice = integerOr(entry.hitDice, 0, 0, 40);
    const heal = entry.heal === null || entry.heal === undefined ? null : integerOr(entry.heal, 0, 0, 999);

    uses.set(characterId, {
      characterId,
      hitDice: Math.min(40, (previous?.hitDice ?? 0) + hitDice),
      heal: heal ?? previous?.heal ?? null,
    });
  }

  return uses;
}

const homebrewKinds = new Set<HomebrewKind>(['item', 'weapon', 'spell', 'effect', 'race', 'rule']);

function normalizeHomebrewKind(value: unknown): HomebrewKind {
  return typeof value === 'string' && homebrewKinds.has(value as HomebrewKind) ? (value as HomebrewKind) : 'item';
}

function parseHomebrewPayload(value: string | null | undefined) {
  return parseJsonObject(value);
}

function createHomebrewInventoryItem(content: { id: string; name: string; kind: string; payloadJson: string }) {
  const payload = parseHomebrewPayload(content.payloadJson);
  return sanitizeInventoryItem({
    id: `homebrew-${content.id}-${Date.now()}`,
    name: text(payload.name) ?? content.name,
    kind: content.kind === 'weapon' ? 'weapon' : (text(payload.kind) ?? 'note'),
    quantity: integerOr(payload.quantity, 1, 1, 9999),
    weight: clampNumber(payload.weight, 0, 0, 9999),
    gpValue: clampNumber(payload.gpValue, 0, 0, 999999),
    damageDice: text(payload.damageDice) ?? (content.kind === 'weapon' ? '2к4+3' : ''),
    damageType: text(payload.damageType) ?? (content.kind === 'weapon' ? 'излучение' : ''),
    armorClass: integerOr(payload.armorClass, 0, 0, 40),
    proficient: payload.proficient !== false,
    equippedSlot: null,
    notes: `${text(payload.notes) ?? ''} homebrew:${content.id}`.trim(),
  });
}

function createHomebrewSpell(content: { id: string; name: string; payloadJson: string }) {
  const payload = parseHomebrewPayload(content.payloadJson);
  return sanitizeSpell({
    id: `homebrew-${content.id}-${Date.now()}`,
    name: text(payload.name) ?? content.name,
    level: integerOr(payload.level, 1, 0, 9),
    school: text(payload.school) ?? 'Хоумбрю',
    castingTime: text(payload.castingTime) ?? '1 действие',
    range: text(payload.range) ?? '60 фт.',
    duration: text(payload.duration) ?? 'Мгновенная',
    components: text(payload.components) ?? 'В, С',
    damage: text(payload.damage) ?? '',
    healing: text(payload.healing) ?? '',
    prepared: payload.prepared !== false,
    notes: `${text(payload.notes) ?? ''} homebrew:${content.id}`.trim(),
  });
}

const npcNamePool = ['Арина', 'Борис', 'Велена', 'Грат', 'Дамир', 'Ильмар', 'Кира', 'Мирт', 'Нора', 'Терен'];
const npcRolePool = ['трактирщик', 'стражник', 'проводник', 'торговец', 'писарь', 'наемник', 'вор', 'жрец'];
const npcSocialClasses = ['бедняк', 'простолюдин', 'ремесленник', 'купец', 'дворянин'];
const npcWealthTiers = ['бедный', 'скромный', 'комфортный', 'богатый'];

function pickFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function createNpcStats(value: unknown, fallbackRole: string) {
  const source = isRecord(value) ? value : {};
  return {
    armorClass: integerOr(source.armorClass, 10, 1, 30),
    currentHp: integerOr(source.currentHp, 8, 1, 999),
    maxHp: integerOr(source.maxHp, integerOr(source.currentHp, 8, 1, 999), 1, 999),
    speed: integerOr(source.speed, 30, 0, 120),
    challenge: text(source.challenge) ?? '0',
    role: text(source.role) ?? fallbackRole,
  };
}

function createNpcInventoryForTier(wealthTier: string, inventory?: InventoryInput) {
  const base = sanitizeInventory(inventory ?? {});
  const tierGold: Record<string, number> = {
    бедный: 2,
    скромный: 8,
    комфортный: 25,
    богатый: 80,
  };

  base.gp = Math.max(base.gp, tierGold[wealthTier] ?? 8);

  if (base.items.length === 0) {
    const item = sanitizeInventoryItem({
      name: wealthTier === 'богатый' ? 'Печатка с гербом' : 'Кошель с мелочью',
      kind: wealthTier === 'богатый' ? 'treasure' : 'note',
      quantity: 1,
      weight: 0,
      gpValue: wealthTier === 'богатый' ? 25 : 1,
      notes: 'NPC loot',
    });
    if (item) {
      base.items.push(item);
    }
  }

  return base;
}

function parseDocumentHistory(value: string | null | undefined) {
  const parsed = (() => {
    try {
      return value ? (JSON.parse(value) as unknown) : [];
    } catch {
      return [];
    }
  })();

  return Array.isArray(parsed) ? parsed.filter(isRecord).slice(-40) : [];
}

function normalizeDrawing(value: unknown) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    .map((path) => path.slice(0, 2000))
    .slice(-120);
}

function appendDocumentHistory(historyJson: string | null | undefined, entry: Record<string, unknown>) {
  return JSON.stringify([...parseDocumentHistory(historyJson), entry].slice(-50));
}

function parseActionPayload(value: string | null | undefined) {
  return parseJsonObject(value);
}

function isRevertedAction(payload: Record<string, unknown>) {
  return payload.reverted === true;
}

async function broadcastCampaignRefresh(campaignId: string, actorUserId: string, characterId?: string) {
  const rooms = await prisma.gameRoom.findMany({
    where: { campaignId },
    select: { id: true },
  });

  for (const room of rooms) {
    broadcastRoom(room.id, {
      type: 'room:refreshed',
      campaignId,
      userId: actorUserId,
      characterId,
    });
  }
}

async function seedLocalData() {
  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { slug: setting.slug },
      update: setting,
      create: setting,
    });
  }

  for (const user of defaultUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        displayName: user.displayName,
        defaultRole: user.defaultRole,
        authCode: user.authCode,
        isLocal: true,
      },
      create: {
        id: user.id,
        displayName: user.displayName,
        defaultRole: user.defaultRole,
        authCode: user.authCode,
        isLocal: true,
      },
    });

    await prisma.characterLibrary.upsert({
      where: { ownerId: user.id },
      update: {},
      create: { ownerId: user.id },
    });
  }

  const catalogSources = readDndsuCatalogSources();
  if (catalogSources.length > 0) {
    await prisma.sourceBook.deleteMany({
      where: {
        OR: [{ filePath: { not: null } }, { fileName: { not: { startsWith: 'dndsu:' } } }],
      },
    });

    for (const source of catalogSources) {
      const profile = getSiteSourceProfile(source);

      await prisma.sourceBook.upsert({
        where: { fileName: profile.fileName },
        update: profile,
        create: profile,
      });
    }

    const [campaigns, sourceBooks] = await Promise.all([
      prisma.campaign.findMany({ select: { id: true } }),
      prisma.sourceBook.findMany({ where: { fileName: { startsWith: 'dndsu:' } } }),
    ]);

    for (const campaign of campaigns) {
      for (const sourceBook of sourceBooks) {
        await prisma.campaignSourceBook.upsert({
          where: {
            campaignId_sourceBookId: {
              campaignId: campaign.id,
              sourceBookId: sourceBook.id,
            },
          },
          update: {},
          create: {
            campaignId: campaign.id,
            sourceBookId: sourceBook.id,
            isEnabled: sourceBook.isEnabledByDefault,
          },
        });
      }
    }
  }

  const legacyHomebrew = await prisma.homebrewContent.findMany({
    where: {
      OR: [{ ownerId: null }, { campaignId: { not: null } }],
    },
    include: { legacyCampaign: true },
  });

  for (const content of legacyHomebrew) {
    const ownerId = content.ownerId ?? content.legacyCampaign?.ownerId ?? 'local-master';
    await prisma.homebrewContent.update({
      where: { id: content.id },
      data: { ownerId, campaignId: null },
    });

    if (content.campaignId) {
      await prisma.campaignHomebrewContent.upsert({
        where: {
          campaignId_homebrewContentId: {
            campaignId: content.campaignId,
            homebrewContentId: content.id,
          },
        },
        update: {},
        create: {
          campaignId: content.campaignId,
          homebrewContentId: content.id,
        },
      });
    }
  }
}

async function isCampaignMaster(campaignId: string, userId: string) {
  const member = await prisma.campaignMember.findUnique({
    where: {
      campaignId_userId: {
        campaignId,
        userId,
      },
    },
  });

  if (member?.role === 'master') {
    return true;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.defaultRole === 'master';
}

async function isMasterUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.defaultRole === 'master';
}

async function canManageHomebrew(homebrew: { ownerId: string | null; campaignId: string | null }, userId: string) {
  if (homebrew.ownerId === userId || (await isMasterUser(userId))) {
    return true;
  }

  return homebrew.campaignId ? isCampaignMaster(homebrew.campaignId, userId) : false;
}

async function createAutosave(scope: string, scopeId: string, summary: string, userId?: string, campaignId?: string) {
  await prisma.saveSnapshot.create({
    data: {
      scope,
      scopeId,
      summary,
      userId,
      campaignId,
      payloadJson: JSON.stringify({ autosave: true, at: new Date().toISOString() }),
    },
  });
}

async function ensureCampaignCharacterState(campaignId: string, characterId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { sheetState: true },
  });

  if (!character) {
    return null;
  }

  return prisma.campaignCharacterState.upsert({
    where: {
      campaignId_characterId: {
        campaignId,
        characterId,
      },
    },
    update: {},
    create: {
      campaignId,
      characterId,
      level: character.level,
      currentHp: character.sheetState?.currentHp ?? 10,
      maxHp: character.sheetState?.maxHp ?? 10,
      armorClass: character.sheetState?.armorClass ?? 10,
      speed: character.sheetState?.speed ?? 30,
      sheetJson: JSON.stringify({
        ...parseJsonObject(character.sheetState?.sheetJson),
        copiedFromLibrary: true,
      }),
    },
    include: { character: { include: { owner: true, sheetState: true } } },
  });
}

function getSourceDisplayTitle(sourceBook: { titleOriginal: string | null; titleRu: string }) {
  return sourceBook.titleOriginal ?? sourceBook.titleRu;
}

function serializeImportedContent<T extends { mechanicsJson: string; payloadJson: string }>(content: T) {
  return {
    ...content,
    mechanics: parseJsonObject(content.mechanicsJson),
    payload: parseJsonObject(content.payloadJson),
  };
}

async function getActiveSourceTitlesForContext(campaignId?: string, roomId?: string) {
  if (roomId) {
    const room = await prisma.gameRoom.findUnique({
      where: { id: roomId },
      include: {
        campaign: { include: { sourceBooks: { include: { sourceBook: true } } } },
        sourceOverrides: { include: { sourceBook: true } },
      },
    });

    if (!room) {
      return null;
    }

    const activeSourceIds = new Set(
      room.campaign.sourceBooks.filter((link) => link.isEnabled).map((link) => link.sourceBookId),
    );

    for (const override of room.sourceOverrides) {
      if (override.isEnabled) {
        activeSourceIds.add(override.sourceBookId);
      } else {
        activeSourceIds.delete(override.sourceBookId);
      }
    }

    return new Set(
      [...room.campaign.sourceBooks, ...room.sourceOverrides]
        .map((entry) => entry.sourceBook)
        .filter((sourceBook) => activeSourceIds.has(sourceBook.id))
        .map(getSourceDisplayTitle),
    );
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { sourceBooks: { include: { sourceBook: true } } },
    });

    if (!campaign) {
      return null;
    }

    return new Set(
      campaign.sourceBooks
        .filter((link) => link.isEnabled)
        .map((link) => getSourceDisplayTitle(link.sourceBook)),
    );
  }

  return undefined;
}

function campaignInclude() {
  return {
    owner: true,
    setting: true,
    members: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
    parties: { include: { characters: true }, orderBy: { createdAt: 'asc' as const } },
    rooms: {
      include: {
        setting: true,
        participants: { include: { user: true, character: true } },
        sourceOverrides: { include: { sourceBook: true }, orderBy: { createdAt: 'asc' as const } },
      },
      orderBy: { updatedAt: 'desc' as const },
    },
    sourceBooks: { include: { sourceBook: true }, orderBy: { createdAt: 'asc' as const } },
    characterStates: {
      include: { character: { include: { owner: true, sheetState: true } } },
      orderBy: { updatedAt: 'desc' as const },
    },
    turnEncounters: {
      where: { status: 'active' },
      include: turnEncounterInclude(),
      orderBy: { updatedAt: 'desc' as const },
    },
    merchants: {
      include: merchantInclude(),
      orderBy: { updatedAt: 'desc' as const },
    },
    homebrewLinks: {
      include: { homebrewContent: true },
      orderBy: { createdAt: 'desc' as const },
    },
    npcProfiles: {
      include: npcInclude(),
      orderBy: { updatedAt: 'desc' as const },
    },
    noteDocuments: {
      orderBy: { updatedAt: 'desc' as const },
    },
  };
}

function turnEncounterInclude() {
  return {
    room: true,
    participants: {
      include: {
        characterState: {
          include: {
            character: { include: { owner: true, sheetState: true } },
          },
        },
      },
      orderBy: [{ turnOrder: 'asc' as const }, { initiative: 'desc' as const }],
    },
    effects: {
      include: { participant: true },
      orderBy: { createdAt: 'asc' as const },
    },
  };
}

function merchantInclude() {
  return {
    theftRequests: {
      orderBy: { createdAt: 'desc' as const },
    },
  };
}

function npcInclude() {
  return {
    theftRequests: {
      orderBy: { createdAt: 'desc' as const },
    },
  };
}

const turnResourceLabels = {
  action: 'действие',
  bonusAction: 'бонусное действие',
  reaction: 'реакция',
  movement: 'перемещение',
} as const;

type TurnResource = keyof typeof turnResourceLabels;

function normalizeTurnResource(value: unknown): TurnResource | null {
  return typeof value === 'string' && value in turnResourceLabels ? (value as TurnResource) : null;
}

function getActiveTurnParticipants<T extends { id: string; isActive: boolean; turnOrder: number; initiative: number; name: string }>(participants: T[]) {
  return participants
    .filter((participant) => participant.isActive)
    .sort((left, right) => left.turnOrder - right.turnOrder || right.initiative - left.initiative || left.name.localeCompare(right.name));
}

async function normalizeTurnOrder(encounterId: string) {
  const participants = await prisma.turnParticipant.findMany({
    where: { encounterId, isActive: true },
    orderBy: [{ initiative: 'desc' }, { name: 'asc' }],
  });

  await Promise.all(
    participants.map((participant, index) =>
      prisma.turnParticipant.update({
        where: { id: participant.id },
        data: { turnOrder: index },
      }),
    ),
  );

  const encounter = await prisma.turnEncounter.findUnique({ where: { id: encounterId } });
  if (encounter && encounter.currentTurnIndex >= participants.length) {
    await prisma.turnEncounter.update({
      where: { id: encounterId },
      data: { currentTurnIndex: Math.max(0, participants.length - 1) },
    });
  }
}

async function getFullTurnEncounter(encounterId: string) {
  return prisma.turnEncounter.findUnique({
    where: { id: encounterId },
    include: turnEncounterInclude(),
  });
}

function broadcastTurnEncounter(encounter: { roomId: string | null; campaignId: string; id: string }, userId?: string, payload?: unknown) {
  if (!encounter.roomId) {
    return;
  }

  broadcastRoom(encounter.roomId, {
    type: 'turn:updated',
    campaignId: encounter.campaignId,
    userId,
    payload: payload ?? { encounterId: encounter.id },
  });
}

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  await prisma.$connect();
  await seedLocalData();

  server.addHook('onClose', async () => {
    await Promise.allSettled(Array.from(pendingRealtimeWrites));
    await prisma.$disconnect();
  });

  await server.register(websocket);

  await server.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });

  server.get<{ Params: { roomId: string }; Querystring: { userId?: string } }>(
    '/ws/rooms/:roomId',
    { websocket: true },
    (socket, request) => {
      const roomId = request.params.roomId;
      const userId = text(request.query.userId);
      let cleanup: (() => boolean) | null = null;
      let participantId: string | null = null;
      let campaignId: string | null = null;

      socket.on('message', (message) => {
        const raw = message.toString();
        if (raw === 'ping') {
          sendRealtime(socket, createRealtimeEvent({ type: 'room:connected', roomId, userId, payload: { pong: true } }));
          return;
        }

        try {
          const payload = JSON.parse(raw || '{}') as { type?: string };
          if (payload.type === 'room:refreshed') {
            broadcastRoom(roomId, { type: 'room:refreshed', userId, campaignId: campaignId ?? undefined });
          }
        } catch {
          sendRealtime(socket, createRealtimeEvent({ type: 'error', roomId, userId, payload: { message: 'Некорректное realtime-сообщение.' } }));
        }
      });

      void (async () => {
        if (!userId) {
          sendRealtime(socket, createRealtimeEvent({ type: 'error', roomId, payload: { message: 'Не указан пользователь.' } }));
          socket.close(1008, 'userId required');
          return;
        }

        const room = await prisma.gameRoom.findUnique({
          where: { id: roomId },
          include: {
            participants: true,
          },
        });

        if (!room) {
          sendRealtime(socket, createRealtimeEvent({ type: 'error', roomId, userId, payload: { message: 'Комната не найдена.' } }));
          socket.close(1008, 'room not found');
          return;
        }

        campaignId = room.campaignId;
        const participant = room.participants.find((item) => item.userId === userId);
        if (participant) {
          participantId = participant.id;
          await prisma.roomParticipant.update({
            where: { id: participant.id },
            data: { status: 'online' },
          });
        }

        cleanup = trackRoomSocket(roomId, userId, socket);
        sendRealtime(
          socket,
          createRealtimeEvent({
            type: 'room:connected',
            roomId,
            campaignId: room.campaignId,
            userId,
            payload: { participantId, status: participant ? 'online' : 'watching' },
          }),
        );

        if (participantId) {
          broadcastRoom(roomId, {
            type: 'room:participant-status',
            campaignId: room.campaignId,
            userId,
            payload: { participantId, status: 'online' },
          });
        }
      })().catch((error: unknown) => {
        server.log.error(error);
        sendRealtime(socket, createRealtimeEvent({ type: 'error', roomId, userId, payload: { message: 'Ошибка realtime-канала.' } }));
        socket.close(1011, 'realtime error');
      });

      socket.on('close', () => {
        void trackRealtimeWrite((async () => {
          const wasLastUserSocket = cleanup?.() ?? false;
          if (!wasLastUserSocket || !participantId || !campaignId || !userId) {
            return;
          }

          const updatedParticipant = await prisma.roomParticipant.updateMany({
            where: { id: participantId },
            data: { status: 'offline' },
          });

          if (updatedParticipant.count === 0) {
            return;
          }

          broadcastRoom(roomId, {
            type: 'room:participant-status',
            campaignId,
            userId,
            payload: { participantId, status: 'offline' },
          });
        })()).catch((error: unknown) => server.log.error(error));
      });
    },
  );

  server.get('/health', async () => getHealthStatus());
  server.get('/api/health', async () => getHealthStatus());

  server.get('/api/network/info', async (request) => getNetworkInfo(request.headers.origin));

  server.get('/api/app', async () => ({
    name: 'Костёр — D&D 5e',
    ruleset: 'D&D 5e 2014',
    language: 'ru',
    stage: {
      current: 4,
      title: 'Базовый лист персонажа',
      status: 'Подключен каталог dnd.su и расширяемый лист персонажа.',
      next: 'Дальше можно наращивать источники, инвентарь и автоматизацию правил.',
    },
    modes: [
      { id: 'master', title: 'Мастер' },
      { id: 'player', title: 'Игрок' },
    ],
  }));

  server.get('/api/db/status', async () => {
    await prisma.$queryRaw`SELECT 1`;

    const [sourceBookCount, campaignCount, characterCount, roomCount] = await Promise.all([
      prisma.sourceBook.count(),
      prisma.campaign.count(),
      prisma.character.count(),
      prisma.gameRoom.count(),
    ]);

    return {
      status: 'connected',
      provider: databaseProvider,
      url: process.env.DATABASE_URL,
      sourceBookCount,
      campaignCount,
      characterCount,
      roomCount,
    };
  });

  server.get('/api/bootstrap', async () => {
    const [users, settings, sourceBooks, campaigns, characters, campaignCharacterStates, homebrewContents, saveSnapshots] = await Promise.all([
      prisma.user.findMany({ orderBy: [{ defaultRole: 'asc' }, { displayName: 'asc' }] }),
      prisma.setting.findMany({ orderBy: [{ isDefault: 'desc' }, { titleRu: 'asc' }] }),
      prisma.sourceBook.findMany({ orderBy: [{ isCore: 'desc' }, { titleRu: 'asc' }] }),
      prisma.campaign.findMany({ include: campaignInclude(), orderBy: { updatedAt: 'desc' } }),
      prisma.character.findMany({
        include: { sheetState: true, owner: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.campaignCharacterState.findMany({
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.homebrewContent.findMany({
        include: {
          campaignLinks: {
            include: { campaign: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.saveSnapshot.findMany({
        include: { user: true, campaign: true },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);

    return {
      users,
      settings,
      sourceBooks,
      characterOptions: getCharacterOptions(),
      campaigns,
      characters,
      campaignCharacterStates,
      homebrewContents,
      saveSnapshots,
    };
  });

  server.get('/api/rules/character-options', async (request, reply) => {
    const query = request.query as { campaignId?: string; roomId?: string; showInactive?: string };
    const campaignId = text(query.campaignId);
    const roomId = text(query.roomId);
    const showInactive = query.showInactive === 'true' || query.showInactive === '1';
    const activeSourceTitles = await getActiveSourceTitlesForContext(campaignId, roomId);

    if (activeSourceTitles === null) {
      return notFound(reply, 'Кампания или комната для фильтра источников не найдена.');
    }

    return getCharacterOptions({ activeSourceTitles, showInactive });
  });

  server.get('/api/users/local', async () =>
    prisma.user.findMany({ orderBy: [{ defaultRole: 'asc' }, { displayName: 'asc' }] }),
  );

  server.get('/api/settings', async () =>
    prisma.setting.findMany({ orderBy: [{ isDefault: 'desc' }, { titleRu: 'asc' }] }),
  );

  server.get('/api/source-books', async () =>
    prisma.sourceBook.findMany({ orderBy: [{ isCore: 'desc' }, { titleRu: 'asc' }] }),
  );

  server.get('/api/rules/imported-content/stats', async () => {
    const grouped = await prisma.importedContent.groupBy({
      by: ['category', 'editionCompatibility', 'reviewStatus'],
      _count: { _all: true },
      orderBy: [{ category: 'asc' }, { editionCompatibility: 'asc' }, { reviewStatus: 'asc' }],
    });

    return grouped.map((row) => ({
      category: row.category,
      editionCompatibility: row.editionCompatibility,
      reviewStatus: row.reviewStatus,
      count: row._count._all,
    }));
  });

  server.get('/api/rules/imported-content', async (request, reply) => {
    const query = request.query as {
      category?: string;
      campaignId?: string;
      roomId?: string;
      showInactive?: string;
      includeFutureEdition?: string;
      limit?: string;
    };
    const category = text(query.category) ?? 'spells';
    const campaignId = text(query.campaignId);
    const roomId = text(query.roomId);
    const showInactive = query.showInactive === 'true' || query.showInactive === '1';
    const includeFutureEdition = query.includeFutureEdition === 'true' || query.includeFutureEdition === '1';
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
    const activeSourceTitles = await getActiveSourceTitlesForContext(campaignId, roomId);

    if (activeSourceTitles === null) {
      return notFound(reply, 'Кампания или комната для фильтра импортированного контента не найдена.');
    }

    const content = await prisma.importedContent.findMany({
      where: {
        category,
        ...(includeFutureEdition ? {} : { NOT: { editionCompatibility: '5e_2024' } }),
      },
      include: { sourceBook: true },
      orderBy: [{ russianName: 'asc' }, { englishName: 'asc' }],
      take: limit,
    });

    return content
      .filter((entry) => showInactive || !activeSourceTitles || (entry.sourceTitle ? activeSourceTitles.has(entry.sourceTitle) : false))
      .map(serializeImportedContent);
  });

  server.get('/api/save-snapshots', async (request) => {
    const query = request.query as { campaignId?: string; limit?: string };
    const campaignId = text(query.campaignId);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 30);

    return prisma.saveSnapshot.findMany({
      where: campaignId ? { campaignId } : undefined,
      include: { user: true, campaign: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  });

  server.get('/api/action-log', async (request) => {
    const query = request.query as { campaignId?: string; limit?: string };
    const campaignId = text(query.campaignId);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 60);

    return prisma.saveSnapshot.findMany({
      where: campaignId ? { campaignId } : undefined,
      include: { user: true, campaign: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  });

  server.post<{ Params: { id: string }; Body: UndoActionBody }>('/api/action-log/:id/undo', async (request, reply) => {
    const body = asBody<UndoActionBody>(request.body);
    const masterUserId = text(body.masterUserId);

    if (!masterUserId) {
      return badRequest(reply, 'Укажите мастера, который отменяет действие.');
    }

    const action = await prisma.saveSnapshot.findUnique({
      where: { id: request.params.id },
      include: { campaign: true, user: true },
    });

    if (!action || !action.campaignId) {
      return notFound(reply, 'Действие не найдено.');
    }

    if (!(await isCampaignMaster(action.campaignId, masterUserId))) {
      return forbidden(reply, 'Отменять действия может только мастер кампании.');
    }

    const payload = parseActionPayload(action.payloadJson);
    if (isRevertedAction(payload)) {
      return badRequest(reply, 'Это действие уже отменено.');
    }

    const actionType = text(payload.actionType);
    const undo = isRecord(payload.undo) ? payload.undo : null;

    if (!undo || !['spell-cast', 'item-transfer'].includes(actionType ?? '')) {
      return badRequest(reply, 'Для этого действия нет доступного отката.');
    }

    if (actionType === 'spell-cast') {
      const stateId = text(undo.stateId);
      const beforeSheetJson = typeof undo.beforeSheetJson === 'string' ? undo.beforeSheetJson : null;

      if (!stateId || beforeSheetJson === null) {
        return badRequest(reply, 'Данные отката заклинания повреждены.');
      }

      const updatedState = await prisma.campaignCharacterState.update({
        where: { id: stateId },
        data: { sheetJson: beforeSheetJson },
        include: { character: true },
      });

      const updatedAction = await prisma.saveSnapshot.update({
        where: { id: action.id },
        data: {
          payloadJson: JSON.stringify({
            ...payload,
            reverted: true,
            revertedAt: new Date().toISOString(),
            revertedBy: masterUserId,
          }),
        },
        include: { user: true, campaign: true },
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'campaign-character',
          scopeId: stateId,
          summary: `Отменено действие: ${action.summary}`,
          userId: masterUserId,
          campaignId: action.campaignId,
          payloadJson: JSON.stringify({
            actionType: 'undo',
            revertedSnapshotId: action.id,
            at: new Date().toISOString(),
          }),
        },
      });

      await broadcastCampaignRefresh(action.campaignId, masterUserId, updatedState.characterId);

      return { reverted: true, action: updatedAction, state: updatedState };
    }

    const sourceStateId = text(undo.sourceStateId);
    const targetStateId = text(undo.targetStateId);
    const sourceInventoryJson = typeof undo.sourceInventoryJson === 'string' ? undo.sourceInventoryJson : null;
    const targetInventoryJson = typeof undo.targetInventoryJson === 'string' ? undo.targetInventoryJson : null;

    if (!sourceStateId || !targetStateId || sourceInventoryJson === null || targetInventoryJson === null) {
      return badRequest(reply, 'Данные отката передачи повреждены.');
    }

    const [sourceState, targetState, updatedAction] = await prisma.$transaction([
      prisma.campaignCharacterState.update({
        where: { id: sourceStateId },
        data: { inventoryJson: sourceInventoryJson },
        include: { character: true },
      }),
      prisma.campaignCharacterState.update({
        where: { id: targetStateId },
        data: { inventoryJson: targetInventoryJson },
        include: { character: true },
      }),
      prisma.saveSnapshot.update({
        where: { id: action.id },
        data: {
          payloadJson: JSON.stringify({
            ...payload,
            reverted: true,
            revertedAt: new Date().toISOString(),
            revertedBy: masterUserId,
          }),
        },
        include: { user: true, campaign: true },
      }),
      prisma.saveSnapshot.create({
        data: {
          scope: 'campaign-character',
          scopeId: sourceStateId,
          summary: `Отменено действие: ${action.summary}`,
          userId: masterUserId,
          campaignId: action.campaignId,
          payloadJson: JSON.stringify({
            actionType: 'undo',
            revertedSnapshotId: action.id,
            at: new Date().toISOString(),
          }),
        },
      }),
    ]);

    await broadcastCampaignRefresh(action.campaignId, masterUserId, sourceState.characterId);

    return { reverted: true, action: updatedAction, sourceState, targetState };
  });

  server.post<{ Params: { campaignId: string }; Body: CampaignRestBody }>(
    '/api/campaigns/:campaignId/rest',
    async (request, reply) => {
      const body = asBody<CampaignRestBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const restType = text(body.type);

      if (!masterUserId) {
        return badRequest(reply, 'Укажите мастера, который проводит отдых.');
      }

      if (restType !== 'short' && restType !== 'long') {
        return badRequest(reply, 'Выберите короткий или длинный отдых.');
      }

      const campaign = await prisma.campaign.findUnique({
        where: { id: request.params.campaignId },
        include: {
          characterStates: {
            include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
            orderBy: { updatedAt: 'asc' },
          },
        },
      });

      if (!campaign) {
        return notFound(reply, 'Кампания не найдена.');
      }

      if (!(await isCampaignMaster(campaign.id, masterUserId))) {
        return forbidden(reply, 'Отдых кампании может провести только мастер.');
      }

      const activeEncounters = await prisma.turnEncounter.findMany({
        where: { campaignId: campaign.id, status: 'active' },
        select: { id: true },
      });

      if (activeEncounters.length > 0 && body.allowUnsafeRest !== true) {
        return reply.code(409).send({
          message:
            'В кампании активна походовая сцена. Если отдых действительно возможен, подтвердите его мастером отдельной кнопкой.',
          code: 'active_turn_encounter',
        });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const hitDiceUses = normalizeRestHitDiceUses(body.hitDice);
      const summaries: string[] = [];

      const result = await prisma.$transaction(async (tx) => {
        const updatedStates = [];

        for (const state of campaign.characterStates) {
          const sheet = parseJsonObject(state.sheetJson);
          const spellcasting = restoreSpellcastingForRest(sanitizeSpellcasting(sheet.spellcasting), restType);
          const rest = getRestStateFromSheetJson(state.sheetJson, state.level);
          const before = {
            currentHp: state.currentHp,
            maxHp: state.maxHp,
            hitDiceCurrent: rest.hitDiceCurrent,
            spellSlots: Object.fromEntries(Object.entries(spellcasting.slots).map(([level, slot]) => [level, slot.current])),
            resourceCurrent: spellcasting.resources.current,
          };

          let currentHp = state.currentHp;
          let hitDiceSpent = 0;
          let healing = 0;

          if (restType === 'short') {
            const use = hitDiceUses.get(state.characterId);
            hitDiceSpent = Math.min(use?.hitDice ?? 0, rest.hitDiceCurrent);
            healing = hitDiceSpent > 0 ? (use?.heal ?? hitDiceSpent * getAverageHitDieHealing(rest.hitDieSize)) : 0;
            currentHp = Math.min(state.maxHp, state.currentHp + healing);
            rest.hitDiceCurrent -= hitDiceSpent;
          } else {
            currentHp = state.maxHp;
            rest.hitDiceCurrent = Math.min(rest.hitDiceMax, rest.hitDiceCurrent + Math.max(1, Math.floor(rest.hitDiceMax / 2)));
          }

          rest.lastRestType = restType;
          rest.lastRestAt = nowIso;

          const updatedState = await tx.campaignCharacterState.update({
            where: { id: state.id },
            data: {
              currentHp,
              maxHp: state.maxHp,
              sheetJson: JSON.stringify({
                ...sheet,
                spellcasting,
                rest,
              }),
            },
            include: {
              campaign: true,
              character: { include: { owner: true, sheetState: true } },
            },
          });

          updatedStates.push(updatedState);
          summaries.push(
            `${state.character.name}: HP ${before.currentHp}/${state.maxHp} -> ${currentHp}/${state.maxHp}, кости хитов ${before.hitDiceCurrent}/${rest.hitDiceMax} -> ${rest.hitDiceCurrent}/${rest.hitDiceMax}${
              restType === 'short' ? `, потрачено ${hitDiceSpent}, лечение ${healing}` : ''
            }.`,
          );
        }

        const expiredEffects =
          activeEncounters.length > 0
            ? await tx.turnEffect.updateMany({
                where: {
                  encounterId: { in: activeEncounters.map((encounter) => encounter.id) },
                  isActive: true,
                },
                data: {
                  isActive: false,
                  remainingRounds: 0,
                },
              })
            : { count: 0 };

        const snapshot = await tx.saveSnapshot.create({
          data: {
            scope: 'campaign',
            scopeId: campaign.id,
            summary:
              restType === 'short'
                ? `Короткий отдых: обновлены HP, кости хитов и ресурсы (${campaign.characterStates.length} персонаж.).`
                : `Длинный отдых: восстановлены HP, слоты, ресурсы и часть костей хитов (${campaign.characterStates.length} персонаж.).`,
            userId: masterUserId,
            campaignId: campaign.id,
            payloadJson: JSON.stringify({
              actionType: 'rest',
              restType,
              notes: text(body.notes) ?? null,
              allowUnsafeRest: body.allowUnsafeRest === true,
              expiredEffects: expiredEffects.count,
              characters: summaries,
              at: nowIso,
            }),
          },
        });

        return { updatedStates, expiredEffects: expiredEffects.count, snapshot };
      });

      await broadcastCampaignRefresh(campaign.id, masterUserId);

      for (const encounter of activeEncounters) {
        const fullEncounter = await getFullTurnEncounter(encounter.id);
        if (fullEncounter) {
          broadcastTurnEncounter(fullEncounter, masterUserId, {
            restType,
            expiredEffects: result.expiredEffects,
          });
        }
      }

      return {
        type: restType,
        states: result.updatedStates,
        expiredEffects: result.expiredEffects,
        snapshot: result.snapshot,
      };
    },
  );

  server.get<{ Params: { campaignId: string } }>('/api/campaigns/:campaignId/merchants', async (request, reply) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    return prisma.merchant.findMany({
      where: { campaignId: campaign.id },
      include: merchantInclude(),
      orderBy: { updatedAt: 'desc' },
    });
  });

  server.post<{ Params: { campaignId: string }; Body: CreateMerchantBody }>(
    '/api/campaigns/:campaignId/merchants',
    async (request, reply) => {
      const body = asBody<CreateMerchantBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const name = text(body.name) ?? 'Торговец';

      if (!masterUserId) {
        return badRequest(reply, 'Укажите мастера, который создает торговца.');
      }

      const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
      if (!campaign) {
        return notFound(reply, 'Кампания не найдена.');
      }

      if (!(await isCampaignMaster(campaign.id, masterUserId))) {
        return forbidden(reply, 'Торговца может создать только мастер.');
      }

      const inventory = sanitizeInventory(
        body.inventory ?? {
          gp: 100,
          items: [],
        },
      );

      const merchant = await prisma.merchant.create({
        data: {
          campaignId: campaign.id,
          name: name.slice(0, 80),
          description: text(body.description)?.slice(0, 240) ?? null,
          inventoryJson: JSON.stringify(inventory),
          priceMultiplier: clampNumber(body.priceMultiplier, 1, 0.1, 10),
        },
        include: merchantInclude(),
      });

      await createAutosave('merchant', merchant.id, `Торговец "${merchant.name}" создан.`, masterUserId, campaign.id);
      await broadcastCampaignRefresh(campaign.id, masterUserId);

      return merchant;
    },
  );

  server.patch<{ Params: { merchantId: string }; Body: UpdateMerchantBody }>(
    '/api/merchants/:merchantId',
    async (request, reply) => {
      const body = asBody<UpdateMerchantBody>(request.body);
      const masterUserId = text(body.masterUserId);

      if (!masterUserId) {
        return badRequest(reply, 'Укажите мастера, который меняет торговца.');
      }

      const merchant = await prisma.merchant.findUnique({
        where: { id: request.params.merchantId },
        include: { campaign: true },
      });

      if (!merchant) {
        return notFound(reply, 'Торговец не найден.');
      }

      if (!(await isCampaignMaster(merchant.campaignId, masterUserId))) {
        return forbidden(reply, 'Торговца может менять только мастер.');
      }

      const activeBuyerStateId = body.activeBuyerStateId === null ? null : text(body.activeBuyerStateId);
      if (activeBuyerStateId) {
        const buyerState = await prisma.campaignCharacterState.findUnique({ where: { id: activeBuyerStateId } });
        if (!buyerState || buyerState.campaignId !== merchant.campaignId) {
          return badRequest(reply, 'Активный покупатель должен быть персонажем этой кампании.');
        }
      }

      const updatedMerchant = await prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          name: text(body.name)?.slice(0, 80) ?? merchant.name,
          description: body.description === undefined ? merchant.description : (text(body.description)?.slice(0, 240) ?? null),
          status: text(body.status)?.slice(0, 32) ?? merchant.status,
          activeBuyerStateId: body.activeBuyerStateId === undefined ? merchant.activeBuyerStateId : activeBuyerStateId,
          priceMultiplier:
            body.priceMultiplier === undefined ? merchant.priceMultiplier : clampNumber(body.priceMultiplier, 1, 0.1, 10),
        },
        include: merchantInclude(),
      });

      await broadcastCampaignRefresh(merchant.campaignId, masterUserId);
      return updatedMerchant;
    },
  );

  server.post<{ Params: { merchantId: string }; Body: MerchantItemBody }>(
    '/api/merchants/:merchantId/items',
    async (request, reply) => {
      const body = asBody<MerchantItemBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const item = sanitizeInventoryItem(body.item);

      if (!masterUserId || !item) {
        return badRequest(reply, 'Укажите мастера и предмет для торговца.');
      }

      const merchant = await prisma.merchant.findUnique({ where: { id: request.params.merchantId } });
      if (!merchant) {
        return notFound(reply, 'Торговец не найден.');
      }

      if (!(await isCampaignMaster(merchant.campaignId, masterUserId))) {
        return forbidden(reply, 'Запас торговца может менять только мастер.');
      }

      const inventory = parseInventory(merchant.inventoryJson);
      addInventoryItemStack(inventory, item);

      const updatedMerchant = await prisma.merchant.update({
        where: { id: merchant.id },
        data: { inventoryJson: JSON.stringify(sanitizeInventory(inventory)) },
        include: merchantInclude(),
      });

      await createAutosave('merchant', merchant.id, `Торговец "${merchant.name}" получил предмет: ${text(item.name) ?? 'предмет'}.`, masterUserId, merchant.campaignId);
      await broadcastCampaignRefresh(merchant.campaignId, masterUserId);

      return updatedMerchant;
    },
  );

  server.post<{ Params: { merchantId: string }; Body: MerchantTradeBody }>(
    '/api/merchants/:merchantId/buy',
    async (request, reply) => {
      const body = asBody<MerchantTradeBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const itemId = text(body.itemId);
      const quantity = integerOr(body.quantity, 1, 1, 9999);

      if (!masterUserId || !itemId) {
        return badRequest(reply, 'Укажите мастера и предмет для покупки.');
      }

      const merchant = await prisma.merchant.findUnique({ where: { id: request.params.merchantId } });
      if (!merchant) {
        return notFound(reply, 'Торговец не найден.');
      }

      if (!(await isCampaignMaster(merchant.campaignId, masterUserId))) {
        return forbidden(reply, 'Покупку подтверждает мастер.');
      }

      const characterStateId = text(body.characterStateId) ?? merchant.activeBuyerStateId;
      if (!characterStateId) {
        return badRequest(reply, 'Выберите активного покупателя.');
      }

      const buyerState = await prisma.campaignCharacterState.findUnique({
        where: { id: characterStateId },
        include: { character: true },
      });

      if (!buyerState || buyerState.campaignId !== merchant.campaignId) {
        return badRequest(reply, 'Покупатель должен быть персонажем этой кампании.');
      }

      const merchantInventory = parseInventory(merchant.inventoryJson);
      const buyerInventory = parseInventory(buyerState.inventoryJson);
      const movedItem = removeInventoryItemStack(merchantInventory, itemId, quantity);

      if (!movedItem) {
        return notFound(reply, 'Предмет у торговца не найден.');
      }

      const price = getInventoryItemPrice(movedItem, integerOr(movedItem.quantity, quantity, 1, 9999), merchant.priceMultiplier);
      if (buyerInventory.gp < price) {
        return badRequest(reply, `У покупателя не хватает золота: нужно ${price}, есть ${buyerInventory.gp}.`);
      }

      buyerInventory.gp -= price;
      merchantInventory.gp += price;
      addInventoryItemStack(buyerInventory, movedItem);

      const [updatedMerchant, updatedState] = await prisma.$transaction([
        prisma.merchant.update({
          where: { id: merchant.id },
          data: { inventoryJson: JSON.stringify(sanitizeInventory(merchantInventory)) },
          include: merchantInclude(),
        }),
        prisma.campaignCharacterState.update({
          where: { id: buyerState.id },
          data: { inventoryJson: JSON.stringify(sanitizeInventory(buyerInventory)) },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
        prisma.saveSnapshot.create({
          data: {
            scope: 'merchant',
            scopeId: merchant.id,
            summary: `${buyerState.character.name} купил у "${merchant.name}": ${text(movedItem.name) ?? 'предмет'} за ${price} золота.`,
            userId: masterUserId,
            campaignId: merchant.campaignId,
            payloadJson: JSON.stringify({
              actionType: 'trade-buy',
              merchantId: merchant.id,
              characterStateId: buyerState.id,
              itemName: text(movedItem.name) ?? 'предмет',
              quantity: movedItem.quantity,
              price,
              at: new Date().toISOString(),
            }),
          },
        }),
      ]);

      await broadcastCampaignRefresh(merchant.campaignId, masterUserId, buyerState.characterId);
      return { merchant: updatedMerchant, state: updatedState, item: movedItem, price };
    },
  );

  server.post<{ Params: { merchantId: string }; Body: MerchantTradeBody }>(
    '/api/merchants/:merchantId/sell',
    async (request, reply) => {
      const body = asBody<MerchantTradeBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const itemId = text(body.itemId);
      const quantity = integerOr(body.quantity, 1, 1, 9999);

      if (!masterUserId || !itemId) {
        return badRequest(reply, 'Укажите мастера и предмет для продажи.');
      }

      const merchant = await prisma.merchant.findUnique({ where: { id: request.params.merchantId } });
      if (!merchant) {
        return notFound(reply, 'Торговец не найден.');
      }

      if (!(await isCampaignMaster(merchant.campaignId, masterUserId))) {
        return forbidden(reply, 'Продажу подтверждает мастер.');
      }

      const characterStateId = text(body.characterStateId) ?? merchant.activeBuyerStateId;
      if (!characterStateId) {
        return badRequest(reply, 'Выберите активного продавца.');
      }

      const sellerState = await prisma.campaignCharacterState.findUnique({
        where: { id: characterStateId },
        include: { character: true },
      });

      if (!sellerState || sellerState.campaignId !== merchant.campaignId) {
        return badRequest(reply, 'Продавец должен быть персонажем этой кампании.');
      }

      const merchantInventory = parseInventory(merchant.inventoryJson);
      const sellerInventory = parseInventory(sellerState.inventoryJson);
      const movedItem = removeInventoryItemStack(sellerInventory, itemId, quantity);

      if (!movedItem) {
        return notFound(reply, 'Предмет у персонажа не найден.');
      }

      const price = Math.max(1, Math.floor(getInventoryItemPrice(movedItem, integerOr(movedItem.quantity, quantity, 1, 9999), 0.5)));
      if (merchantInventory.gp < price) {
        return badRequest(reply, 'У торговца не хватает золота для покупки. Деньги торговца видит только мастер.');
      }

      sellerInventory.gp += price;
      merchantInventory.gp -= price;
      addInventoryItemStack(merchantInventory, movedItem);

      const [updatedMerchant, updatedState] = await prisma.$transaction([
        prisma.merchant.update({
          where: { id: merchant.id },
          data: { inventoryJson: JSON.stringify(sanitizeInventory(merchantInventory)) },
          include: merchantInclude(),
        }),
        prisma.campaignCharacterState.update({
          where: { id: sellerState.id },
          data: { inventoryJson: JSON.stringify(sanitizeInventory(sellerInventory)) },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
        prisma.saveSnapshot.create({
          data: {
            scope: 'merchant',
            scopeId: merchant.id,
            summary: `${sellerState.character.name} продал торговцу "${merchant.name}": ${text(movedItem.name) ?? 'предмет'} за ${price} золота.`,
            userId: masterUserId,
            campaignId: merchant.campaignId,
            payloadJson: JSON.stringify({
              actionType: 'trade-sell',
              merchantId: merchant.id,
              characterStateId: sellerState.id,
              itemName: text(movedItem.name) ?? 'предмет',
              quantity: movedItem.quantity,
              price,
              at: new Date().toISOString(),
            }),
          },
        }),
      ]);

      await broadcastCampaignRefresh(merchant.campaignId, masterUserId, sellerState.characterId);
      return { merchant: updatedMerchant, state: updatedState, item: movedItem, price };
    },
  );

  server.post<{ Params: { merchantId: string }; Body: TheftRequestBody }>(
    '/api/merchants/:merchantId/theft-requests',
    async (request, reply) => {
      const body = asBody<TheftRequestBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);
      const characterStateId = text(body.characterStateId);
      const itemId = text(body.itemId);

      if (!actorUserId || !characterStateId || !itemId) {
        return badRequest(reply, 'Укажите игрока, персонажа и предмет для кражи.');
      }

      const [merchant, characterState] = await Promise.all([
        prisma.merchant.findUnique({ where: { id: request.params.merchantId } }),
        prisma.campaignCharacterState.findUnique({ where: { id: characterStateId }, include: { character: true } }),
      ]);

      if (!merchant || !characterState || characterState.campaignId !== merchant.campaignId) {
        return notFound(reply, 'Торговец или персонаж не найден в этой кампании.');
      }

      const canRequest = characterState.character.ownerId === actorUserId || (await isCampaignMaster(merchant.campaignId, actorUserId));
      if (!canRequest) {
        return forbidden(reply, 'Запрос на кражу может создать владелец персонажа или мастер.');
      }

      const item = parseInventory(merchant.inventoryJson).items.find((current) => text(current.id) === itemId);
      if (!item) {
        return notFound(reply, 'Предмет у торговца не найден.');
      }

      const theftRequest = await prisma.theftRequest.create({
        data: {
          campaignId: merchant.campaignId,
          merchantId: merchant.id,
          characterStateId: characterState.id,
          requesterUserId: actorUserId,
          itemId,
          itemName: text(item.name) ?? 'предмет',
          dc: integerOr(body.dc, 12, 1, 40),
          notes: text(body.notes)?.slice(0, 280) ?? null,
        },
      });

      await createAutosave(
        'theft-request',
        theftRequest.id,
        `${characterState.character.name} запросил кражу у "${merchant.name}": ${theftRequest.itemName}.`,
        actorUserId,
        merchant.campaignId,
      );
      await broadcastCampaignRefresh(merchant.campaignId, actorUserId, characterState.characterId);

      return theftRequest;
    },
  );

  server.post<{ Params: { merchantId: string; requestId: string }; Body: ResolveTheftRequestBody }>(
    '/api/merchants/:merchantId/theft-requests/:requestId/resolve',
    async (request, reply) => {
      const body = asBody<ResolveTheftRequestBody>(request.body);
      const masterUserId = text(body.masterUserId);

      if (!masterUserId) {
        return badRequest(reply, 'Укажите мастера, который решает кражу.');
      }

      const theftRequest = await prisma.theftRequest.findUnique({
        where: { id: request.params.requestId },
        include: { merchant: true },
      });

      if (!theftRequest || theftRequest.merchantId !== request.params.merchantId) {
        return notFound(reply, 'Запрос на кражу не найден.');
      }

      if (!(await isCampaignMaster(theftRequest.campaignId, masterUserId))) {
        return forbidden(reply, 'Кражу решает только мастер.');
      }

      if (theftRequest.status !== 'pending') {
        return badRequest(reply, 'Этот запрос на кражу уже решен.');
      }

      const characterState = await prisma.campaignCharacterState.findUnique({
        where: { id: theftRequest.characterStateId },
        include: { character: true },
      });

      if (!characterState || characterState.campaignId !== theftRequest.campaignId) {
        return notFound(reply, 'Персонаж для кражи не найден.');
      }

      let movedItem: InventoryItemInput | null = null;
      let updatedMerchant: unknown = null;
      let updatedState: unknown = null;

      if (body.approved === true) {
        const merchantInventory = parseInventory(theftRequest.merchant.inventoryJson);
        const characterInventory = parseInventory(characterState.inventoryJson);
        const itemId = theftRequest.itemId;

        if (!itemId) {
          return badRequest(reply, 'В запросе на кражу нет предмета.');
        }

        movedItem = removeInventoryItemStack(merchantInventory, itemId, 1);
        if (!movedItem) {
          return notFound(reply, 'Предмет для кражи уже отсутствует у торговца.');
        }

        addInventoryItemStack(characterInventory, movedItem);

        [updatedMerchant, updatedState] = await prisma.$transaction([
          prisma.merchant.update({
            where: { id: theftRequest.merchantId },
            data: { inventoryJson: JSON.stringify(sanitizeInventory(merchantInventory)) },
            include: merchantInclude(),
          }),
          prisma.campaignCharacterState.update({
            where: { id: characterState.id },
            data: { inventoryJson: JSON.stringify(sanitizeInventory(characterInventory)) },
            include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
          }),
        ]);
      }

      const resolved = await prisma.theftRequest.update({
        where: { id: theftRequest.id },
        data: {
          status: body.approved === true ? 'approved' : 'rejected',
          roll: body.roll === undefined ? null : integerOr(body.roll, 0, 0, 40),
          resolution: text(body.notes)?.slice(0, 280) ?? null,
          resolvedByUserId: masterUserId,
          resolvedAt: new Date(),
        },
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'theft-request',
          scopeId: theftRequest.id,
          summary:
            body.approved === true
              ? `${characterState.character.name} украл у "${theftRequest.merchant.name}": ${theftRequest.itemName}.`
              : `Кража отклонена: ${characterState.character.name} у "${theftRequest.merchant.name}".`,
          userId: masterUserId,
          campaignId: theftRequest.campaignId,
          payloadJson: JSON.stringify({
            actionType: 'theft-resolve',
            merchantId: theftRequest.merchantId,
            characterStateId: characterState.id,
            requestId: theftRequest.id,
            approved: body.approved === true,
            itemName: theftRequest.itemName,
            at: new Date().toISOString(),
          }),
        },
      });

      await broadcastCampaignRefresh(theftRequest.campaignId, masterUserId, characterState.characterId);

      return {
        request: resolved,
        merchant: updatedMerchant,
        state: updatedState,
        item: movedItem,
      };
    },
  );

  server.get<{ Params: { campaignId: string } }>('/api/campaigns/:campaignId/homebrew', async (request, reply) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    return prisma.homebrewContent.findMany({
      where: { campaignLinks: { some: { campaignId: campaign.id } } },
      include: { campaignLinks: { include: { campaign: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  });

  server.post<{ Body: CreateHomebrewBody }>('/api/homebrew', async (request, reply) => {
    const body = asBody<CreateHomebrewBody>(request.body);
    const masterUserId = text(body.masterUserId);
    const name = text(body.name);

    if (!masterUserId || !name) {
      return badRequest(reply, 'Укажите мастера и название хоумбрю.');
    }

    if (!(await isMasterUser(masterUserId))) {
      return forbidden(reply, 'Глобальную библиотеку хоумбрю может менять только мастер.');
    }

    const homebrew = await prisma.homebrewContent.create({
      data: {
        ownerId: masterUserId,
        name: name.slice(0, 80),
        kind: normalizeHomebrewKind(body.kind),
        status: text(body.status)?.slice(0, 32) ?? 'draft',
        payloadJson: JSON.stringify(incomingJsonObject(body.payload)),
        notes: text(body.notes)?.slice(0, 280) ?? null,
      },
      include: { campaignLinks: { include: { campaign: true } } },
    });

    await createAutosave('homebrew', homebrew.id, `Хоумбрю "${homebrew.name}" создано в библиотеке мастера.`, masterUserId);
    return reply.code(201).send(homebrew);
  });

  server.post<{ Body: BulkHomebrewCampaignBody }>('/api/homebrew/campaign-links', async (request, reply) => {
    const body = asBody<BulkHomebrewCampaignBody>(request.body);
    const masterUserId = text(body.masterUserId);
    const action = text(body.action) === 'unlink' ? 'unlink' : 'link';
    const homebrewIds = Array.isArray(body.homebrewIds)
      ? Array.from(new Set(body.homebrewIds.map(text).filter((value): value is string => Boolean(value)))).slice(0, 250)
      : [];
    const campaignIds = Array.isArray(body.campaignIds)
      ? Array.from(new Set(body.campaignIds.map(text).filter((value): value is string => Boolean(value)))).slice(0, 100)
      : [];

    if (!masterUserId || homebrewIds.length === 0 || campaignIds.length === 0) {
      return badRequest(reply, 'Выберите хотя бы один материал и одну кампанию.');
    }

    const [homebrewContents, campaigns] = await Promise.all([
      prisma.homebrewContent.findMany({ where: { id: { in: homebrewIds } } }),
      prisma.campaign.findMany({ where: { id: { in: campaignIds } } }),
    ]);

    if (homebrewContents.length !== homebrewIds.length || campaigns.length !== campaignIds.length) {
      return notFound(reply, 'Один из материалов или одна из кампаний не найдены.');
    }

    if (!(await Promise.all(homebrewContents.map((content) => canManageHomebrew(content, masterUserId)))).every(Boolean)) {
      return forbidden(reply, 'В выбранных материалах есть недоступное мастеру хоумбрю.');
    }

    if (!(await Promise.all(campaigns.map((campaign) => isCampaignMaster(campaign.id, masterUserId)))).every(Boolean)) {
      return forbidden(reply, 'В выбранных кампаниях нет прав мастера.');
    }

    if (action === 'unlink') {
      await prisma.campaignHomebrewContent.deleteMany({
        where: {
          homebrewContentId: { in: homebrewIds },
          campaignId: { in: campaignIds },
        },
      });
    } else {
      await prisma.$transaction(
        campaignIds.flatMap((campaignId) =>
          homebrewIds.map((homebrewContentId) =>
            prisma.campaignHomebrewContent.upsert({
              where: { campaignId_homebrewContentId: { campaignId, homebrewContentId } },
              update: {},
              create: { campaignId, homebrewContentId },
            }),
          ),
        ),
      );
    }

    await Promise.all(campaignIds.map((campaignId) => broadcastCampaignRefresh(campaignId, masterUserId)));
    return {
      action,
      homebrewIds,
      campaignIds,
      changedPairs: homebrewIds.length * campaignIds.length,
    };
  });

  server.post<{ Params: { campaignId: string }; Body: CreateHomebrewBody }>(
    '/api/campaigns/:campaignId/homebrew',
    async (request, reply) => {
      const body = asBody<CreateHomebrewBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const name = text(body.name);

      if (!masterUserId || !name) {
        return badRequest(reply, 'Укажите мастера и название хоумбрю.');
      }

      const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
      if (!campaign) {
        return notFound(reply, 'Кампания не найдена.');
      }

      if (!(await isCampaignMaster(campaign.id, masterUserId))) {
        return forbidden(reply, 'Хоумбрю кампании может создавать только мастер.');
      }

      const kind = normalizeHomebrewKind(body.kind);
      const homebrew = await prisma.homebrewContent.create({
        data: {
          ownerId: masterUserId,
          name: name.slice(0, 80),
          kind,
          status: text(body.status)?.slice(0, 32) ?? 'draft',
          payloadJson: JSON.stringify(incomingJsonObject(body.payload)),
          notes: text(body.notes)?.slice(0, 280) ?? null,
          campaignLinks: { create: { campaignId: campaign.id } },
        },
        include: { campaignLinks: { include: { campaign: true } } },
      });

      await createAutosave('homebrew', homebrew.id, `Хоумбрю "${homebrew.name}" создано.`, masterUserId, campaign.id);
      await broadcastCampaignRefresh(campaign.id, masterUserId);

      return homebrew;
    },
  );

  server.patch<{ Params: { homebrewId: string }; Body: CreateHomebrewBody }>(
    '/api/homebrew/:homebrewId',
    async (request, reply) => {
      const body = asBody<CreateHomebrewBody>(request.body);
      const masterUserId = text(body.masterUserId);

      if (!masterUserId) {
        return badRequest(reply, 'Укажите мастера, который меняет хоумбрю.');
      }

      const homebrew = await prisma.homebrewContent.findUnique({
        where: { id: request.params.homebrewId },
        include: { campaignLinks: true },
      });
      if (!homebrew) {
        return notFound(reply, 'Хоумбрю не найдено.');
      }

      if (!(await canManageHomebrew(homebrew, masterUserId))) {
        return forbidden(reply, 'Это хоумбрю недоступно выбранному мастеру.');
      }

      const updated = await prisma.homebrewContent.update({
        where: { id: homebrew.id },
        data: {
          name: text(body.name)?.slice(0, 80) ?? homebrew.name,
          kind: body.kind === undefined ? homebrew.kind : normalizeHomebrewKind(body.kind),
          status: text(body.status)?.slice(0, 32) ?? homebrew.status,
          payloadJson: body.payload === undefined ? homebrew.payloadJson : JSON.stringify(incomingJsonObject(body.payload)),
          notes: body.notes === undefined ? homebrew.notes : (text(body.notes)?.slice(0, 280) ?? null),
        },
        include: { campaignLinks: { include: { campaign: true } } },
      });

      await Promise.all(homebrew.campaignLinks.map((link) => broadcastCampaignRefresh(link.campaignId, masterUserId)));
      return updated;
    },
  );

  server.post<{ Params: { homebrewId: string }; Body: GrantHomebrewBody }>(
    '/api/homebrew/:homebrewId/grant',
    async (request, reply) => {
      const body = asBody<GrantHomebrewBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const characterStateId = text(body.characterStateId);

      if (!masterUserId || !characterStateId) {
        return badRequest(reply, 'Укажите мастера и персонажа для выдачи хоумбрю.');
      }

      const [homebrew, state] = await Promise.all([
        prisma.homebrewContent.findUnique({
          where: { id: request.params.homebrewId },
          include: { campaignLinks: true },
        }),
        prisma.campaignCharacterState.findUnique({
          where: { id: characterStateId },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
      ]);

      if (!homebrew || !state) {
        return notFound(reply, 'Хоумбрю или персонаж не найдены.');
      }

      if (!homebrew.campaignLinks.some((link) => link.campaignId === state.campaignId)) {
        return forbidden(reply, 'Сначала привяжите это хоумбрю к кампании персонажа.');
      }

      if (!(await isCampaignMaster(state.campaignId, masterUserId))) {
        return forbidden(reply, 'Выдавать хоумбрю может только мастер.');
      }

      const kind = normalizeHomebrewKind(homebrew.kind);
      const mode = text(body.mode) === 'temporary' ? 'temporary' : 'permanent';
      const payload = parseHomebrewPayload(homebrew.payloadJson);
      let updatedState = state;
      let turnEffect = null;

      if (kind === 'item' || kind === 'weapon') {
        const item = createHomebrewInventoryItem(homebrew);
        if (!item) {
          return badRequest(reply, 'Хоумбрю-предмет поврежден.');
        }

        const inventory = parseInventory(state.inventoryJson);
        addInventoryItemStack(inventory, {
          ...item,
          notes: `${text(item.notes) ?? ''} ${mode === 'temporary' ? 'temporary' : 'permanent'}`.trim(),
        });

        updatedState = await prisma.campaignCharacterState.update({
          where: { id: state.id },
          data: { inventoryJson: JSON.stringify(sanitizeInventory(inventory)) },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        });
      } else if (kind === 'spell') {
        const spell = createHomebrewSpell(homebrew);
        if (!spell) {
          return badRequest(reply, 'Хоумбрю-заклинание повреждено.');
        }

        const sheet = parseJsonObject(state.sheetJson);
        const spellcasting = getSpellcastingFromSheetJson(state.sheetJson);
        spellcasting.spells.push(spell);

        updatedState = await prisma.campaignCharacterState.update({
          where: { id: state.id },
          data: { sheetJson: JSON.stringify({ ...sheet, spellcasting }) },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        });
      } else if (kind === 'effect') {
        const duration = integerOr(body.durationRounds, integerOr(payload.durationRounds, 10, 1, 999), 1, 999);
        const encounter = await prisma.turnEncounter.findFirst({
          where: { campaignId: state.campaignId, status: 'active' },
          include: { participants: true },
          orderBy: { updatedAt: 'desc' },
        });
        const participant = encounter?.participants.find((item) => item.characterStateId === state.id) ?? null;

        if (encounter) {
          turnEffect = await prisma.turnEffect.create({
            data: {
              encounterId: encounter.id,
              participantId: participant?.id ?? null,
              name: homebrew.name,
              durationType: 'rounds',
              remainingRounds: duration,
              timing: 'end_of_turn',
              notes: `${text(payload.notes) ?? ''} homebrew:${homebrew.id} ${mode}`.trim(),
            },
          });

          const fullEncounter = await getFullTurnEncounter(encounter.id);
          if (fullEncounter) {
            broadcastTurnEncounter(fullEncounter, masterUserId, { homebrewId: homebrew.id });
          }
        } else {
          const sheet = parseJsonObject(state.sheetJson);
          const effects = Array.isArray(sheet.homebrewEffects) ? sheet.homebrewEffects : [];
          updatedState = await prisma.campaignCharacterState.update({
            where: { id: state.id },
            data: {
              sheetJson: JSON.stringify({
                ...sheet,
                homebrewEffects: [
                  ...effects,
                  {
                    id: `homebrew-effect-${homebrew.id}-${Date.now()}`,
                    homebrewId: homebrew.id,
                    name: homebrew.name,
                    remainingRounds: duration,
                    mode,
                  },
                ],
              }),
            },
            include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
          });
        }
      } else {
        return badRequest(reply, 'Расы и правила подключаются к кампании, но не выдаются отдельному персонажу.');
      }

      await prisma.saveSnapshot.create({
        data: {
          scope: 'homebrew',
          scopeId: homebrew.id,
          summary: `${state.character.name} получил хоумбрю "${homebrew.name}".`,
          userId: masterUserId,
          campaignId: state.campaignId,
          payloadJson: JSON.stringify({
            actionType: 'homebrew-grant',
            homebrewId: homebrew.id,
            characterStateId: state.id,
            kind,
            mode,
            turnEffectId: turnEffect?.id ?? null,
            at: new Date().toISOString(),
          }),
        },
      });

      await broadcastCampaignRefresh(state.campaignId, masterUserId, state.characterId);
      return { homebrew, state: updatedState, effect: turnEffect };
    },
  );

  server.post<{ Params: { homebrewId: string }; Body: GrantHomebrewBody }>(
    '/api/homebrew/:homebrewId/revoke',
    async (request, reply) => {
      const body = asBody<GrantHomebrewBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const characterStateId = text(body.characterStateId);

      if (!masterUserId || !characterStateId) {
        return badRequest(reply, 'Укажите мастера и персонажа для отзыва хоумбрю.');
      }

      const [homebrew, state] = await Promise.all([
        prisma.homebrewContent.findUnique({
          where: { id: request.params.homebrewId },
          include: { campaignLinks: true },
        }),
        prisma.campaignCharacterState.findUnique({
          where: { id: characterStateId },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
      ]);

      if (!homebrew || !state) {
        return notFound(reply, 'Хоумбрю или персонаж не найдены.');
      }

      if (!homebrew.campaignLinks.some((link) => link.campaignId === state.campaignId)) {
        return forbidden(reply, 'Это хоумбрю не подключено к кампании персонажа.');
      }

      if (!(await isCampaignMaster(state.campaignId, masterUserId))) {
        return forbidden(reply, 'Отзывать хоумбрю может только мастер.');
      }

      const inventory = parseInventory(state.inventoryJson);
      inventory.items = inventory.items.filter((item) => !String(item.notes ?? '').includes(`homebrew:${homebrew.id}`));
      const sheet = parseJsonObject(state.sheetJson);
      const spellcasting = getSpellcastingFromSheetJson(state.sheetJson);
      spellcasting.spells = spellcasting.spells.filter((spell) => !String(spell.notes ?? '').includes(`homebrew:${homebrew.id}`));
      const effects = Array.isArray(sheet.homebrewEffects)
        ? sheet.homebrewEffects.filter((effect) => !isRecord(effect) || effect.homebrewId !== homebrew.id)
        : [];
      const activeEncounterIds = await prisma.turnEncounter.findMany({
        where: { campaignId: state.campaignId, status: 'active' },
        select: { id: true },
      });

      const [updatedState] = await prisma.$transaction([
        prisma.campaignCharacterState.update({
          where: { id: state.id },
          data: {
            inventoryJson: JSON.stringify(sanitizeInventory(inventory)),
            sheetJson: JSON.stringify({ ...sheet, spellcasting, homebrewEffects: effects }),
          },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
        prisma.turnEffect.updateMany({
          where: {
            encounterId: { in: activeEncounterIds.map((encounter) => encounter.id) },
            notes: { contains: `homebrew:${homebrew.id}` },
          },
          data: { isActive: false, remainingRounds: 0 },
        }),
        prisma.saveSnapshot.create({
          data: {
            scope: 'homebrew',
            scopeId: homebrew.id,
            summary: `Хоумбрю "${homebrew.name}" отозвано у ${state.character.name}.`,
            userId: masterUserId,
            campaignId: state.campaignId,
            payloadJson: JSON.stringify({
              actionType: 'homebrew-revoke',
              homebrewId: homebrew.id,
              characterStateId: state.id,
              at: new Date().toISOString(),
            }),
          },
        }),
      ]);

      await broadcastCampaignRefresh(state.campaignId, masterUserId, state.characterId);
      return { homebrew, state: updatedState };
    },
  );

  server.post<{ Params: { homebrewId: string }; Body: HomebrewEffectDurationBody }>(
    '/api/homebrew/:homebrewId/effect-duration',
    async (request, reply) => {
      const body = asBody<HomebrewEffectDurationBody>(request.body);
      const masterUserId = text(body.masterUserId);
      const campaignId = text(body.campaignId);

      if (!masterUserId || !campaignId) {
        return badRequest(reply, 'Укажите мастера и кампанию эффекта.');
      }

      const homebrew = await prisma.homebrewContent.findUnique({
        where: { id: request.params.homebrewId },
        include: { campaignLinks: true },
      });
      if (!homebrew) {
        return notFound(reply, 'Хоумбрю не найдено.');
      }

      if (!homebrew.campaignLinks.some((link) => link.campaignId === campaignId)) {
        return forbidden(reply, 'Это хоумбрю не подключено к выбранной кампании.');
      }

      if (!(await isCampaignMaster(campaignId, masterUserId))) {
        return forbidden(reply, 'Эффект хоумбрю может менять только мастер.');
      }

      const rounds = integerOr(body.rounds, 1, -999, 999);
      const update = body.end === true ? { isActive: false, remainingRounds: 0 } : { remainingRounds: { increment: rounds } };
      const activeEncounterIds = await prisma.turnEncounter.findMany({
        where: { campaignId, status: 'active' },
        select: { id: true },
      });
      const result = await prisma.turnEffect.updateMany({
        where: {
          encounterId: { in: activeEncounterIds.map((encounter) => encounter.id) },
          notes: { contains: `homebrew:${homebrew.id}` },
          isActive: true,
        },
        data: update,
      });

      await createAutosave(
        'homebrew',
        homebrew.id,
        body.end === true ? `Эффект хоумбрю "${homebrew.name}" завершен.` : `Эффект хоумбрю "${homebrew.name}" продлен на ${rounds} раунд.`,
        masterUserId,
        campaignId,
      );
      await broadcastCampaignRefresh(campaignId, masterUserId);

      return { homebrew, updatedEffects: result.count };
    },
  );

  server.get<{ Params: { campaignId: string } }>('/api/campaigns/:campaignId/npcs', async (request, reply) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    return prisma.npcProfile.findMany({
      where: { campaignId: campaign.id },
      include: npcInclude(),
      orderBy: { updatedAt: 'desc' },
    });
  });

  server.post<{ Params: { campaignId: string }; Body: CreateNpcBody }>(
    '/api/campaigns/:campaignId/npcs',
    async (request, reply) => {
      const body = asBody<CreateNpcBody>(request.body);
      const masterUserId = text(body.masterUserId);

      if (!masterUserId) {
        return badRequest(reply, 'Укажите мастера, который создает NPC.');
      }

      const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
      if (!campaign) {
        return notFound(reply, 'Кампания не найдена.');
      }

      if (!(await isCampaignMaster(campaign.id, masterUserId))) {
        return forbidden(reply, 'NPC может создавать только мастер.');
      }

      const random = body.random === true;
      const role = text(body.role) ?? (random ? pickFrom(npcRolePool) : 'NPC');
      const socialClass = text(body.socialClass) ?? (random ? pickFrom(npcSocialClasses) : 'простолюдин');
      const wealthTier = text(body.wealthTier) ?? (random ? pickFrom(npcWealthTiers) : 'скромный');
      const name = text(body.name) ?? (random ? `${pickFrom(npcNamePool)}, ${role}` : 'Новый NPC');
      const stat = createNpcStats(body.stat, role);
      const inventory = createNpcInventoryForTier(wealthTier, body.inventory);

      const npc = await prisma.npcProfile.create({
        data: {
          campaignId: campaign.id,
          name: name.slice(0, 80),
          sourceType: text(body.sourceType) ?? (random ? 'random' : 'manual'),
          role,
          socialClass,
          wealthTier,
          statJson: JSON.stringify(stat),
          inventoryJson: JSON.stringify(inventory),
          notes: text(body.notes)?.slice(0, 280) ?? null,
        },
        include: npcInclude(),
      });

      await createAutosave('npc', npc.id, `NPC "${npc.name}" создан.`, masterUserId, campaign.id);
      await broadcastCampaignRefresh(campaign.id, masterUserId);
      return npc;
    },
  );

  server.patch<{ Params: { npcId: string }; Body: UpdateNpcBody }>('/api/npcs/:npcId', async (request, reply) => {
    const body = asBody<UpdateNpcBody>(request.body);
    const masterUserId = text(body.masterUserId);

    if (!masterUserId) {
      return badRequest(reply, 'Укажите мастера, который меняет NPC.');
    }

    const npc = await prisma.npcProfile.findUnique({ where: { id: request.params.npcId } });
    if (!npc) {
      return notFound(reply, 'NPC не найден.');
    }

    if (!(await isCampaignMaster(npc.campaignId, masterUserId))) {
      return forbidden(reply, 'NPC может менять только мастер.');
    }

    const updateData = {
      name: text(body.name)?.slice(0, 80) ?? npc.name,
      sourceType: text(body.sourceType)?.slice(0, 32) ?? npc.sourceType,
      role: body.role === undefined ? npc.role : (text(body.role)?.slice(0, 60) ?? null),
      socialClass: text(body.socialClass)?.slice(0, 60) ?? npc.socialClass,
      wealthTier: text(body.wealthTier)?.slice(0, 60) ?? npc.wealthTier,
      statJson: body.stat === undefined ? npc.statJson : JSON.stringify(createNpcStats(body.stat, text(body.role) ?? npc.role ?? 'NPC')),
      inventoryJson: body.inventory === undefined ? npc.inventoryJson : JSON.stringify(sanitizeInventory(body.inventory)),
      notes: body.notes === undefined ? npc.notes : (text(body.notes)?.slice(0, 280) ?? null),
      isActive: body.isActive === undefined ? npc.isActive : body.isActive === true,
    };

    const updatedNpc =
      body.isActive === true
        ? await prisma.$transaction(async (tx) => {
            await tx.npcProfile.updateMany({ where: { campaignId: npc.campaignId }, data: { isActive: false } });
            return tx.npcProfile.update({ where: { id: npc.id }, data: updateData, include: npcInclude() });
          })
        : await prisma.npcProfile.update({ where: { id: npc.id }, data: updateData, include: npcInclude() });

    await broadcastCampaignRefresh(npc.campaignId, masterUserId);
    return updatedNpc;
  });

  server.post<{ Params: { npcId: string }; Body: { masterUserId?: string } }>(
    '/api/npcs/:npcId/generate-loot',
    async (request, reply) => {
      const body = asBody<{ masterUserId?: string }>(request.body);
      const masterUserId = text(body.masterUserId);

      if (!masterUserId) {
        return badRequest(reply, 'Укажите мастера, который генерирует лут.');
      }

      const npc = await prisma.npcProfile.findUnique({ where: { id: request.params.npcId } });
      if (!npc) {
        return notFound(reply, 'NPC не найден.');
      }

      if (!(await isCampaignMaster(npc.campaignId, masterUserId))) {
        return forbidden(reply, 'Лут NPC может генерировать только мастер.');
      }

      const inventory = parseInventory(npc.inventoryJson);
      const bonusGold = integerOr(Math.ceil(Math.random() * 12), 6, 1, 12);
      inventory.gp += bonusGold;
      const loot = sanitizeInventoryItem({
        name: pickFrom(['Карта с пометками', 'Перстень', 'Флакон духов', 'Письмо с печатью']),
        kind: 'treasure',
        quantity: 1,
        weight: 0,
        gpValue: bonusGold,
        notes: 'generated npc loot',
      });
      if (loot) {
        addInventoryItemStack(inventory, loot);
      }

      const updatedNpc = await prisma.npcProfile.update({
        where: { id: npc.id },
        data: { inventoryJson: JSON.stringify(sanitizeInventory(inventory)) },
        include: npcInclude(),
      });

      await createAutosave('npc', npc.id, `Лут NPC "${npc.name}" сгенерирован.`, masterUserId, npc.campaignId);
      await broadcastCampaignRefresh(npc.campaignId, masterUserId);
      return updatedNpc;
    },
  );

  server.post<{ Params: { npcId: string }; Body: TheftRequestBody }>(
    '/api/npcs/:npcId/theft-requests',
    async (request, reply) => {
      const body = asBody<TheftRequestBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);
      const characterStateId = text(body.characterStateId);
      const itemId = text(body.itemId);

      if (!actorUserId || !characterStateId || !itemId) {
        return badRequest(reply, 'Укажите игрока, персонажа и предмет для кражи у NPC.');
      }

      const [npc, characterState] = await Promise.all([
        prisma.npcProfile.findUnique({ where: { id: request.params.npcId } }),
        prisma.campaignCharacterState.findUnique({ where: { id: characterStateId }, include: { character: true } }),
      ]);

      if (!npc || !characterState || characterState.campaignId !== npc.campaignId) {
        return notFound(reply, 'NPC или персонаж не найден в этой кампании.');
      }

      const canRequest = characterState.character.ownerId === actorUserId || (await isCampaignMaster(npc.campaignId, actorUserId));
      if (!canRequest) {
        return forbidden(reply, 'Запрос на кражу у NPC может создать владелец персонажа или мастер.');
      }

      const item = parseInventory(npc.inventoryJson).items.find((current) => text(current.id) === itemId);
      if (!item) {
        return notFound(reply, 'Предмет у NPC не найден.');
      }

      const theftRequest = await prisma.npcTheftRequest.create({
        data: {
          campaignId: npc.campaignId,
          npcId: npc.id,
          characterStateId: characterState.id,
          requesterUserId: actorUserId,
          itemId,
          itemName: text(item.name) ?? 'предмет',
          dc: integerOr(body.dc, 12, 1, 40),
          notes: text(body.notes)?.slice(0, 280) ?? null,
        },
      });

      await createAutosave('npc-theft-request', theftRequest.id, `${characterState.character.name} запросил кражу у NPC "${npc.name}".`, actorUserId, npc.campaignId);
      await broadcastCampaignRefresh(npc.campaignId, actorUserId, characterState.characterId);
      return theftRequest;
    },
  );

  server.post<{ Params: { npcId: string; requestId: string }; Body: ResolveTheftRequestBody }>(
    '/api/npcs/:npcId/theft-requests/:requestId/resolve',
    async (request, reply) => {
      const body = asBody<ResolveTheftRequestBody>(request.body);
      const masterUserId = text(body.masterUserId);

      if (!masterUserId) {
        return badRequest(reply, 'Укажите мастера, который решает кражу у NPC.');
      }

      const theftRequest = await prisma.npcTheftRequest.findUnique({
        where: { id: request.params.requestId },
        include: { npc: true },
      });

      if (!theftRequest || theftRequest.npcId !== request.params.npcId) {
        return notFound(reply, 'Запрос на кражу у NPC не найден.');
      }

      if (!(await isCampaignMaster(theftRequest.campaignId, masterUserId))) {
        return forbidden(reply, 'Кражу у NPC решает только мастер.');
      }

      const characterState = await prisma.campaignCharacterState.findUnique({
        where: { id: theftRequest.characterStateId },
        include: { character: true },
      });
      if (!characterState || characterState.campaignId !== theftRequest.campaignId) {
        return notFound(reply, 'Персонаж для кражи не найден.');
      }

      let movedItem: InventoryItemInput | null = null;
      let updatedNpc: unknown = null;
      let updatedState: unknown = null;

      if (body.approved === true) {
        const npcInventory = parseInventory(theftRequest.npc.inventoryJson);
        const characterInventory = parseInventory(characterState.inventoryJson);
        if (!theftRequest.itemId) {
          return badRequest(reply, 'В запросе на кражу нет предмета.');
        }
        movedItem = removeInventoryItemStack(npcInventory, theftRequest.itemId, 1);
        if (!movedItem) {
          return notFound(reply, 'Предмет для кражи уже отсутствует у NPC.');
        }
        addInventoryItemStack(characterInventory, movedItem);

        [updatedNpc, updatedState] = await prisma.$transaction([
          prisma.npcProfile.update({
            where: { id: theftRequest.npcId },
            data: { inventoryJson: JSON.stringify(sanitizeInventory(npcInventory)) },
            include: npcInclude(),
          }),
          prisma.campaignCharacterState.update({
            where: { id: characterState.id },
            data: { inventoryJson: JSON.stringify(sanitizeInventory(characterInventory)) },
            include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
          }),
        ]);
      }

      const resolved = await prisma.npcTheftRequest.update({
        where: { id: theftRequest.id },
        data: {
          status: body.approved === true ? 'approved' : 'rejected',
          roll: body.roll === undefined ? null : integerOr(body.roll, 0, 0, 40),
          resolution: text(body.notes)?.slice(0, 280) ?? null,
          resolvedByUserId: masterUserId,
          resolvedAt: new Date(),
        },
      });

      await createAutosave(
        'npc-theft-request',
        theftRequest.id,
        body.approved === true
          ? `${characterState.character.name} украл у NPC "${theftRequest.npc.name}": ${theftRequest.itemName}.`
          : `Кража у NPC "${theftRequest.npc.name}" отклонена.`,
        masterUserId,
        theftRequest.campaignId,
      );
      await broadcastCampaignRefresh(theftRequest.campaignId, masterUserId, characterState.characterId);

      return { request: resolved, npc: updatedNpc, state: updatedState, item: movedItem };
    },
  );

  server.get<{ Params: { campaignId: string } }>('/api/campaigns/:campaignId/documents', async (request, reply) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    return prisma.noteDocument.findMany({
      where: { campaignId: campaign.id },
      orderBy: { updatedAt: 'desc' },
    });
  });

  server.post<{ Params: { campaignId: string }; Body: CreateNoteDocumentBody }>(
    '/api/campaigns/:campaignId/documents',
    async (request, reply) => {
      const body = asBody<CreateNoteDocumentBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);
      const characterStateId = text(body.characterStateId);
      const title = text(body.title) ?? 'Новая записка';

      if (!actorUserId) {
        return badRequest(reply, 'Укажите пользователя, который создает документ.');
      }

      const campaign = await prisma.campaign.findUnique({ where: { id: request.params.campaignId } });
      if (!campaign) {
        return notFound(reply, 'Кампания не найдена.');
      }

      let ownerState = null;
      if (characterStateId) {
        ownerState = await prisma.campaignCharacterState.findUnique({
          where: { id: characterStateId },
          include: { character: true },
        });
        if (!ownerState || ownerState.campaignId !== campaign.id) {
          return badRequest(reply, 'Владелец документа должен быть персонажем этой кампании.');
        }

        const canCreate = ownerState.character.ownerId === actorUserId || (await isCampaignMaster(campaign.id, actorUserId));
        if (!canCreate) {
          return forbidden(reply, 'Документ может создать владелец персонажа или мастер.');
        }
      } else if (!(await isCampaignMaster(campaign.id, actorUserId))) {
        return forbidden(reply, 'Документ без владельца может создать только мастер.');
      }

      const nowIso = new Date().toISOString();
      const document = await prisma.noteDocument.create({
        data: {
          campaignId: campaign.id,
          ownerStateId: ownerState?.id ?? null,
          title: title.slice(0, 100),
          historyJson: JSON.stringify([{ action: 'create', userId: actorUserId, at: nowIso }]),
        },
      });

      await createAutosave('document', document.id, `Документ "${document.title}" создан.`, actorUserId, campaign.id);
      await broadcastCampaignRefresh(campaign.id, actorUserId, ownerState?.characterId);
      return document;
    },
  );

  server.patch<{ Params: { documentId: string }; Body: UpdateNoteDocumentBody }>(
    '/api/documents/:documentId',
    async (request, reply) => {
      const body = asBody<UpdateNoteDocumentBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);

      if (!actorUserId) {
        return badRequest(reply, 'Укажите пользователя, который меняет документ.');
      }

      const document = await prisma.noteDocument.findUnique({ where: { id: request.params.documentId } });
      if (!document) {
        return notFound(reply, 'Документ не найден.');
      }

      const ownerState = document.ownerStateId
        ? await prisma.campaignCharacterState.findUnique({ where: { id: document.ownerStateId }, include: { character: true } })
        : null;
      const canEdit = ownerState ? ownerState.character.ownerId === actorUserId || (await isCampaignMaster(document.campaignId, actorUserId)) : await isCampaignMaster(document.campaignId, actorUserId);
      if (!canEdit) {
        return forbidden(reply, 'Документ может менять владелец или мастер.');
      }

      const updated = await prisma.noteDocument.update({
        where: { id: document.id },
        data: {
          title: text(body.title)?.slice(0, 100) ?? document.title,
          textContent: body.textContent === undefined ? document.textContent : String(body.textContent).slice(0, 12000),
          drawingJson: body.drawing === undefined ? document.drawingJson : JSON.stringify(normalizeDrawing(body.drawing)),
          inkUsed: document.inkUsed + integerOr(body.inkDelta, 0, 0, 9999),
          isShownToGm: body.isShownToGm === undefined ? document.isShownToGm : body.isShownToGm === true,
          historyJson: appendDocumentHistory(document.historyJson, {
            action: body.isShownToGm === true ? 'show-to-gm' : 'update',
            userId: actorUserId,
            inkDelta: integerOr(body.inkDelta, 0, 0, 9999),
            at: new Date().toISOString(),
          }),
        },
      });

      await broadcastCampaignRefresh(document.campaignId, actorUserId, ownerState?.characterId);
      return updated;
    },
  );

  server.post<{ Params: { documentId: string }; Body: TransferNoteDocumentBody }>(
    '/api/documents/:documentId/transfer',
    async (request, reply) => {
      const body = asBody<TransferNoteDocumentBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);
      const targetCharacterStateId = text(body.targetCharacterStateId);

      if (!actorUserId || !targetCharacterStateId) {
        return badRequest(reply, 'Укажите пользователя и получателя документа.');
      }

      const document = await prisma.noteDocument.findUnique({ where: { id: request.params.documentId } });
      if (!document) {
        return notFound(reply, 'Документ не найден.');
      }

      const [ownerState, targetState] = await Promise.all([
        document.ownerStateId
          ? prisma.campaignCharacterState.findUnique({ where: { id: document.ownerStateId }, include: { character: true } })
          : null,
        prisma.campaignCharacterState.findUnique({ where: { id: targetCharacterStateId }, include: { character: true } }),
      ]);

      if (!targetState || targetState.campaignId !== document.campaignId) {
        return badRequest(reply, 'Получатель должен быть персонажем этой кампании.');
      }

      const canTransfer = ownerState
        ? ownerState.character.ownerId === actorUserId || (await isCampaignMaster(document.campaignId, actorUserId))
        : await isCampaignMaster(document.campaignId, actorUserId);
      if (!canTransfer) {
        return forbidden(reply, 'Документ может передать владелец или мастер.');
      }

      const updated = await prisma.noteDocument.update({
        where: { id: document.id },
        data: {
          ownerStateId: targetState.id,
          historyJson: appendDocumentHistory(document.historyJson, {
            action: 'transfer',
            userId: actorUserId,
            fromStateId: ownerState?.id ?? null,
            toStateId: targetState.id,
            at: new Date().toISOString(),
          }),
        },
      });

      await createAutosave('document', document.id, `Документ "${document.title}" передан ${targetState.character.name}.`, actorUserId, document.campaignId);
      await broadcastCampaignRefresh(document.campaignId, actorUserId, targetState.characterId);
      return updated;
    },
  );

  server.get<{ Params: { campaignId: string } }>('/api/campaigns/:campaignId/turn-encounters/active', async (request, reply) => {
    const encounter = await prisma.turnEncounter.findFirst({
      where: { campaignId: request.params.campaignId, status: 'active' },
      include: turnEncounterInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    if (!encounter) {
      return notFound(reply, 'Активная походовая сцена не найдена.');
    }

    return encounter;
  });

  server.post<{ Params: { campaignId: string }; Body: CreateTurnEncounterBody }>(
    '/api/campaigns/:campaignId/turn-encounters',
    async (request, reply) => {
      const body = asBody<CreateTurnEncounterBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';

      const campaign = await prisma.campaign.findUnique({
        where: { id: request.params.campaignId },
        include: {
          rooms: { where: { status: 'open' }, orderBy: { updatedAt: 'desc' } },
          characterStates: { include: { character: true }, orderBy: { updatedAt: 'asc' } },
        },
      });

      if (!campaign) {
        return notFound(reply, 'Кампания не найдена.');
      }

      if (!(await isCampaignMaster(campaign.id, masterUserId))) {
        return forbidden(reply, 'Походовую сцену может начать только мастер.');
      }

      const selectedIds = new Set(
        Array.isArray(body.participantStateIds)
          ? body.participantStateIds.filter((value): value is string => typeof value === 'string')
          : [],
      );
      const states = selectedIds.size > 0
        ? campaign.characterStates.filter((state) => selectedIds.has(state.id))
        : campaign.characterStates;
      const roomId = nullableText(body.roomId) ?? campaign.rooms[0]?.id ?? null;
      const participantData: Array<{
        characterStateId: string | null;
        name: string;
        kind: string;
        initiative: number;
        turnOrder: number;
        armorClass: number;
        currentHp: number;
        maxHp: number;
        speed: number;
        movementLimit: number;
      }> = states.map((state, index) => ({
        characterStateId: state.id,
        name: state.character.name,
        kind: state.character.kind === 'npc' ? 'npc' : 'player',
        initiative: 10,
        turnOrder: index,
        armorClass: state.armorClass,
        currentHp: state.currentHp,
        maxHp: state.maxHp,
        speed: state.speed,
        movementLimit: state.speed,
      }));

      if (participantData.length === 0) {
        participantData.push({
          characterStateId: null,
          name: 'Тренировочный противник',
          kind: 'npc',
          initiative: 8,
          turnOrder: 0,
          armorClass: 12,
          currentHp: 7,
          maxHp: 7,
          speed: 30,
          movementLimit: 30,
        });
      }

      await prisma.turnEncounter.updateMany({
        where: { campaignId: campaign.id, status: 'active' },
        data: { status: 'closed', endedAt: new Date() },
      });

      const encounter = await prisma.turnEncounter.create({
        data: {
          campaignId: campaign.id,
          roomId,
          name: text(body.name) ?? 'Походовая сцена',
          participants: { create: participantData },
        },
        include: turnEncounterInclude(),
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'turn-encounter',
          scopeId: encounter.id,
          campaignId: campaign.id,
          userId: masterUserId,
          summary: `Начата походовая сцена: ${encounter.name}.`,
          payloadJson: JSON.stringify({ actionType: 'turn-start', encounterId: encounter.id, at: new Date().toISOString() }),
        },
      });

      broadcastTurnEncounter(encounter, masterUserId, { encounter });
      return reply.code(201).send(encounter);
    },
  );

  server.post<{ Params: { encounterId: string }; Body: AddTurnNpcBody }>(
    '/api/turn-encounters/:encounterId/npcs',
    async (request, reply) => {
      const body = asBody<AddTurnNpcBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';
      const encounter = await getFullTurnEncounter(request.params.encounterId);

      if (!encounter) {
        return notFound(reply, 'Походовая сцена не найдена.');
      }

      if (!(await isCampaignMaster(encounter.campaignId, masterUserId))) {
        return forbidden(reply, 'NPC в походовую сцену добавляет мастер.');
      }

      const nextOrder = encounter.participants.length;
      await prisma.turnParticipant.create({
        data: {
          encounterId: encounter.id,
          name: text(body.name) ?? 'NPC',
          kind: 'npc',
          initiative: integerOr(body.initiative, 8, -10, 40),
          turnOrder: nextOrder,
          armorClass: integerOr(body.armorClass, 12, 1, 40),
          currentHp: integerOr(body.currentHp, numberOr(body.maxHp, 7), 0, 999),
          maxHp: integerOr(body.maxHp, 7, 1, 999),
          speed: integerOr(body.speed, 30, 0, 300),
          movementLimit: integerOr(body.speed, 30, 0, 300),
        },
      });
      await normalizeTurnOrder(encounter.id);

      const updatedEncounter = await getFullTurnEncounter(encounter.id);
      await prisma.saveSnapshot.create({
        data: {
          scope: 'turn-encounter',
          scopeId: encounter.id,
          campaignId: encounter.campaignId,
          userId: masterUserId,
          summary: `В походовую сцену добавлен NPC: ${text(body.name) ?? 'NPC'}.`,
          payloadJson: JSON.stringify({ actionType: 'turn-npc-added', encounterId: encounter.id, at: new Date().toISOString() }),
        },
      });

      if (updatedEncounter) {
        broadcastTurnEncounter(updatedEncounter, masterUserId, { encounter: updatedEncounter });
      }
      return updatedEncounter;
    },
  );

  server.patch<{ Params: { encounterId: string; participantId: string }; Body: UpdateTurnParticipantBody }>(
    '/api/turn-encounters/:encounterId/participants/:participantId',
    async (request, reply) => {
      const body = asBody<UpdateTurnParticipantBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';
      const encounter = await getFullTurnEncounter(request.params.encounterId);

      if (!encounter) {
        return notFound(reply, 'Походовая сцена не найдена.');
      }

      if (!(await isCampaignMaster(encounter.campaignId, masterUserId))) {
        return forbidden(reply, 'Инициативу и состояние участника меняет мастер.');
      }

      const participant = encounter.participants.find((item) => item.id === request.params.participantId);
      if (!participant) {
        return notFound(reply, 'Участник походовой сцены не найден.');
      }

      await prisma.turnParticipant.update({
        where: { id: participant.id },
        data: {
          initiative: body.initiative === undefined ? participant.initiative : integerOr(body.initiative, participant.initiative, -10, 40),
          currentHp: body.currentHp === undefined ? participant.currentHp : integerOr(body.currentHp, participant.currentHp, 0, 999),
          isActive: body.isActive === undefined ? participant.isActive : body.isActive === true,
        },
      });
      await normalizeTurnOrder(encounter.id);

      const updatedEncounter = await getFullTurnEncounter(encounter.id);
      if (updatedEncounter) {
        broadcastTurnEncounter(updatedEncounter, masterUserId, { encounter: updatedEncounter });
      }
      return updatedEncounter;
    },
  );

  server.post<{ Params: { encounterId: string; participantId: string }; Body: UseTurnResourceBody }>(
    '/api/turn-encounters/:encounterId/participants/:participantId/use-resource',
    async (request, reply) => {
      const body = asBody<UseTurnResourceBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);
      const resource = normalizeTurnResource(body.resource);

      if (!actorUserId || !resource) {
        return badRequest(reply, 'Укажите пользователя и ресурс хода.');
      }

      const encounter = await getFullTurnEncounter(request.params.encounterId);
      if (!encounter) {
        return notFound(reply, 'Походовая сцена не найдена.');
      }

      const participant = encounter.participants.find((item) => item.id === request.params.participantId);
      if (!participant) {
        return notFound(reply, 'Участник походовой сцены не найден.');
      }

      const isMaster = await isCampaignMaster(encounter.campaignId, actorUserId);
      const allowOverride = body.allowOverride === true && isMaster;
      let warning: string | null = null;
      const data: Record<string, unknown> = {};

      if (resource === 'movement') {
        const movement = integerOr(body.movement, 5, 0, 300);
        const nextMovement = participant.movementUsed + movement;
        if (nextMovement > participant.movementLimit && !allowOverride) {
          warning = `Перемещение превысит лимит ${participant.movementLimit} фт. Нужен override мастера.`;
        }
        data.movementUsed = nextMovement;
      } else {
        const field = `${resource}Used` as 'actionUsed' | 'bonusActionUsed' | 'reactionUsed';
        if (participant[field] && !allowOverride) {
          warning = `${participant.name} уже использовал ${turnResourceLabels[resource]} в этом раунде. Нужен override мастера.`;
        }
        data[field] = true;
      }

      if (warning) {
        return reply.code(409).send({
          message: warning,
          requiresOverride: true,
          warning,
          encounter,
        });
      }

      await prisma.turnParticipant.update({
        where: { id: participant.id },
        data,
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'turn-encounter',
          scopeId: encounter.id,
          campaignId: encounter.campaignId,
          userId: actorUserId,
          summary: `${participant.name}: ${turnResourceLabels[resource]} отмечено${allowOverride ? ' с override мастера' : ''}.`,
          payloadJson: JSON.stringify({
            actionType: 'turn-resource',
            encounterId: encounter.id,
            participantId: participant.id,
            resource,
            override: allowOverride,
            notes: text(body.notes),
            at: new Date().toISOString(),
          }),
        },
      });

      const updatedEncounter = await getFullTurnEncounter(encounter.id);
      if (updatedEncounter) {
        broadcastTurnEncounter(updatedEncounter, actorUserId, { encounter: updatedEncounter });
      }
      return {
        encounter: updatedEncounter,
        override: allowOverride,
      };
    },
  );

  server.post<{ Params: { encounterId: string }; Body: AddTurnEffectBody }>(
    '/api/turn-encounters/:encounterId/effects',
    async (request, reply) => {
      const body = asBody<AddTurnEffectBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';
      const name = text(body.name);
      const encounter = await getFullTurnEncounter(request.params.encounterId);

      if (!encounter) {
        return notFound(reply, 'Походовая сцена не найдена.');
      }

      if (!name) {
        return badRequest(reply, 'Укажите название эффекта.');
      }

      if (!(await isCampaignMaster(encounter.campaignId, masterUserId))) {
        return forbidden(reply, 'Эффекты походовой сцены добавляет мастер.');
      }

      const participantId = nullableText(body.participantId);
      if (participantId && !encounter.participants.some((participant) => participant.id === participantId)) {
        return notFound(reply, 'Участник для эффекта не найден.');
      }

      await prisma.turnEffect.create({
        data: {
          encounterId: encounter.id,
          participantId,
          name,
          remainingRounds: integerOr(body.remainingRounds, 1, 1, 999),
          timing: text(body.timing) ?? 'end_of_turn',
          notes: nullableText(body.notes),
        },
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'turn-encounter',
          scopeId: encounter.id,
          campaignId: encounter.campaignId,
          userId: masterUserId,
          summary: `Добавлен эффект: ${name}.`,
          payloadJson: JSON.stringify({ actionType: 'turn-effect-added', encounterId: encounter.id, at: new Date().toISOString() }),
        },
      });

      const updatedEncounter = await getFullTurnEncounter(encounter.id);
      if (updatedEncounter) {
        broadcastTurnEncounter(updatedEncounter, masterUserId, { encounter: updatedEncounter });
      }
      return updatedEncounter;
    },
  );

  server.post<{ Params: { encounterId: string }; Body: CloseTurnEncounterBody }>(
    '/api/turn-encounters/:encounterId/next-turn',
    async (request, reply) => {
      const body = asBody<CloseTurnEncounterBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';
      const encounter = await getFullTurnEncounter(request.params.encounterId);

      if (!encounter) {
        return notFound(reply, 'Походовая сцена не найдена.');
      }

      if (!(await isCampaignMaster(encounter.campaignId, masterUserId))) {
        return forbidden(reply, 'Ходы переключает мастер.');
      }

      const activeParticipants = getActiveTurnParticipants(encounter.participants);
      if (activeParticipants.length === 0) {
        return badRequest(reply, 'В походовой сцене нет активных участников.');
      }

      const endingParticipant = activeParticipants[Math.min(encounter.currentTurnIndex, activeParticipants.length - 1)];
      const nextIndex = (encounter.currentTurnIndex + 1) % activeParticipants.length;
      const nextRound = nextIndex === 0 ? encounter.round + 1 : encounter.round;
      const nextParticipant = activeParticipants[nextIndex];

      await prisma.$transaction(async (tx) => {
        const endingEffects = encounter.effects.filter(
          (effect) =>
            effect.isActive &&
            effect.timing === 'end_of_turn' &&
            (!effect.participantId || effect.participantId === endingParticipant.id),
        );

        for (const effect of endingEffects) {
          const remainingRounds = Math.max(0, effect.remainingRounds - 1);
          await tx.turnEffect.update({
            where: { id: effect.id },
            data: {
              remainingRounds,
              isActive: remainingRounds > 0,
            },
          });
        }

        await tx.turnParticipant.update({
          where: { id: nextParticipant.id },
          data: {
            actionUsed: false,
            bonusActionUsed: false,
            reactionUsed: false,
            movementUsed: 0,
          },
        });

        await tx.turnEncounter.update({
          where: { id: encounter.id },
          data: {
            currentTurnIndex: nextIndex,
            round: nextRound,
          },
        });

        await tx.saveSnapshot.create({
          data: {
            scope: 'turn-encounter',
            scopeId: encounter.id,
            campaignId: encounter.campaignId,
            userId: masterUserId,
            summary: `Ход перешел к ${nextParticipant.name}. Раунд ${nextRound}.`,
            payloadJson: JSON.stringify({
              actionType: 'turn-next',
              encounterId: encounter.id,
              participantId: nextParticipant.id,
              round: nextRound,
              at: new Date().toISOString(),
            }),
          },
        });
      });

      const updatedEncounter = await getFullTurnEncounter(encounter.id);
      if (updatedEncounter) {
        broadcastTurnEncounter(updatedEncounter, masterUserId, { encounter: updatedEncounter });
      }
      return updatedEncounter;
    },
  );

  server.post<{ Params: { encounterId: string }; Body: CloseTurnEncounterBody }>(
    '/api/turn-encounters/:encounterId/end',
    async (request, reply) => {
      const body = asBody<CloseTurnEncounterBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';
      const encounter = await getFullTurnEncounter(request.params.encounterId);

      if (!encounter) {
        return notFound(reply, 'Походовая сцена не найдена.');
      }

      if (!(await isCampaignMaster(encounter.campaignId, masterUserId))) {
        return forbidden(reply, 'Походовую сцену завершает мастер.');
      }

      const closed = await prisma.turnEncounter.update({
        where: { id: encounter.id },
        data: { status: 'closed', endedAt: new Date() },
        include: turnEncounterInclude(),
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'turn-encounter',
          scopeId: encounter.id,
          campaignId: encounter.campaignId,
          userId: masterUserId,
          summary: `Походовая сцена завершена: ${encounter.name}.`,
          payloadJson: JSON.stringify({ actionType: 'turn-end', encounterId: encounter.id, at: new Date().toISOString() }),
        },
      });

      broadcastTurnEncounter(closed, masterUserId, { encounter: closed });
      return closed;
    },
  );

  server.get('/api/campaigns', async () =>
    prisma.campaign.findMany({ include: campaignInclude(), orderBy: { updatedAt: 'desc' } }),
  );

  server.get<{ Params: { id: string } }>('/api/campaigns/:id', async (request, reply) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.id },
      include: campaignInclude(),
    });

    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    return campaign;
  });

  server.post('/api/campaigns', async (request, reply) => {
    const body = asBody<CreateCampaignBody>(request.body);
    const name = text(body.name);
    const masterUserId = text(body.masterUserId) ?? 'local-master';

    if (!name) {
      return badRequest(reply, 'Укажите название кампании.');
    }

    const master = await prisma.user.findUnique({ where: { id: masterUserId } });
    if (!master || master.defaultRole !== 'master') {
      return forbidden(reply, 'Только мастер может создать кампанию.');
    }

    const settingId = nullableText(body.settingId);
    const setting = settingId ? await prisma.setting.findUnique({ where: { id: settingId } }) : null;
    const settingSlug = setting?.slug ?? 'universal';
    const includeSettingDlc = body.includeSettingDlc !== false;
    const includeHomebrewDlc = body.includeHomebrewDlc === true;
    const sourceBooks = await prisma.sourceBook.findMany();
    const campaign = await prisma.$transaction(async (tx) => {
      const createdCampaign = await tx.campaign.create({
        data: {
          name,
          description: nullableText(body.description),
          ownerId: masterUserId,
          settingId,
          members: {
            create: {
              userId: masterUserId,
              role: 'master',
            },
          },
          parties: {
            create: {
              name: 'Основная партия',
            },
          },
        },
      });

      if (sourceBooks.length > 0) {
        await tx.campaignSourceBook.createMany({
          data: sourceBooks.map((sourceBook) => ({
            campaignId: createdCampaign.id,
            sourceBookId: sourceBook.id,
            isEnabled: includeSettingDlc
              ? shouldEnableSourceForCampaign(settingSlug, sourceBook, includeHomebrewDlc)
              : sourceBook.isEnabledByDefault,
          })),
        });
      }

      await tx.saveSnapshot.create({
        data: {
          scope: 'campaign',
          scopeId: createdCampaign.id,
          campaignId: createdCampaign.id,
          userId: masterUserId,
          summary: 'Кампания создана и сохранена локально.',
          payloadJson: JSON.stringify({ autosave: true }),
        },
      });

      return createdCampaign;
    });

    const fullCampaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
      include: campaignInclude(),
    });

    return reply.code(201).send(fullCampaign);
  });

  server.patch<{ Params: { id: string } }>('/api/campaigns/:id', async (request, reply) => {
    const body = asBody<UpdateCampaignBody>(request.body);
    const masterUserId = text(body.masterUserId) ?? 'local-master';

    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.id },
    });

    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    if (!(await isCampaignMaster(campaign.id, masterUserId))) {
      return forbidden(reply, 'Только мастер может редактировать кампанию.');
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        name: text(body.name) ?? campaign.name,
        description: body.description === undefined ? campaign.description : nullableText(body.description),
        settingId: body.settingId === undefined ? campaign.settingId : nullableText(body.settingId),
        status: text(body.status) ?? campaign.status,
      },
      include: campaignInclude(),
    });

    await createAutosave('campaign', campaign.id, 'Кампания обновлена и сохранена локально.', masterUserId, campaign.id);

    return updatedCampaign;
  });

  server.post<{ Params: { id: string } }>('/api/campaigns/:id/load', async (request, reply) => {
    const body = asBody<CreateRoomBody>(request.body);
    const masterUserId = text(body.masterUserId) ?? 'local-master';

    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.id },
      include: { parties: true, rooms: { where: { status: 'open' }, orderBy: { updatedAt: 'desc' } } },
    });

    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    if (!(await isCampaignMaster(campaign.id, masterUserId))) {
      return forbidden(reply, 'Только мастер может загрузить кампанию.');
    }

    const existingRoom = campaign.rooms[0];
    if (existingRoom) {
      const room = await prisma.gameRoom.update({
        where: { id: existingRoom.id },
        data: { updatedAt: new Date(), status: 'open' },
        include: {
          setting: true,
          participants: { include: { user: true, character: { include: { sheetState: true } } } },
        },
      });

      await createAutosave('room', room.id, 'Кампания загружена и открыта для сети.', masterUserId, campaign.id);
      return room;
    }

    const room = await prisma.gameRoom.create({
      data: {
        campaignId: campaign.id,
        partyId: campaign.parties[0]?.id ?? null,
        hostUserId: masterUserId,
        settingId: campaign.settingId,
        name: `${campaign.name}: комната`,
        inviteCode: generateInviteCode(),
        participants: {
          create: {
            userId: masterUserId,
            role: 'master',
            status: 'joined',
          },
        },
      },
      include: {
        setting: true,
        participants: { include: { user: true, character: { include: { sheetState: true } } } },
      },
    });

    await createAutosave('room', room.id, 'Кампания загружена и открыта для сети.', masterUserId, campaign.id);
    return reply.code(201).send(room);
  });

  server.delete<{ Params: { id: string }; Body: DeleteConfirmBody }>('/api/campaigns/:id', async (request, reply) => {
    const body = asBody<DeleteConfirmBody>(request.body);
    const masterUserId = text(body.masterUserId) ?? 'local-master';

    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.id },
    });

    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    if (!(await isCampaignMaster(campaign.id, masterUserId))) {
      return forbidden(reply, 'Только мастер может удалить кампанию.');
    }

    if (!hasDeleteConfirmation(body.confirmText)) {
      return badRequest(reply, 'Для удаления напишите слово "удалить".');
    }

    await prisma.campaign.delete({ where: { id: campaign.id } });
    return { deleted: true, id: campaign.id };
  });

  server.post<{ Params: { id: string } }>('/api/campaigns/:id/rooms', async (request, reply) => {
    const body = asBody<CreateRoomBody>(request.body);
    const name = text(body.name) ?? 'Игровая комната';
    const masterUserId = text(body.masterUserId) ?? 'local-master';

    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.id },
      include: { parties: true },
    });

    if (!campaign) {
      return notFound(reply, 'Кампания не найдена.');
    }

    if (!(await isCampaignMaster(campaign.id, masterUserId))) {
      return forbidden(reply, 'Игрок не может создать игровую комнату.');
    }

    const partyId = nullableText(body.partyId) ?? campaign.parties[0]?.id ?? null;
    const room = await prisma.gameRoom.create({
      data: {
        campaignId: campaign.id,
        partyId,
        hostUserId: masterUserId,
        settingId: nullableText(body.settingId) ?? campaign.settingId,
        name,
        inviteCode: generateInviteCode(),
        participants: {
          create: {
            userId: masterUserId,
            role: 'master',
            status: 'joined',
          },
        },
      },
      include: {
        setting: true,
        participants: { include: { user: true, character: true } },
      },
    });

    await createAutosave('room', room.id, 'Комната создана и сохранена локально.', masterUserId, campaign.id);

    return reply.code(201).send(room);
  });

  server.patch<{ Params: { id: string } }>('/api/rooms/:id', async (request, reply) => {
    const body = asBody<UpdateRoomBody>(request.body);
    const masterUserId = text(body.masterUserId) ?? 'local-master';

    const room = await prisma.gameRoom.findUnique({
      where: { id: request.params.id },
      include: { campaign: true },
    });

    if (!room) {
      return notFound(reply, 'Комната не найдена.');
    }

    if (!(await isCampaignMaster(room.campaignId, masterUserId))) {
      return forbidden(reply, 'Только мастер может редактировать комнату.');
    }

    const updatedRoom = await prisma.gameRoom.update({
      where: { id: room.id },
      data: {
        name: text(body.name) ?? room.name,
        status: text(body.status) ?? room.status,
        settingId: body.settingId === undefined ? room.settingId : nullableText(body.settingId),
      },
      include: {
        setting: true,
        participants: { include: { user: true, character: { include: { sheetState: true } } } },
      },
    });

    await createAutosave('room', room.id, 'Комната обновлена и сохранена локально.', masterUserId, room.campaignId);

    return updatedRoom;
  });

  server.patch<{ Params: { id: string; sourceBookId: string } }>(
    '/api/campaigns/:id/source-books/:sourceBookId',
    async (request, reply) => {
      const body = asBody<ToggleCampaignSourceBookBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';

      const campaign = await prisma.campaign.findUnique({
        where: { id: request.params.id },
      });

      if (!campaign) {
        return notFound(reply, 'Кампания не найдена.');
      }

      if (!(await isCampaignMaster(campaign.id, masterUserId))) {
        return forbidden(reply, 'Только мастер может менять активные книги кампании.');
      }

      const sourceBook = await prisma.sourceBook.findUnique({
        where: { id: request.params.sourceBookId },
      });

      if (!sourceBook) {
        return notFound(reply, 'Источник не найден.');
      }

      const link = await prisma.campaignSourceBook.upsert({
        where: {
          campaignId_sourceBookId: {
            campaignId: campaign.id,
            sourceBookId: sourceBook.id,
          },
        },
        update: {
          isEnabled: Boolean(body.isEnabled),
          language: nullableText(body.language),
        },
        create: {
          campaignId: campaign.id,
          sourceBookId: sourceBook.id,
          isEnabled: Boolean(body.isEnabled),
          language: nullableText(body.language),
        },
        include: { sourceBook: true },
      });

      await createAutosave(
        'campaign',
        campaign.id,
        link.isEnabled
          ? `Источник "${sourceBook.titleRu}" включен в кампании.`
          : `Источник "${sourceBook.titleRu}" выключен в кампании.`,
        masterUserId,
        campaign.id,
      );

      return link;
    },
  );

  server.patch<{ Params: { id: string; sourceBookId: string }; Body: ToggleRoomSourceBookBody }>(
    '/api/rooms/:id/source-books/:sourceBookId',
    async (request, reply) => {
      const body = asBody<ToggleRoomSourceBookBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';

      const room = await prisma.gameRoom.findUnique({
        where: { id: request.params.id },
        include: { campaign: true },
      });

      if (!room) {
        return notFound(reply, 'Комната не найдена.');
      }

      if (!(await isCampaignMaster(room.campaignId, masterUserId))) {
        return forbidden(reply, 'Только мастер может менять источники комнаты.');
      }

      const sourceBook = await prisma.sourceBook.findUnique({
        where: { id: request.params.sourceBookId },
      });

      if (!sourceBook) {
        return notFound(reply, 'Источник не найден.');
      }

      const shouldInherit = body.inherit === true || body.isEnabled === null;

      if (shouldInherit) {
        await prisma.roomSourceBookOverride.deleteMany({
          where: {
            roomId: room.id,
            sourceBookId: sourceBook.id,
          },
        });

        await createAutosave(
          'room',
          room.id,
          `Источник "${sourceBook.titleRu}" снова наследует настройки кампании.`,
          masterUserId,
          room.campaignId,
        );

        broadcastRoom(room.id, {
          type: 'room:refreshed',
          campaignId: room.campaignId,
          userId: masterUserId,
          payload: { sourceBookId: sourceBook.id, inherited: true },
        });

        return { inherited: true, sourceBookId: sourceBook.id };
      }

      if (typeof body.isEnabled !== 'boolean') {
        return badRequest(reply, 'Укажите состояние источника комнаты или режим наследования.');
      }

      const override = await prisma.roomSourceBookOverride.upsert({
        where: {
          roomId_sourceBookId: {
            roomId: room.id,
            sourceBookId: sourceBook.id,
          },
        },
        update: {
          isEnabled: body.isEnabled,
          language: nullableText(body.language),
          reason: nullableText(body.reason),
        },
        create: {
          roomId: room.id,
          sourceBookId: sourceBook.id,
          isEnabled: body.isEnabled,
          language: nullableText(body.language),
          reason: nullableText(body.reason),
        },
        include: { sourceBook: true },
      });

      await createAutosave(
        'room',
        room.id,
        override.isEnabled
          ? `Источник "${sourceBook.titleRu}" включен только для комнаты.`
          : `Источник "${sourceBook.titleRu}" выключен только для комнаты.`,
        masterUserId,
        room.campaignId,
      );

      broadcastRoom(room.id, {
        type: 'room:refreshed',
        campaignId: room.campaignId,
        userId: masterUserId,
        payload: { sourceBookId: sourceBook.id, override },
      });

      return override;
    },
  );

  server.post<{ Params: { id: string } }>('/api/rooms/:id/join', async (request, reply) => {
    const body = asBody<JoinRoomBody>(request.body);
    const userId = text(body.userId);
    const characterId = text(body.characterId);
    const inviteCode = text(body.inviteCode);

    if (!userId || !characterId) {
      return badRequest(reply, 'Выберите игрока и персонажа для входа в комнату.');
    }

    const room = await prisma.gameRoom.findUnique({
      where: { id: request.params.id },
      include: { campaign: true, party: true },
    });

    if (!room) {
      return notFound(reply, 'Комната не найдена.');
    }

    if (inviteCode && inviteCode.toUpperCase() !== room.inviteCode) {
      return forbidden(reply, 'Код приглашения не подходит для этой комнаты.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return notFound(reply, 'Пользователь не найден.');
    }

    if (user.defaultRole === 'master') {
      return forbidden(reply, 'Мастер уже управляет комнатой из мастерского режима.');
    }

    const character = await prisma.character.findUnique({ where: { id: characterId }, include: { sheetState: true } });
    if (!character || character.ownerId !== userId) {
      return forbidden(reply, 'Можно войти только своим локальным персонажем.');
    }

    const joined = await prisma.$transaction(async (tx) => {
      await tx.campaignMember.upsert({
        where: {
          campaignId_userId: {
            campaignId: room.campaignId,
            userId,
          },
        },
        update: { role: 'player' },
        create: {
          campaignId: room.campaignId,
          userId,
          role: 'player',
        },
      });

      if (room.partyId) {
        await tx.character.update({
          where: { id: character.id },
          data: { partyId: room.partyId },
        });
      }

      await tx.campaignCharacterState.upsert({
        where: {
          campaignId_characterId: {
            campaignId: room.campaignId,
            characterId: character.id,
          },
        },
        update: {},
        create: {
          campaignId: room.campaignId,
          characterId: character.id,
          level: character.level,
          currentHp: character.sheetState?.currentHp ?? 10,
          maxHp: character.sheetState?.maxHp ?? 10,
          armorClass: character.sheetState?.armorClass ?? 10,
          speed: character.sheetState?.speed ?? 30,
          sheetJson: JSON.stringify({
            ...parseJsonObject(character.sheetState?.sheetJson),
            createdOnJoin: true,
          }),
        },
      });

      const participant = await tx.roomParticipant.upsert({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId,
          },
        },
        update: {
          characterId: character.id,
          role: 'player',
          status: 'joined',
        },
        create: {
          roomId: room.id,
          userId,
          characterId: character.id,
          role: 'player',
          status: 'joined',
        },
        include: { user: true, character: { include: { sheetState: true } } },
      });

      await tx.saveSnapshot.create({
        data: {
          scope: 'room',
          scopeId: room.id,
          campaignId: room.campaignId,
          userId,
          summary: `${user.displayName} вошел в комнату персонажем ${character.name}.`,
          payloadJson: JSON.stringify({ autosave: true }),
        },
      });

      return participant;
    });

    broadcastRoom(room.id, {
      type: 'room:joined',
      campaignId: room.campaignId,
      userId,
      characterId: character.id,
      payload: joined,
    });

    return joined;
  });

  server.post('/api/rooms/join-by-code', async (request, reply) => {
    const body = asBody<JoinByCodeBody>(request.body);
    const inviteCode = text(body.inviteCode);

    if (!inviteCode) {
      return badRequest(reply, 'Введите код кампании.');
    }

    const room = await prisma.gameRoom.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });

    if (!room) {
      return notFound(reply, 'Комната с таким кодом не найдена.');
    }

    const userId = text(body.userId);
    const characterId = text(body.characterId);

    if (!userId || !characterId) {
      return badRequest(reply, 'Выберите игрока и персонажа для подключения.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const character = await prisma.character.findUnique({ where: { id: characterId } });

    if (!user || !character || character.ownerId !== user.id) {
      return forbidden(reply, 'Можно подключиться только своим локальным персонажем.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.campaignMember.upsert({
        where: {
          campaignId_userId: {
            campaignId: room.campaignId,
            userId,
          },
        },
        update: { role: 'player' },
        create: {
          campaignId: room.campaignId,
          userId,
          role: 'player',
        },
      });

      if (room.partyId) {
        await tx.character.update({
          where: { id: character.id },
          data: { partyId: room.partyId },
        });
      }
    });

    await ensureCampaignCharacterState(room.campaignId, character.id);

    const participant = await prisma.roomParticipant.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
      update: {
        characterId: character.id,
        role: 'player',
        status: 'joined',
      },
      create: {
        roomId: room.id,
        userId,
        characterId: character.id,
        role: 'player',
        status: 'joined',
      },
      include: { room: true, user: true, character: { include: { sheetState: true } } },
    });

    await createAutosave(
      'room',
      room.id,
      `${user.displayName} подключился по коду персонажем ${character.name}.`,
      userId,
      room.campaignId,
    );

    broadcastRoom(room.id, {
      type: 'room:joined',
      campaignId: room.campaignId,
      userId,
      characterId: character.id,
      payload: participant,
    });

    return participant;
  });

  server.post<{ Params: { id: string } }>('/api/parties/:id/characters', async (request, reply) => {
    const body = asBody<PartyCharacterBody>(request.body);
    const masterUserId = text(body.masterUserId) ?? 'local-master';
    const characterId = text(body.characterId);

    if (!characterId) {
      return badRequest(reply, 'Выберите персонажа для добавления в партию.');
    }

    const party = await prisma.party.findUnique({
      where: { id: request.params.id },
      include: { campaign: true },
    });

    if (!party) {
      return notFound(reply, 'Партия не найдена.');
    }

    if (!(await isCampaignMaster(party.campaignId, masterUserId))) {
      return forbidden(reply, 'Только мастер может менять состав партии.');
    }

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { owner: true },
    });

    if (!character) {
      return notFound(reply, 'Персонаж не найден.');
    }

    const updatedCharacter = await prisma.$transaction(async (tx) => {
      await tx.campaignMember.upsert({
        where: {
          campaignId_userId: {
            campaignId: party.campaignId,
            userId: character.ownerId,
          },
        },
        update: { role: character.owner.defaultRole === 'master' ? 'master' : 'player' },
        create: {
          campaignId: party.campaignId,
          userId: character.ownerId,
          role: character.owner.defaultRole === 'master' ? 'master' : 'player',
        },
      });

      const savedCharacter = await tx.character.update({
        where: { id: character.id },
        data: { partyId: party.id },
        include: { sheetState: true, owner: true },
      });

      await tx.saveSnapshot.create({
        data: {
          scope: 'party',
          scopeId: party.id,
          campaignId: party.campaignId,
          userId: masterUserId,
          summary: `Персонаж ${character.name} добавлен в партию ${party.name}.`,
          payloadJson: JSON.stringify({ autosave: true }),
        },
      });

      return savedCharacter;
    });

    return updatedCharacter;
  });

  server.delete<{ Params: { id: string; characterId: string }; Body: PartyCharacterBody }>(
    '/api/parties/:id/characters/:characterId',
    async (request, reply) => {
      const body = asBody<PartyCharacterBody>(request.body);
      const masterUserId = text(body.masterUserId) ?? 'local-master';

      const party = await prisma.party.findUnique({
        where: { id: request.params.id },
      });

      if (!party) {
        return notFound(reply, 'Партия не найдена.');
      }

      if (!(await isCampaignMaster(party.campaignId, masterUserId))) {
        return forbidden(reply, 'Только мастер может менять состав партии.');
      }

      const character = await prisma.character.findUnique({
        where: { id: request.params.characterId },
      });

      if (!character || character.partyId !== party.id) {
        return notFound(reply, 'Персонаж не найден в этой партии.');
      }

      const updatedCharacter = await prisma.character.update({
        where: { id: character.id },
        data: { partyId: null },
        include: { sheetState: true, owner: true },
      });

      await createAutosave(
        'party',
        party.id,
        `Персонаж ${character.name} убран из партии ${party.name}.`,
        masterUserId,
        party.campaignId,
      );

      return updatedCharacter;
    },
  );

  server.patch<{ Params: { roomId: string; participantId: string }; Body: UpdateRoomParticipantStatusBody }>(
    '/api/rooms/:roomId/participants/:participantId/status',
    async (request, reply) => {
      const body = asBody<UpdateRoomParticipantStatusBody>(request.body);
      const status = text(body.status);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);

      if (!status || !roomParticipantStatuses.has(status)) {
        return badRequest(reply, 'Неизвестный статус подключения игрока.');
      }

      if (!actorUserId) {
        return badRequest(reply, 'Укажите пользователя, который меняет статус подключения.');
      }

      const participant = await prisma.roomParticipant.findUnique({
        where: { id: request.params.participantId },
        include: { room: true, user: true, character: true },
      });

      if (!participant || participant.roomId !== request.params.roomId) {
        return notFound(reply, 'Участник комнаты не найден.');
      }

      if (participant.userId !== actorUserId && !(await isCampaignMaster(participant.room.campaignId, actorUserId))) {
        return forbidden(reply, 'Менять статус может сам игрок или мастер кампании.');
      }

      const updatedParticipant = await prisma.roomParticipant.update({
        where: { id: participant.id },
        data: { status },
      include: { room: true, user: true, character: { include: { sheetState: true } } },
      });

      await createAutosave(
        'room',
        participant.roomId,
        `${participant.user.displayName} теперь имеет статус подключения: ${status}.`,
        actorUserId,
        participant.room.campaignId,
      );

      broadcastRoom(participant.roomId, {
        type: 'room:participant-status',
        campaignId: participant.room.campaignId,
        userId: participant.userId,
        payload: { participantId: participant.id, status, participant: updatedParticipant },
      });

      return updatedParticipant;
    },
  );

  server.post<{ Params: { roomId: string }; Body: LeaveRoomBody }>('/api/rooms/:roomId/leave', async (request, reply) => {
    const body = asBody<LeaveRoomBody>(request.body);
    const userId = text(body.userId);

    if (!userId) {
      return badRequest(reply, 'Укажите игрока, который выходит из кампании.');
    }

    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: request.params.roomId,
          userId,
        },
      },
      include: { room: true, user: true, character: { include: { sheetState: true } } },
    });

    if (!participant) {
      return notFound(reply, 'Участник комнаты не найден.');
    }

    if (participant.role === 'master') {
      return forbidden(reply, 'Мастер не выходит из собственной комнаты через кнопку игрока.');
    }

    const updatedParticipant = await prisma.roomParticipant.update({
      where: { id: participant.id },
      data: { status: 'left' },
      include: { room: true, user: true, character: { include: { sheetState: true } } },
    });

    await createAutosave(
      'room',
      participant.roomId,
      `${participant.user.displayName} вышел из кампании.`,
      userId,
      participant.room.campaignId,
    );

    broadcastRoom(participant.roomId, {
      type: 'room:left',
      campaignId: participant.room.campaignId,
      userId,
      characterId: participant.characterId ?? undefined,
      payload: { participant: updatedParticipant },
    });

    broadcastRoom(participant.roomId, {
      type: 'room:participant-status',
      campaignId: participant.room.campaignId,
      userId,
      payload: { participantId: participant.id, status: 'left', participant: updatedParticipant },
    });

    return updatedParticipant;
  });

  server.patch<{ Params: { campaignId: string; characterId: string }; Body: UpdateCampaignCharacterHpBody }>(
    '/api/campaigns/:campaignId/characters/:characterId/hp',
    async (request, reply) => {
      const body = asBody<UpdateCampaignCharacterHpBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);

      if (!actorUserId) {
        return badRequest(reply, 'Укажите пользователя, который меняет HP персонажа.');
      }

      const state = await prisma.campaignCharacterState.findUnique({
        where: {
          campaignId_characterId: {
            campaignId: request.params.campaignId,
            characterId: request.params.characterId,
          },
        },
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
      });

      if (!state) {
        return notFound(reply, 'Состояние персонажа в кампании не найдено.');
      }

      const canEdit = state.character.ownerId === actorUserId || (await isCampaignMaster(state.campaignId, actorUserId));
      if (!canEdit) {
        return forbidden(reply, 'HP персонажа может менять владелец персонажа или мастер кампании.');
      }

      const maxHp = Math.max(1, Math.floor(numberOr(body.maxHp, state.maxHp)));
      const currentHp = Math.min(maxHp, Math.max(0, Math.floor(numberOr(body.currentHp, state.currentHp))));
      const updatedState = await prisma.campaignCharacterState.update({
        where: { id: state.id },
        data: {
          currentHp,
          maxHp,
        },
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'campaign-character',
          scopeId: state.id,
          summary: `HP персонажа ${state.character.name} изменены: ${currentHp}/${maxHp}.`,
          userId: actorUserId,
          campaignId: state.campaignId,
          payloadJson: JSON.stringify({
            actionType: 'hp-update',
            characterId: state.characterId,
            before: { currentHp: state.currentHp, maxHp: state.maxHp },
            after: { currentHp, maxHp },
            at: new Date().toISOString(),
          }),
        },
      });

      const campaignRooms = await prisma.gameRoom.findMany({
        where: { campaignId: state.campaignId },
        select: { id: true },
      });

      for (const room of campaignRooms) {
        broadcastRoom(room.id, {
          type: 'character:hp-updated',
          campaignId: state.campaignId,
          userId: actorUserId,
          characterId: state.characterId,
          payload: updatedState,
        });
      }

      return updatedState;
    },
  );

  server.patch<{ Params: { campaignId: string; characterId: string }; Body: UpdateCampaignCharacterInventoryBody }>(
    '/api/campaigns/:campaignId/characters/:characterId/inventory',
    async (request, reply) => {
      const body = asBody<UpdateCampaignCharacterInventoryBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);

      if (!actorUserId) {
        return badRequest(reply, 'Укажите пользователя, который меняет инвентарь персонажа.');
      }

      const state = await prisma.campaignCharacterState.findUnique({
        where: {
          campaignId_characterId: {
            campaignId: request.params.campaignId,
            characterId: request.params.characterId,
          },
        },
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
      });

      if (!state) {
        return notFound(reply, 'Состояние персонажа в кампании не найдено.');
      }

      const canEdit = state.character.ownerId === actorUserId || (await isCampaignMaster(state.campaignId, actorUserId));
      if (!canEdit) {
        return forbidden(reply, 'Инвентарь может менять владелец персонажа или мастер кампании.');
      }

      const inventory = sanitizeInventory(body.inventory);
      const updatedState = await prisma.campaignCharacterState.update({
        where: { id: state.id },
        data: {
          inventoryJson: JSON.stringify(inventory),
        },
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'campaign-character',
          scopeId: state.id,
          summary: `Инвентарь персонажа ${state.character.name} обновлен.`,
          userId: actorUserId,
          campaignId: state.campaignId,
          payloadJson: JSON.stringify({
            actionType: 'inventory-update',
            characterId: state.characterId,
            at: new Date().toISOString(),
          }),
        },
      });

      await broadcastCampaignRefresh(state.campaignId, actorUserId, state.characterId);

      return updatedState;
    },
  );

  server.post<{ Params: { campaignId: string; characterId: string }; Body: TransferCampaignItemBody }>(
    '/api/campaigns/:campaignId/characters/:characterId/transfer-item',
    async (request, reply) => {
      const body = asBody<TransferCampaignItemBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);
      const targetCharacterId = text(body.targetCharacterId);
      const itemId = text(body.itemId);
      const quantity = integerOr(body.quantity, 1, 1, 9999);

      if (!actorUserId || !targetCharacterId || !itemId) {
        return badRequest(reply, 'Укажите отправителя, получателя и предмет для передачи.');
      }

      if (targetCharacterId === request.params.characterId) {
        return badRequest(reply, 'Нельзя передать предмет тому же персонажу.');
      }

      const [sourceState, targetState] = await Promise.all([
        prisma.campaignCharacterState.findUnique({
          where: {
            campaignId_characterId: {
              campaignId: request.params.campaignId,
              characterId: request.params.characterId,
            },
          },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
        prisma.campaignCharacterState.findUnique({
          where: {
            campaignId_characterId: {
              campaignId: request.params.campaignId,
              characterId: targetCharacterId,
            },
          },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
      ]);

      if (!sourceState || !targetState) {
        return notFound(reply, 'Персонаж-отправитель или персонаж-получатель не найден в кампании.');
      }

      const canEdit = sourceState.character.ownerId === actorUserId || (await isCampaignMaster(sourceState.campaignId, actorUserId));
      if (!canEdit) {
        return forbidden(reply, 'Передавать предметы может владелец персонажа или мастер кампании.');
      }

      const sourceInventory = parseInventory(sourceState.inventoryJson);
      const targetInventory = parseInventory(targetState.inventoryJson);
      const sourceItem = sourceInventory.items.find((item) => item.id === itemId);

      if (!sourceItem) {
        return notFound(reply, 'Предмет для передачи не найден.');
      }

      const transferQuantity = Math.min(quantity, Number(sourceItem.quantity) || 1);
      const remainingQuantity = (Number(sourceItem.quantity) || 1) - transferQuantity;
      const transferredItem = {
        ...sourceItem,
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        quantity: transferQuantity,
        equippedSlot: null,
      };

      sourceInventory.items = sourceInventory.items
        .map((item) => (item.id === itemId ? { ...item, quantity: remainingQuantity, equippedSlot: null } : item))
        .filter((item) => Number(item.quantity) > 0);

      const matchingTargetItem = targetInventory.items.find(
        (item) =>
          item.name === transferredItem.name &&
          item.kind === transferredItem.kind &&
          item.damageDice === transferredItem.damageDice &&
          item.armorClass === transferredItem.armorClass,
      );

      if (matchingTargetItem) {
        matchingTargetItem.quantity = integerOr(Number(matchingTargetItem.quantity) + transferQuantity, transferQuantity, 1, 9999);
      } else {
        targetInventory.items.push(transferredItem);
      }

      const [updatedSourceState, updatedTargetState] = await prisma.$transaction([
        prisma.campaignCharacterState.update({
          where: { id: sourceState.id },
          data: { inventoryJson: JSON.stringify(sanitizeInventory(sourceInventory)) },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
        prisma.campaignCharacterState.update({
          where: { id: targetState.id },
          data: { inventoryJson: JSON.stringify(sanitizeInventory(targetInventory)) },
          include: { campaign: true, character: { include: { owner: true, sheetState: true } } },
        }),
        prisma.saveSnapshot.create({
          data: {
            scope: 'campaign-character',
            scopeId: sourceState.id,
            summary: `${sourceState.character.name} передал ${targetState.character.name}: ${transferredItem.name} x${transferQuantity}.`,
            userId: actorUserId,
            campaignId: sourceState.campaignId,
            payloadJson: JSON.stringify({
              transfer: true,
              actionType: 'item-transfer',
              itemName: transferredItem.name,
              quantity: transferQuantity,
              fromCharacterId: sourceState.characterId,
              toCharacterId: targetState.characterId,
              undo: {
                sourceStateId: sourceState.id,
                targetStateId: targetState.id,
                sourceInventoryJson: sourceState.inventoryJson,
                targetInventoryJson: targetState.inventoryJson,
              },
              reverted: false,
              at: new Date().toISOString(),
            }),
          },
        }),
      ]);

      await broadcastCampaignRefresh(sourceState.campaignId, actorUserId, sourceState.characterId);

      return {
        sourceState: updatedSourceState,
        targetState: updatedTargetState,
      };
    },
  );

  server.patch<{ Params: { campaignId: string; characterId: string }; Body: UpdateCampaignCharacterSpellcastingBody }>(
    '/api/campaigns/:campaignId/characters/:characterId/spellcasting',
    async (request, reply) => {
      const body = asBody<UpdateCampaignCharacterSpellcastingBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);

      if (!actorUserId) {
        return badRequest(reply, 'Укажите пользователя, который меняет заклинания персонажа.');
      }

      const state = await prisma.campaignCharacterState.findUnique({
        where: {
          campaignId_characterId: {
            campaignId: request.params.campaignId,
            characterId: request.params.characterId,
          },
        },
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
      });

      if (!state) {
        return notFound(reply, 'Состояние персонажа в кампании не найдено.');
      }

      const canEdit = state.character.ownerId === actorUserId || (await isCampaignMaster(state.campaignId, actorUserId));
      if (!canEdit) {
        return forbidden(reply, 'Заклинания может менять владелец персонажа или мастер кампании.');
      }

      const sheet = parseJsonObject(state.sheetJson);
      const spellcasting = sanitizeSpellcasting(body.spellcasting);
      const updatedState = await prisma.campaignCharacterState.update({
        where: { id: state.id },
        data: {
          sheetJson: JSON.stringify({
            ...sheet,
            spellcasting,
          }),
        },
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
      });

      await createAutosave(
        'campaign-character',
        state.id,
        `Заклинания персонажа ${state.character.name} обновлены.`,
        actorUserId,
        state.campaignId,
      );

      await broadcastCampaignRefresh(state.campaignId, actorUserId, state.characterId);

      return updatedState;
    },
  );

  server.post<{ Params: { campaignId: string; characterId: string }; Body: CastCampaignSpellBody }>(
    '/api/campaigns/:campaignId/characters/:characterId/cast-spell',
    async (request, reply) => {
      const body = asBody<CastCampaignSpellBody>(request.body);
      const actorUserId = text(body.userId) ?? text(body.masterUserId);
      const spellId = text(body.spellId);

      if (!actorUserId || !spellId) {
        return badRequest(reply, 'Укажите пользователя и заклинание.');
      }

      const state = await prisma.campaignCharacterState.findUnique({
        where: {
          campaignId_characterId: {
            campaignId: request.params.campaignId,
            characterId: request.params.characterId,
          },
        },
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
      });

      if (!state) {
        return notFound(reply, 'Состояние персонажа в кампании не найдено.');
      }

      const canEdit = state.character.ownerId === actorUserId || (await isCampaignMaster(state.campaignId, actorUserId));
      if (!canEdit) {
        return forbidden(reply, 'Заклинания может применять владелец персонажа или мастер кампании.');
      }

      const sheet = parseJsonObject(state.sheetJson);
      const spellcasting = getSpellcastingFromSheetJson(state.sheetJson);
      const spell = spellcasting.spells.find((item) => item.id === spellId);

      if (!spell) {
        return notFound(reply, 'Заклинание не найдено.');
      }

      const spellLevel = integerOr(spell.level, 0, 0, 9);
      let spentSlotLevel = 0;

      if (spellLevel > 0) {
        spentSlotLevel = integerOr(body.slotLevel, spellLevel, spellLevel, 9);
        const slot = spellcasting.slots[String(spentSlotLevel)];
        if (!slot || slot.current <= 0) {
          return badRequest(reply, `Нет доступного слота ${spentSlotLevel} уровня.`);
        }
        slot.current -= 1;
      }

      const updatedState = await prisma.campaignCharacterState.update({
        where: { id: state.id },
        data: {
          sheetJson: JSON.stringify({
            ...sheet,
            spellcasting,
          }),
        },
        include: {
          campaign: true,
          character: { include: { owner: true, sheetState: true } },
        },
      });

      await prisma.saveSnapshot.create({
        data: {
          scope: 'campaign-character',
          scopeId: state.id,
          summary:
            spentSlotLevel > 0
              ? `${state.character.name} применил ${spell.name} и потратил слот ${spentSlotLevel} уровня.`
              : `${state.character.name} применил заговор ${spell.name}.`,
          userId: actorUserId,
          campaignId: state.campaignId,
          payloadJson: JSON.stringify({
            actionType: 'spell-cast',
            spellId: spell.id,
            spellName: spell.name,
            spellLevel,
            spentSlotLevel,
            characterId: state.characterId,
            undo: {
              stateId: state.id,
              beforeSheetJson: state.sheetJson,
            },
            reverted: false,
            at: new Date().toISOString(),
          }),
        },
      });

      await broadcastCampaignRefresh(state.campaignId, actorUserId, state.characterId);

      return {
        state: updatedState,
        spell,
        spentSlotLevel,
      };
    },
  );

  server.get('/api/characters', async (request) => {
    const ownerUserId = text((request.query as { ownerUserId?: string }).ownerUserId);

    return prisma.character.findMany({
      where: ownerUserId ? { ownerId: ownerUserId } : undefined,
      include: { sheetState: true, owner: true },
      orderBy: { updatedAt: 'desc' },
    });
  });

  server.post('/api/characters', async (request, reply) => {
    const body = asBody<CreateCharacterBody>(request.body);
    const ownerUserId = text(body.ownerUserId) ?? 'local-player-1';
    const name = text(body.name);

    if (!name) {
      return badRequest(reply, 'Укажите имя персонажа.');
    }

    const user = await prisma.user.findUnique({ where: { id: ownerUserId } });
    if (!user) {
      return notFound(reply, 'Пользователь не найден.');
    }

    const library = await prisma.characterLibrary.upsert({
      where: { ownerId: ownerUserId },
      update: {},
      create: { ownerId: ownerUserId },
    });

    const maxHp = Math.max(1, numberOr(body.maxHp, 10));
    const sheetJson = {
      createdInStage: 4,
      ...incomingJsonObject(body.sheetJson),
    };
    const character = await prisma.character.create({
      data: {
        ownerId: ownerUserId,
        libraryId: library.id,
        name,
        level: Math.max(1, Math.floor(numberOr(body.level, 1))),
        ancestry: nullableText(body.ancestry),
        className: nullableText(body.className),
        portraitUrl: nullableText(body.portraitUrl),
        sheetState: {
          create: {
            currentHp: Math.max(0, numberOr(body.currentHp, maxHp)),
            maxHp,
            armorClass: Math.max(1, numberOr(body.armorClass, 10)),
            speed: Math.max(0, numberOr(body.speed, 30)),
            sheetJson: JSON.stringify(sheetJson),
          },
        },
      },
      include: { sheetState: true, owner: true },
    });

    await createAutosave('character', character.id, 'Персонаж создан и сохранен локально.', ownerUserId);

    return reply.code(201).send(character);
  });

  server.patch<{ Params: { id: string } }>('/api/characters/:id', async (request, reply) => {
    const body = asBody<UpdateCharacterBody>(request.body);
    const character = await prisma.character.findUnique({
      where: { id: request.params.id },
      include: { sheetState: true },
    });

    if (!character) {
      return notFound(reply, 'Персонаж не найден.');
    }

    const updatedCharacter = await prisma.character.update({
      where: { id: character.id },
      data: {
        name: text(body.name) ?? character.name,
        level: body.level === undefined ? character.level : Math.max(1, Math.floor(numberOr(body.level, character.level))),
        ancestry: body.ancestry === undefined ? character.ancestry : nullableText(body.ancestry),
        className: body.className === undefined ? character.className : nullableText(body.className),
        portraitUrl: body.portraitUrl === undefined ? character.portraitUrl : nullableText(body.portraitUrl),
        sheetState: {
          upsert: {
            create: {
              currentHp: numberOr(body.currentHp, character.sheetState?.currentHp ?? 10),
              maxHp: numberOr(body.maxHp, character.sheetState?.maxHp ?? 10),
              armorClass: numberOr(body.armorClass, character.sheetState?.armorClass ?? 10),
              speed: numberOr(body.speed, character.sheetState?.speed ?? 30),
              sheetJson: JSON.stringify({
                ...parseJsonObject(character.sheetState?.sheetJson),
                ...incomingJsonObject(body.sheetJson),
                updatedInStage: 4,
              }),
              autosavedAt: new Date(),
            },
            update: {
              currentHp: numberOr(body.currentHp, character.sheetState?.currentHp ?? 10),
              maxHp: numberOr(body.maxHp, character.sheetState?.maxHp ?? 10),
              armorClass: numberOr(body.armorClass, character.sheetState?.armorClass ?? 10),
              speed: numberOr(body.speed, character.sheetState?.speed ?? 30),
              sheetJson: JSON.stringify({
                ...parseJsonObject(character.sheetState?.sheetJson),
                ...incomingJsonObject(body.sheetJson),
                updatedInStage: 4,
              }),
              autosavedAt: new Date(),
            },
          },
        },
      },
      include: { sheetState: true, owner: true },
    });

    await createAutosave('character', character.id, 'Персонаж обновлен автосохранением.', character.ownerId);

    return updatedCharacter;
  });

  server.delete<{ Params: { id: string }; Body: DeleteConfirmBody }>('/api/characters/:id', async (request, reply) => {
    const body = asBody<DeleteConfirmBody>(request.body);
    const userId = text(body.userId);

    if (!userId) {
      return badRequest(reply, 'Выберите игрока перед удалением персонажа.');
    }

    const actor = await prisma.user.findUnique({ where: { id: userId } });
    if (!actor) {
      return notFound(reply, 'Пользователь не найден.');
    }

    const character = await prisma.character.findUnique({
      where: { id: request.params.id },
      include: { owner: true },
    });

    if (!character) {
      return notFound(reply, 'Персонаж не найден.');
    }

    if (character.ownerId !== userId && actor.defaultRole !== 'master') {
      return forbidden(reply, 'Можно удалить только своего персонажа.');
    }

    if (!hasDeleteConfirmation(body.confirmText)) {
      return badRequest(reply, 'Для удаления напишите слово "удалить".');
    }

    await createAutosave('character', character.id, `Персонаж ${character.name} удален из локальной библиотеки.`, userId);
    await prisma.character.delete({ where: { id: character.id } });

    return { deleted: true, id: character.id };
  });

  return server;
}
