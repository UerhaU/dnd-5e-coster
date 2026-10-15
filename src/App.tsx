import { FormEvent, useEffect, useMemo, useState, type PointerEvent } from 'react';
import { getJson, sendJson } from './api';
import { getRoomSocketUrl, type RealtimeEvent } from './realtime';

type Screen =
  | 'main-menu'
  | 'connect'
  | 'create-character'
  | 'characters'
  | 'create-campaign'
  | 'campaigns'
  | 'master-room'
  | 'player-room'
  | 'homebrew'
  | 'settings';
type AppMode = 'master' | 'player';

type User = {
  id: string;
  displayName: string;
  defaultRole: AppMode;
  authCode: string | null;
};

type Setting = {
  id: string;
  titleRu: string;
  titleOriginal: string | null;
};

type SourceBook = {
  id: string;
  fileName: string | null;
  titleRu: string;
  titleOriginal: string | null;
  sourceType: string;
  language: string;
  quality: string;
  editionCompatibility: string;
  sourcePriority: string;
  isCore: boolean;
  isOfficial: boolean;
  isEnabledByDefault: boolean;
  notes: string | null;
};

type CharacterSheetState = {
  currentHp: number;
  maxHp: number;
  armorClass: number;
  speed: number;
  sheetJson: string;
};

type Character = {
  id: string;
  ownerId: string;
  name: string;
  level: number;
  ancestry: string | null;
  className: string | null;
  portraitUrl: string | null;
  owner?: User;
  sheetState: CharacterSheetState | null;
};

type CampaignCharacterState = {
  id: string;
  campaignId: string;
  characterId: string;
  level: number;
  currentHp: number;
  maxHp: number;
  armorClass: number;
  speed: number;
  sheetJson: string;
  inventoryJson: string;
  campaign: Campaign;
  character: Character;
};

type TurnParticipant = {
  id: string;
  encounterId: string;
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
  movementUsed: number;
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  isActive: boolean;
  notes: string | null;
  characterState?: CampaignCharacterState | null;
};

type TurnEffect = {
  id: string;
  encounterId: string;
  participantId: string | null;
  name: string;
  durationType: string;
  remainingRounds: number;
  timing: string;
  isActive: boolean;
  notes: string | null;
  participant?: TurnParticipant | null;
};

type TurnEncounter = {
  id: string;
  campaignId: string;
  roomId: string | null;
  name: string;
  status: string;
  round: number;
  currentTurnIndex: number;
  participants: TurnParticipant[];
  effects: TurnEffect[];
};

type TheftRequest = {
  id: string;
  campaignId: string;
  merchantId: string;
  characterStateId: string;
  requesterUserId: string | null;
  itemId: string | null;
  itemName: string;
  status: string;
  dc: number;
  roll: number | null;
  notes: string | null;
  resolution: string | null;
  createdAt: string;
};

type Merchant = {
  id: string;
  campaignId: string;
  name: string;
  description: string | null;
  status: string;
  activeBuyerStateId: string | null;
  inventoryJson: string;
  priceMultiplier: number;
  theftRequests: TheftRequest[];
};

type HomebrewContent = {
  id: string;
  campaignId: string | null;
  ownerId: string | null;
  name: string;
  kind: string;
  status: string;
  payloadJson: string;
  notes: string | null;
  campaignLinks: Array<{
    id: string;
    campaignId: string;
    homebrewContentId: string;
    campaign: { id: string; name: string };
  }>;
};

type NpcTheftRequest = {
  id: string;
  campaignId: string;
  npcId: string;
  characterStateId: string;
  requesterUserId: string | null;
  itemId: string | null;
  itemName: string;
  status: string;
  dc: number;
  roll: number | null;
  notes: string | null;
  resolution: string | null;
  createdAt: string;
};

type NpcProfile = {
  id: string;
  campaignId: string;
  name: string;
  sourceType: string;
  role: string | null;
  socialClass: string;
  wealthTier: string;
  isActive: boolean;
  statJson: string;
  inventoryJson: string;
  notes: string | null;
  theftRequests: NpcTheftRequest[];
};

type NoteDocument = {
  id: string;
  campaignId: string;
  ownerStateId: string | null;
  title: string;
  textContent: string;
  drawingJson: string;
  historyJson: string;
  inkUsed: number;
  isShownToGm: boolean;
  createdAt: string;
  updatedAt: string;
};

type RoomParticipant = {
  id: string;
  status: string;
  user: User;
  character: Character | null;
};

type JoinRoomResult = RoomParticipant & {
  room: {
    id: string;
    campaignId: string;
    inviteCode: string;
  };
};

type GameRoom = {
  id: string;
  name: string;
  status: string;
  inviteCode: string;
  setting: Setting | null;
  participants: RoomParticipant[];
  sourceOverrides: RoomSourceBookOverride[];
};

type Party = {
  id: string;
  name: string;
  characters: Character[];
};

type CampaignSourceBook = {
  id: string;
  isEnabled: boolean;
  sourceBook: SourceBook;
};

type RoomSourceBookOverride = {
  id: string;
  isEnabled: boolean;
  reason: string | null;
  sourceBook: SourceBook;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  status: string;
  setting: Setting | null;
  members: Array<{ user: User; role: string }>;
  parties: Party[];
  rooms: GameRoom[];
  sourceBooks: CampaignSourceBook[];
  characterStates: CampaignCharacterState[];
  turnEncounters: TurnEncounter[];
  merchants: Merchant[];
  homebrewLinks: Array<{ id: string; homebrewContentId: string; homebrewContent: HomebrewContent }>;
  npcProfiles: NpcProfile[];
  noteDocuments: NoteDocument[];
};

type SaveSnapshot = {
  id: string;
  summary: string;
  campaignId: string | null;
  payloadJson: string;
  createdAt: string;
  user: User | null;
};

type CharacterOption = {
  id: string;
  russianName: string;
  englishName: string | null;
  sourceTitle: string;
  url: string | null;
  sourcePriority?: string;
  editionCompatibility?: string;
  reviewStatus?: string;
  isActive?: boolean;
  isReviewNeeded?: boolean;
};

type CharacterOptions = {
  classes: CharacterOption[];
  ancestries: CharacterOption[];
  backgrounds: CharacterOption[];
};

type SourceFilter = 'all' | 'active' | 'inactive' | 'homebrew' | 'core';

type NetworkInfo = {
  host: string;
  backendPort: number;
  frontendPort: number;
  lanAddresses: string[];
  localFrontendUrl: string;
  localBackendUrl: string;
  lanFrontendUrls: string[];
  lanBackendUrls: string[];
  participantStatuses: string[];
  realtimeEvents: string[];
};

type BootstrapData = {
  users: User[];
  settings: Setting[];
  sourceBooks: SourceBook[];
  characterOptions: CharacterOptions;
  campaigns: Campaign[];
  characters: Character[];
  campaignCharacterStates: CampaignCharacterState[];
  homebrewContents: HomebrewContent[];
  saveSnapshots: SaveSnapshot[];
};

type ApiState =
  | { status: 'loading' }
  | { status: 'ready'; data: BootstrapData; network: NetworkInfo | null; savedAt: Date | null }
  | { status: 'error'; message: string };

const menuItems: Array<{ id: Screen; title: string; hint: string }> = [
  { id: 'connect', title: 'Подключение к кампании', hint: 'Код мастера и выбор героя' },
  { id: 'create-character', title: 'Создать персонажа', hint: 'Новый герой в личной библиотеке' },
  { id: 'characters', title: 'Просмотр персонажей', hint: 'Библиотека героев и их листы' },
  { id: 'create-campaign', title: 'Создать кампанию', hint: 'Новая игра, сеттинг и источники' },
  { id: 'campaigns', title: 'Просмотр кампаний', hint: 'Комнаты, игроки и управление' },
  { id: 'homebrew', title: 'Хоумбрю', hint: 'Свои материалы и эффекты' },
  { id: 'settings', title: 'Настройки', hint: 'Сервер, сеть и профиль' },
];

const localProfilePasswords: Record<string, string> = {
  ERHA: import.meta.env.VITE_LOCAL_PLAYER_1_PASSWORD || 'demo',
  ERHACHECK: import.meta.env.VITE_LOCAL_PLAYER_2_PASSWORD || 'demo',
};
const localContactEmail = import.meta.env.VITE_LOCAL_CONTACT_EMAIL?.trim();

const abilityKeys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;

type AbilityKey = (typeof abilityKeys)[number];
type AbilityScores = Record<AbilityKey, number>;

type CharacterSheetDetails = {
  backgroundName: string;
  abilityScores: AbilityScores;
  skillProficiencies: string[];
  passiveFeatures: string;
};

type CharacterSheetDraft = {
  name: string;
  level: number;
  ancestry: string;
  className: string;
  portraitUrl: string;
  backgroundName: string;
  currentHp: number;
  maxHp: number;
  armorClass: number;
  speed: number;
  abilityScores: AbilityScores;
  skillProficiencies: string[];
  passiveFeatures: string;
};

type InventoryItemKind = 'weapon' | 'armor' | 'consumable' | 'tool' | 'treasure' | 'note';
type EquipmentSlot = 'mainHand' | 'offHand' | 'armor' | 'quick';

type InventoryItem = {
  id: string;
  name: string;
  kind: InventoryItemKind;
  quantity: number;
  weight: number;
  gpValue: number;
  damageDice: string;
  damageType: string;
  armorClass: number;
  proficient: boolean;
  equippedSlot: EquipmentSlot | null;
  notes: string;
};

type CharacterInventory = {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
  items: InventoryItem[];
};

type InventoryItemDraft = {
  name: string;
  kind: InventoryItemKind;
  quantity: number;
  weight: number;
  damageDice: string;
  damageType: string;
  armorClass: number;
  proficient: boolean;
  notes: string;
};

type InventoryCatalogItem = {
  id: string;
  name: string;
  kinds: InventoryItemKind[];
  weight: number;
  damageDice: string;
  damageType: string;
  armorClass: number;
  proficient: boolean;
  notes: string;
};

type Spell = {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  damage: string;
  healing: string;
  prepared: boolean;
  notes: string;
};

type SpellcastingState = {
  spellcastingAbility: string;
  spellSaveDc: number;
  spellAttackBonus: number;
  slots: Record<string, { max: number; current: number }>;
  resources: {
    primaryName: string;
    max: number;
    current: number;
  };
  spells: Spell[];
};

type RestType = 'short' | 'long';
type HomebrewKind = 'item' | 'weapon' | 'spell' | 'effect' | 'race' | 'rule';

type RestState = {
  hitDiceMax: number;
  hitDiceCurrent: number;
  hitDieSize: number;
  lastRestType: RestType | null;
  lastRestAt: string | null;
};

const defaultAbilityScores: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

const abilityLabels: Record<AbilityKey, string> = {
  strength: 'Сила',
  dexterity: 'Ловкость',
  constitution: 'Телосложение',
  intelligence: 'Интеллект',
  wisdom: 'Мудрость',
  charisma: 'Харизма',
};

const skillList: Array<{ id: string; title: string; ability: AbilityKey }> = [
  { id: 'acrobatics', title: 'Акробатика', ability: 'dexterity' },
  { id: 'animalHandling', title: 'Уход за животными', ability: 'wisdom' },
  { id: 'arcana', title: 'Магия', ability: 'intelligence' },
  { id: 'athletics', title: 'Атлетика', ability: 'strength' },
  { id: 'deception', title: 'Обман', ability: 'charisma' },
  { id: 'history', title: 'История', ability: 'intelligence' },
  { id: 'insight', title: 'Проницательность', ability: 'wisdom' },
  { id: 'intimidation', title: 'Запугивание', ability: 'charisma' },
  { id: 'investigation', title: 'Анализ', ability: 'intelligence' },
  { id: 'medicine', title: 'Медицина', ability: 'wisdom' },
  { id: 'nature', title: 'Природа', ability: 'intelligence' },
  { id: 'perception', title: 'Внимательность', ability: 'wisdom' },
  { id: 'performance', title: 'Выступление', ability: 'charisma' },
  { id: 'persuasion', title: 'Убеждение', ability: 'charisma' },
  { id: 'religion', title: 'Религия', ability: 'intelligence' },
  { id: 'sleightOfHand', title: 'Ловкость рук', ability: 'dexterity' },
  { id: 'stealth', title: 'Скрытность', ability: 'dexterity' },
  { id: 'survival', title: 'Выживание', ability: 'wisdom' },
];

const defaultInventory: CharacterInventory = {
  cp: 0,
  sp: 0,
  ep: 0,
  gp: 0,
  pp: 0,
  items: [],
};

const defaultInventoryItemDraft: InventoryItemDraft = {
  name: '',
  kind: 'weapon',
  quantity: 1,
  weight: 0,
  damageDice: '',
  damageType: '',
  armorClass: 10,
  proficient: true,
  notes: '',
};

const inventoryKindLabels: Record<InventoryItemKind, string> = {
  weapon: 'Оружие',
  armor: 'Доспех',
  consumable: 'Расходник',
  tool: 'Инструмент',
  treasure: 'Ценность',
  note: 'Запись',
};

const coinLabels: Record<'cp' | 'sp' | 'ep' | 'gp' | 'pp', string> = {
  cp: 'Медь',
  sp: 'Серебро',
  ep: 'Электрум',
  gp: 'Золото',
  pp: 'Платина',
};

const inventoryCatalog: InventoryCatalogItem[] = [
  {
    id: 'dagger',
    name: 'Кинжал',
    kinds: ['weapon'],
    weight: 1,
    damageDice: '1к4',
    damageType: 'колющий',
    armorClass: 0,
    proficient: true,
    notes: 'Легкое, метательное, фехтовальное.',
  },
  {
    id: 'longsword',
    name: 'Длинный меч',
    kinds: ['weapon'],
    weight: 3,
    damageDice: '1к8',
    damageType: 'рубящий',
    armorClass: 0,
    proficient: true,
    notes: 'Универсальное 1к10.',
  },
  {
    id: 'chain-mail',
    name: 'Кольчуга',
    kinds: ['armor'],
    weight: 55,
    damageDice: '',
    damageType: '',
    armorClass: 16,
    proficient: true,
    notes: 'Тяжелый доспех. Нужна Сила 13, помеха на скрытность.',
  },
  {
    id: 'healing-potion',
    name: 'Зелье лечения',
    kinds: ['consumable'],
    weight: 0.5,
    damageDice: '',
    damageType: '',
    armorClass: 0,
    proficient: true,
    notes: 'Лечение 2к4+2.',
  },
  {
    id: 'paper-sheet',
    name: 'Лист бумаги',
    kinds: ['note'],
    weight: 0,
    damageDice: '',
    damageType: '',
    armorClass: 0,
    proficient: true,
    notes: 'Запись или письмо.',
  },
  {
    id: 'salami',
    name: 'Салями',
    kinds: ['consumable', 'weapon'],
    weight: 1,
    damageDice: '1к4',
    damageType: 'дробящий',
    armorClass: 0,
    proficient: false,
    notes: 'Заглушка для предмета с несколькими типами.',
  },
];

const equipmentPreviewSlots = [
  { id: 'head', title: 'Голова', hint: 'шлем / капюшон' },
  { id: 'torso', title: 'Корпус', hint: 'броня / верхняя одежда' },
  { id: 'legs', title: 'Ноги', hint: 'штаны / поножи' },
  { id: 'feet', title: 'Ступни', hint: 'ботинки / сапоги' },
  { id: 'ring-left', title: 'Кольцо I', hint: 'заглушка слота' },
  { id: 'ring-right', title: 'Кольцо II', hint: 'заглушка слота' },
  { id: 'neck', title: 'Шея', hint: 'амулет / ожерелье' },
  { id: 'hands', title: 'Руки', hint: 'оружие / щит' },
];

const equipmentSlotLabels: Record<EquipmentSlot, string> = {
  mainHand: 'Основная рука',
  offHand: 'Вторая рука',
  armor: 'Доспех',
  quick: 'Быстрый слот',
};

const defaultSpellSlots = Object.fromEntries(
  Array.from({ length: 9 }, (_, index) => {
    const level = String(index + 1);
    return [level, { max: level === '1' ? 2 : 0, current: level === '1' ? 2 : 0 }];
  }),
) as SpellcastingState['slots'];

const defaultSpellcasting: SpellcastingState = {
  spellcastingAbility: 'Интеллект',
  spellSaveDc: 10,
  spellAttackBonus: 2,
  slots: defaultSpellSlots,
  resources: {
    primaryName: 'Классовый ресурс',
    max: 1,
    current: 1,
  },
  spells: [],
};

const testSpellReferences: Spell[] = [
  {
    id: 'ref-fire-bolt',
    name: 'Огненный снаряд',
    level: 0,
    school: 'Воплощение',
    castingTime: '1 действие',
    range: '120 фт.',
    duration: 'Мгновенная',
    components: 'В, С',
    damage: '1к10 огонь',
    healing: '',
    prepared: true,
    notes: 'Тестовый заговор. Не тратит ячейку.',
  },
  {
    id: 'ref-magic-missile',
    name: 'Волшебная стрела',
    level: 1,
    school: 'Воплощение',
    castingTime: '1 действие',
    range: '120 фт.',
    duration: 'Мгновенная',
    components: 'В, С',
    damage: '3 x 1к4+1 силовой',
    healing: '',
    prepared: true,
    notes: 'Тестовое заклинание 1 уровня. Тратит ячейку.',
  },
  {
    id: 'ref-cure-wounds',
    name: 'Лечение ран',
    level: 1,
    school: 'Воплощение',
    castingTime: '1 действие',
    range: 'Касание',
    duration: 'Мгновенная',
    components: 'В, С',
    damage: '',
    healing: '1к8 + модификатор',
    prepared: true,
    notes: 'Тестовое лечение 1 уровня.',
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getConnectionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    joined: 'В комнате',
    online: 'В сети',
    offline: 'Не в сети',
    left: 'Вышел',
    reconnecting: 'Переподключается',
  };

  return labels[status] ?? status;
}

function getRealtimeStatusLabel(status: 'offline' | 'connecting' | 'online' | 'error') {
  const labels = {
    offline: 'Realtime: нет соединения',
    connecting: 'Realtime: подключение',
    online: 'Realtime: активно',
    error: 'Realtime: ошибка',
  };

  return labels[status];
}

function getRealtimeEventLabel(event: RealtimeEvent | null) {
  if (!event) {
    return 'Событий пока нет';
  }

  const labels: Record<RealtimeEvent['type'], string> = {
    'room:connected': 'Канал комнаты подключен',
    'room:joined': 'Игрок вошел в комнату',
    'room:left': 'Игрок вышел из комнаты',
    'room:participant-status': 'Обновлен статус игрока',
    'character:hp-updated': 'Обновлены HP персонажа',
    'campaign:snapshot-created': 'Создано автосохранение',
    'turn:updated': 'Походовая сцена обновлена',
    'room:refreshed': 'Комната обновлена',
    error: 'Ошибка realtime',
  };

  return labels[event.type];
}

function getEditionLabel(value: string) {
  const labels: Record<string, string> = {
    '5e_2014': '5e 2014',
    '5e_2024': '5e 2024',
    universal_5e_2014_2024: '5e 2014/2024',
    unknown: 'материал dnd.su',
    conflict: 'смешанный материал dnd.su',
  };

  return labels[value] ?? value;
}

function getQualityLabel(value: string) {
  const labels: Record<string, string> = {
    verified: 'проверен',
    site: 'каталог сайта',
    site_needs_review: 'каталог сайта',
    low_quality_photo: 'каталог сайта',
    unknown: 'каталог сайта',
  };

  return labels[value] ?? value;
}

function getSourceFilterLabel(filter: SourceFilter) {
  const labels: Record<SourceFilter, string> = {
    all: 'Все',
    active: 'Активные',
    inactive: 'Выключенные',
    homebrew: 'Хоумбрю (Homebrew) из dnd.su',
    core: 'Базовые',
  };

  return labels[filter];
}

function isHomebrewSource(sourceBook: SourceBook) {
  return /homebrew|хоумбрю/i.test(
    `${sourceBook.titleOriginal ?? ''} ${sourceBook.titleRu} ${sourceBook.sourceType} ${sourceBook.notes ?? ''}`,
  );
}

function fieldClass(value: string | number | null | undefined, extra = '') {
  const filled = value !== null && value !== undefined && String(value).trim().length > 0;
  return ['field', filled ? 'filled-field' : '', extra].filter(Boolean).join(' ');
}

function getRoomOverrideLabel(value: boolean | null) {
  if (value === true) {
    return 'Включить в комнате';
  }

  if (value === false) {
    return 'Выключить в комнате';
  }

  return 'Наследовать кампанию';
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampDecimal(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

function isInventoryItemKind(value: unknown): value is InventoryItemKind {
  return typeof value === 'string' && value in inventoryKindLabels;
}

function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return typeof value === 'string' && value in equipmentSlotLabels;
}

function createInventoryItem(draft: InventoryItemDraft): InventoryItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: draft.name.trim() || 'Предмет',
    kind: draft.kind,
    quantity: clampNumber(draft.quantity, 1, 9999),
    weight: clampDecimal(draft.weight, 0, 9999),
    gpValue: 0,
    damageDice: draft.damageDice.trim(),
    damageType: draft.damageType.trim(),
    armorClass: clampNumber(draft.armorClass, 0, 40),
    proficient: draft.proficient,
    equippedSlot: null,
    notes: draft.notes.trim(),
  };
}

function normalizeInventoryItem(value: unknown): InventoryItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Partial<InventoryItem>;
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) {
    return null;
  }

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    kind: isInventoryItemKind(item.kind) ? item.kind : 'note',
    quantity: clampNumber(Number(item.quantity), 1, 9999),
    weight: clampDecimal(Number(item.weight), 0, 9999),
    gpValue: clampDecimal(Number(item.gpValue), 0, 999999),
    damageDice: typeof item.damageDice === 'string' ? item.damageDice : '',
    damageType: typeof item.damageType === 'string' ? item.damageType : '',
    armorClass: clampNumber(Number(item.armorClass), 0, 40),
    proficient: item.proficient === true,
    equippedSlot: isEquipmentSlot(item.equippedSlot) ? item.equippedSlot : null,
    notes: typeof item.notes === 'string' ? item.notes : '',
  };
}

function parseInventory(inventoryJson?: string | null): CharacterInventory {
  if (!inventoryJson) {
    return defaultInventory;
  }

  try {
    const parsed = JSON.parse(inventoryJson) as unknown;
    const source: Partial<CharacterInventory> = Array.isArray(parsed)
      ? { items: parsed as InventoryItem[] }
      : parsed && typeof parsed === 'object'
        ? (parsed as Partial<CharacterInventory>)
        : {};
    const items = Array.isArray(source.items) ? source.items.map(normalizeInventoryItem).filter((item): item is InventoryItem => item !== null) : [];

    return {
      cp: clampNumber(Number(source.cp), 0, 999999),
      sp: clampNumber(Number(source.sp), 0, 999999),
      ep: clampNumber(Number(source.ep), 0, 999999),
      gp: clampNumber(Number(source.gp), 0, 999999),
      pp: clampNumber(Number(source.pp), 0, 999999),
      items,
    };
  } catch {
    return defaultInventory;
  }
}

function getInventoryWeight(inventory: CharacterInventory) {
  return inventory.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
}

function getInventoryItemBasePrice(item: InventoryItem) {
  if (item.gpValue > 0) {
    return item.gpValue;
  }

  if (item.kind === 'weapon') {
    return 5;
  }
  if (item.kind === 'armor') {
    return 10;
  }
  if (item.kind === 'consumable') {
    return 2;
  }
  if (item.kind === 'treasure') {
    return 25;
  }
  return 1;
}

function getInventoryItemPrice(item: InventoryItem, multiplier = 1) {
  return Math.max(1, Math.ceil(getInventoryItemBasePrice(item) * multiplier));
}

function getActiveWeapon(inventory: CharacterInventory) {
  return inventory.items.find((item) => item.kind === 'weapon' && item.equippedSlot === 'mainHand') ?? null;
}

function getInventoryCatalogDraft(reference: InventoryCatalogItem, kind: InventoryItemKind = reference.kinds[0]): InventoryItemDraft {
  const isWeaponMode = kind === 'weapon';

  return {
    name: reference.name,
    kind,
    quantity: 1,
    weight: reference.weight,
    damageDice: isWeaponMode ? reference.damageDice : '',
    damageType: isWeaponMode ? reference.damageType : '',
    armorClass: kind === 'armor' ? reference.armorClass : 0,
    proficient: reference.proficient,
    notes: reference.notes,
  };
}

function getSafeText(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed && !/\?{3,}/.test(trimmed) ? trimmed : fallback;
}

function getCampaignDisplayName(campaign: Pick<Campaign, 'name'>) {
  return /тест\s+инвентар/i.test(campaign.name) ? 'Кампания мастера' : campaign.name;
}

function getActiveTurnParticipants(participants: TurnParticipant[]) {
  return participants
    .filter((participant) => participant.isActive)
    .sort((left, right) => left.turnOrder - right.turnOrder || right.initiative - left.initiative || left.name.localeCompare(right.name));
}

function getCurrentTurnParticipant(encounter: TurnEncounter | null) {
  if (!encounter) {
    return null;
  }

  const activeParticipants = getActiveTurnParticipants(encounter.participants);
  return activeParticipants[Math.min(encounter.currentTurnIndex, Math.max(0, activeParticipants.length - 1))] ?? null;
}

function getTurnParticipantPassiveFeatures(participant: TurnParticipant) {
  const sheetJson = participant.characterState?.sheetJson;
  if (!sheetJson) {
    return '';
  }

  return parseSheetDetails(sheetJson).passiveFeatures.trim();
}

function getTurnResourceLabel(resource: 'action' | 'bonusAction' | 'reaction' | 'movement') {
  const labels = {
    action: 'Действие',
    bonusAction: 'Бонус',
    reaction: 'Реакция',
    movement: 'Движение',
  };
  return labels[resource];
}

function normalizeSpell(value: unknown): Spell | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const spell = value as Partial<Spell>;
  const name = typeof spell.name === 'string' ? spell.name.trim() : '';
  if (!name) {
    return null;
  }

  return {
    id: typeof spell.id === 'string' && spell.id ? spell.id : `spell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    level: clampNumber(Number(spell.level), 0, 9),
    school: typeof spell.school === 'string' ? spell.school : '',
    castingTime: typeof spell.castingTime === 'string' ? spell.castingTime : '',
    range: typeof spell.range === 'string' ? spell.range : '',
    duration: typeof spell.duration === 'string' ? spell.duration : '',
    components: typeof spell.components === 'string' ? spell.components : '',
    damage: typeof spell.damage === 'string' ? spell.damage : '',
    healing: typeof spell.healing === 'string' ? spell.healing : '',
    prepared: spell.prepared !== false,
    notes: typeof spell.notes === 'string' ? spell.notes : '',
  };
}

function parseSpellcasting(sheetJson?: string | null): SpellcastingState {
  if (!sheetJson) {
    return defaultSpellcasting;
  }

  try {
    const parsed = JSON.parse(sheetJson) as { spellcasting?: Partial<SpellcastingState> };
    const source = parsed.spellcasting ?? {};
    const slots = { ...defaultSpellSlots };
    if (source.slots && typeof source.slots === 'object') {
      for (let level = 1; level <= 9; level += 1) {
        const key = String(level);
        const rawSlot = source.slots[key];
        const max = clampNumber(Number(rawSlot?.max), 0, 99);
        slots[key] = {
          max,
          current: clampNumber(Number(rawSlot?.current), 0, max),
        };
      }
    }

    const resourceMax = clampNumber(Number(source.resources?.max), 0, 99);

    return {
      spellcastingAbility: typeof source.spellcastingAbility === 'string' ? source.spellcastingAbility : defaultSpellcasting.spellcastingAbility,
      spellSaveDc: clampNumber(Number(source.spellSaveDc), 0, 40),
      spellAttackBonus: clampNumber(Number(source.spellAttackBonus), -20, 40),
      slots,
      resources: {
        primaryName: typeof source.resources?.primaryName === 'string' ? source.resources.primaryName : defaultSpellcasting.resources.primaryName,
        max: resourceMax,
        current: clampNumber(Number(source.resources?.current), 0, resourceMax),
      },
      spells: Array.isArray(source.spells) ? source.spells.map(normalizeSpell).filter((spell): spell is Spell => spell !== null) : [],
    };
  } catch {
    return defaultSpellcasting;
  }
}

function parseRestState(sheetJson: string | null | undefined, level: number): RestState {
  const fallbackMax = clampNumber(level, 1, 40);

  if (!sheetJson) {
    return {
      hitDiceMax: fallbackMax,
      hitDiceCurrent: fallbackMax,
      hitDieSize: 8,
      lastRestType: null,
      lastRestAt: null,
    };
  }

  try {
    const parsed = JSON.parse(sheetJson) as { rest?: Partial<RestState> };
    const rest = parsed.rest ?? {};
    const hitDiceMax = clampNumber(Number(rest.hitDiceMax ?? fallbackMax), 1, 40);
    const rawLastRestType = rest.lastRestType;

    return {
      hitDiceMax,
      hitDiceCurrent: clampNumber(Number(rest.hitDiceCurrent ?? hitDiceMax), 0, hitDiceMax),
      hitDieSize: clampNumber(Number(rest.hitDieSize ?? 8), 4, 12),
      lastRestType: rawLastRestType === 'short' || rawLastRestType === 'long' ? rawLastRestType : null,
      lastRestAt: typeof rest.lastRestAt === 'string' ? rest.lastRestAt : null,
    };
  } catch {
    return {
      hitDiceMax: fallbackMax,
      hitDiceCurrent: fallbackMax,
      hitDieSize: 8,
      lastRestType: null,
      lastRestAt: null,
    };
  }
}

function getAverageHitDieHealing(hitDieSize: number) {
  return Math.max(1, Math.floor(hitDieSize / 2) + 1);
}

function getRestTypeLabel(type: RestType) {
  return type === 'short' ? 'Короткий отдых' : 'Длинный отдых';
}

function getTheftStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'ожидает',
    approved: 'одобрено',
    rejected: 'отклонено',
  };

  return labels[status] ?? status;
}

function parseHomebrewPayload(payloadJson?: string | null) {
  try {
    const parsed = payloadJson ? JSON.parse(payloadJson) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function getHomebrewKindLabel(kind: string) {
  const labels: Record<string, string> = {
    item: 'Предмет',
    weapon: 'Оружие',
    spell: 'Заклинание',
    effect: 'Эффект',
    race: 'Раса / происхождение',
    rule: 'Правило',
  };

  return labels[kind] ?? kind;
}

function parseNpcStats(statJson?: string | null) {
  try {
    const parsed = statJson ? JSON.parse(statJson) : {};
    const source = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    return {
      armorClass: clampNumber(Number(source.armorClass ?? 10), 1, 30),
      currentHp: clampNumber(Number(source.currentHp ?? 8), 1, 999),
      maxHp: clampNumber(Number(source.maxHp ?? source.currentHp ?? 8), 1, 999),
      speed: clampNumber(Number(source.speed ?? 30), 0, 120),
      challenge: typeof source.challenge === 'string' ? source.challenge : '0',
      role: typeof source.role === 'string' ? source.role : 'NPC',
    };
  } catch {
    return { armorClass: 10, currentHp: 8, maxHp: 8, speed: 30, challenge: '0', role: 'NPC' };
  }
}

function parseDocumentDrawing(drawingJson?: string | null) {
  try {
    const parsed = drawingJson ? JSON.parse(drawingJson) : [];
    return Array.isArray(parsed) ? parsed.filter((path): path is string => typeof path === 'string') : [];
  } catch {
    return [];
  }
}

function parseDocumentHistory(historyJson?: string | null) {
  try {
    const parsed = historyJson ? JSON.parse(historyJson) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createSpellFromReference(reference: Spell): Spell {
  return {
    ...reference,
    id: `spell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function getSpellLevelLabel(level: number) {
  return level === 0 ? 'Заговор' : `${level} уровень`;
}

function parseActionPayload(payloadJson?: string | null) {
  if (!payloadJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getActionKindLabel(snapshot: SaveSnapshot) {
  const payload = parseActionPayload(snapshot.payloadJson);
  const labels: Record<string, string> = {
    'spell-cast': 'Заклинание',
    'item-transfer': 'Передача',
    'inventory-update': 'Инвентарь',
    'hp-update': 'HP',
    rest: 'Отдых',
    'trade-buy': 'Покупка',
    'trade-sell': 'Продажа',
    'theft-resolve': 'Кража',
    undo: 'Откат',
  };

  return labels[String(payload.actionType ?? '')] ?? 'Событие';
}

function canUndoAction(snapshot: SaveSnapshot) {
  const payload = parseActionPayload(snapshot.payloadJson);
  return ['spell-cast', 'item-transfer'].includes(String(payload.actionType ?? '')) && payload.reverted !== true;
}

function isRevertedAction(snapshot: SaveSnapshot) {
  return parseActionPayload(snapshot.payloadJson).reverted === true;
}

function getModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function formatModifier(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function getProficiencyBonus(level: number) {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

function getSkillBonus(draft: CharacterSheetDraft, skillId: string, ability: AbilityKey) {
  return getModifier(draft.abilityScores[ability]) + (draft.skillProficiencies.includes(skillId) ? getProficiencyBonus(draft.level) : 0);
}

function parseSheetDetails(sheetJson?: string | null): CharacterSheetDetails {
  if (!sheetJson) {
    return {
      backgroundName: '',
      abilityScores: defaultAbilityScores,
      skillProficiencies: [],
      passiveFeatures: '',
    };
  }

  try {
    const parsed = JSON.parse(sheetJson) as Partial<CharacterSheetDetails>;
    const abilityScores = { ...defaultAbilityScores };
    if (parsed.abilityScores && typeof parsed.abilityScores === 'object') {
      for (const key of abilityKeys) {
        const score = Number((parsed.abilityScores as Partial<Record<AbilityKey, number>>)[key]);
        abilityScores[key] = clampNumber(score || defaultAbilityScores[key], 1, 30);
      }
    }

    return {
      backgroundName: typeof parsed.backgroundName === 'string' ? parsed.backgroundName : '',
      abilityScores,
      skillProficiencies: Array.isArray(parsed.skillProficiencies)
        ? parsed.skillProficiencies.filter((skill): skill is string => typeof skill === 'string')
        : [],
      passiveFeatures: typeof parsed.passiveFeatures === 'string' ? parsed.passiveFeatures : '',
    };
  } catch {
    return {
      backgroundName: '',
      abilityScores: defaultAbilityScores,
      skillProficiencies: [],
      passiveFeatures: '',
    };
  }
}

function getOptionHint(options: CharacterOption[], value: string) {
  const normalized = value.trim().toLocaleLowerCase('ru-RU');
  const option = options.find((item) => item.russianName.toLocaleLowerCase('ru-RU') === normalized || item.englishName?.toLocaleLowerCase('ru-RU') === normalized);
  if (!option) {
    return 'ручное значение';
  }

  const state = option.isActive === false ? ' · неактивный источник' : '';
  return `${option.sourceTitle}${option.englishName ? ` · ${option.englishName}` : ''}${state}`;
}

function createDraftFromCharacter(character: Character): CharacterSheetDraft {
  const details = parseSheetDetails(character.sheetState?.sheetJson);
  return {
    name: character.name,
    level: character.level,
    ancestry: character.ancestry ?? '',
    className: character.className ?? '',
    portraitUrl: character.portraitUrl ?? '',
    backgroundName: details.backgroundName,
    currentHp: character.sheetState?.currentHp ?? 10,
    maxHp: character.sheetState?.maxHp ?? 10,
    armorClass: character.sheetState?.armorClass ?? 10,
    speed: character.sheetState?.speed ?? 30,
    abilityScores: details.abilityScores,
    skillProficiencies: details.skillProficiencies,
    passiveFeatures: details.passiveFeatures,
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>(() => (window.localStorage.getItem('dnd:remember-profile') ? 'main-menu' : 'connect'));
  const [selectedUserId, setSelectedUserId] = useState(() => window.localStorage.getItem('dnd:last-user-id') ?? 'local-player-1');
  const [isProfileUnlocked, setIsProfileUnlocked] = useState(() => window.localStorage.getItem('dnd:remember-profile') === '1');
  const [loginName, setLoginName] = useState(() => window.localStorage.getItem('dnd:last-login') ?? '');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberProfile, setRememberProfile] = useState(() => window.localStorage.getItem('dnd:remember-profile') === '1');
  const [showAccountReason, setShowAccountReason] = useState(false);
  const [apiState, setApiState] = useState<ApiState>({ status: 'loading' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'offline' | 'connecting' | 'online' | 'error'>('offline');
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<RealtimeEvent | null>(null);

  const [connectCode, setConnectCode] = useState('');
  const [connectCharacterId, setConnectCharacterId] = useState('');

  const [characterName, setCharacterName] = useState('Новый герой');
  const [characterAncestry, setCharacterAncestry] = useState('Человек');
  const [characterClass, setCharacterClass] = useState('Воин');
  const [characterBackground, setCharacterBackground] = useState('Народный герой');
  const [characterPortraitUrl, setCharacterPortraitUrl] = useState('');
  const [createdCharacter, setCreatedCharacter] = useState<Character | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [characterView, setCharacterView] = useState<'library' | string>('library');
  const [sheetDraft, setSheetDraft] = useState<CharacterSheetDraft | null>(null);
  const [inventoryDraft, setInventoryDraft] = useState<CharacterInventory>(defaultInventory);
  const [newItemDraft, setNewItemDraft] = useState<InventoryItemDraft>(
    inventoryCatalog[0] ? getInventoryCatalogDraft(inventoryCatalog[0]) : defaultInventoryItemDraft,
  );
  const [selectedInventoryCatalogId, setSelectedInventoryCatalogId] = useState(inventoryCatalog[0]?.id ?? '');
  const [transferTargetCharacterId, setTransferTargetCharacterId] = useState('');
  const [spellcastingDraft, setSpellcastingDraft] = useState<SpellcastingState>(defaultSpellcasting);
  const [selectedSpellReferenceId, setSelectedSpellReferenceId] = useState(testSpellReferences[0].id);
  const [deleteCharacterId, setDeleteCharacterId] = useState<string | null>(null);
  const [deleteCharacterArmed, setDeleteCharacterArmed] = useState(false);
  const [deleteCharacterText, setDeleteCharacterText] = useState('');

  const [campaignName, setCampaignName] = useState('Новая кампания');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignSettingId, setCampaignSettingId] = useState('');
  const [includeSettingDlc, setIncludeSettingDlc] = useState(true);
  const [includeHomebrewDlc, setIncludeHomebrewDlc] = useState(false);
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [campaignInspect, setCampaignInspect] = useState<'players' | 'characters'>('characters');
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showInactiveCharacterOptions, setShowInactiveCharacterOptions] = useState(false);
  const [contextCharacterOptions, setContextCharacterOptions] = useState<CharacterOptions | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);
  const [deleteCampaignArmed, setDeleteCampaignArmed] = useState(false);
  const [deleteCampaignText, setDeleteCampaignText] = useState('');
  const [turnNpcName, setTurnNpcName] = useState('Скелет');
  const [turnNpcInitiative, setTurnNpcInitiative] = useState(8);
  const [turnEffectName, setTurnEffectName] = useState('Благословение');
  const [turnEffectRounds, setTurnEffectRounds] = useState(1);
  const [turnEffectParticipantId, setTurnEffectParticipantId] = useState('');
  const [restType, setRestType] = useState<RestType>('short');
  const [restHitDiceByCharacter, setRestHitDiceByCharacter] = useState<Record<string, number>>({});
  const [merchantName, setMerchantName] = useState('Лавочник');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [merchantCatalogItemId, setMerchantCatalogItemId] = useState(inventoryCatalog[0]?.id ?? '');
  const [merchantItemPrice, setMerchantItemPrice] = useState(5);
  const [merchantItemQuantity, setMerchantItemQuantity] = useState(1);
  const [merchantTheftNotes, setMerchantTheftNotes] = useState('');
  const [homebrewName, setHomebrewName] = useState('Сияющий клинок');
  const [homebrewKind, setHomebrewKind] = useState<HomebrewKind>('weapon');
  const [homebrewDamageDice, setHomebrewDamageDice] = useState('2к4+3');
  const [homebrewDamageType, setHomebrewDamageType] = useState('излучение');
  const [homebrewDurationRounds, setHomebrewDurationRounds] = useState(10);
  const [homebrewTargetStateId, setHomebrewTargetStateId] = useState('');
  const [selectedHomebrewIds, setSelectedHomebrewIds] = useState<string[]>([]);
  const [selectedHomebrewCampaignIds, setSelectedHomebrewCampaignIds] = useState<string[]>([]);
  const [npcName, setNpcName] = useState('Городской стражник');
  const [selectedNpcId, setSelectedNpcId] = useState('');
  const [npcTheftNotes, setNpcTheftNotes] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Записка');
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [documentTextDraft, setDocumentTextDraft] = useState('');
  const [documentDrawingDraft, setDocumentDrawingDraft] = useState<string[]>([]);
  const [activeDrawingPath, setActiveDrawingPath] = useState('');

  const data = apiState.status === 'ready' ? apiState.data : null;
  const network = apiState.status === 'ready' ? apiState.network : null;
  const savedAt = apiState.status === 'ready' ? apiState.savedAt : null;
  const rawCharacterOptions = data?.characterOptions ?? { classes: [], ancestries: [], backgrounds: [] };
  const selectedUser = data?.users.find((user) => user.id === selectedUserId) ?? null;
  const playerUsers = data?.users.filter((user) => user.defaultRole === 'player') ?? [];
  const masterUser = data?.users.find((user) => user.defaultRole === 'master') ?? null;
  const userCharacters = data?.characters.filter((character) => character.ownerId === selectedUserId) ?? [];
  const selectedCharacter =
    data?.characters.find((character) => character.id === selectedCharacterId) ?? userCharacters[0] ?? null;
  const selectedCharacterStates =
    data?.campaignCharacterStates.filter((state) => state.characterId === selectedCharacter?.id) ?? [];
  const viewedCampaignState =
    characterView === 'library'
      ? null
      : selectedCharacterStates.find((state) => state.campaignId === characterView) ?? null;
  const activeCampaign =
    data?.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? data?.campaigns[0] ?? null;
  const activeRoom = activeCampaign?.rooms.find((room) => room.status === 'open') ?? activeCampaign?.rooms[0] ?? null;
  const activeTurnEncounter = activeCampaign?.turnEncounters.find((encounter) => encounter.status === 'active') ?? null;
  const activeMerchant =
    activeCampaign?.merchants.find((merchant) => merchant.id === selectedMerchantId) ?? activeCampaign?.merchants[0] ?? null;
  const activeMerchantInventory = parseInventory(activeMerchant?.inventoryJson);
  const activeBuyerState =
    activeCampaign?.characterStates.find((state) => state.id === activeMerchant?.activeBuyerStateId) ??
    activeCampaign?.characterStates[0] ??
    null;
  const activeHomebrewTargetState =
    activeCampaign?.characterStates.find((state) => state.id === homebrewTargetStateId) ??
    activeCampaign?.characterStates[0] ??
    null;
  const masterHomebrewContents = data?.homebrewContents.filter((content) => !masterUser || !content.ownerId || content.ownerId === masterUser.id) ?? [];
  const activeBuyerInventory = parseInventory(activeBuyerState?.inventoryJson);
  const selectedMerchantCatalogItem =
    inventoryCatalog.find((item) => item.id === merchantCatalogItemId) ?? inventoryCatalog[0] ?? null;
  const activeNpc =
    activeCampaign?.npcProfiles.find((npc) => npc.id === selectedNpcId) ??
    activeCampaign?.npcProfiles.find((npc) => npc.isActive) ??
    activeCampaign?.npcProfiles[0] ??
    null;
  const activeDocument =
    activeCampaign?.noteDocuments.find((document) => document.id === selectedDocumentId) ??
    activeCampaign?.noteDocuments[0] ??
    null;
  const activeNpcInventory = parseInventory(activeNpc?.inventoryJson);
  const activeNpcStats = parseNpcStats(activeNpc?.statJson);
  const activeTurnParticipants = activeTurnEncounter ? getActiveTurnParticipants(activeTurnEncounter.participants) : [];
  const currentTurnParticipant = getCurrentTurnParticipant(activeTurnEncounter);
  const characterOptions = contextCharacterOptions ?? rawCharacterOptions;
  const activeRoomParticipants = activeRoom?.participants ?? [];
  const currentUserRoomParticipant =
    activeRoomParticipants.find((participant) => participant.user.id === selectedUserId && participant.status !== 'left') ?? null;
  const playerCharacterId = currentUserRoomParticipant?.character?.id ?? selectedCharacter?.id ?? null;
  const playerCampaignState =
    activeCampaign?.characterStates.find((state) => state.characterId === playerCharacterId) ??
    (playerCharacterId ? data?.campaignCharacterStates.find((state) => state.characterId === playerCharacterId) : null) ??
    null;
  const playerSheetDetails = parseSheetDetails(playerCampaignState?.sheetJson ?? selectedCharacter?.sheetState?.sheetJson);
  const playerInventory = parseInventory(playerCampaignState?.inventoryJson);
  const playerInventoryWeight = getInventoryWeight(playerInventory);
  const playerEquipmentItems = playerInventory.items.filter((item) => item.equippedSlot);
  const playerQuickItems = playerInventory.items.filter((item) => item.equippedSlot === 'quick' || item.kind === 'consumable').slice(0, 8);
  const playerWeapon = getActiveWeapon(playerInventory);
  const onlineParticipantCount = activeRoomParticipants.filter((participant) => participant.status === 'online').length;
  const enabledSourceCount = activeCampaign?.sourceBooks.filter((link) => link.isEnabled).length ?? 0;
  const currentFrontendPort = window.location.port || String(network?.frontendPort ?? 5173);
  const primaryLanUrl = network?.lanAddresses[0]
    ? `${window.location.protocol}//${network.lanAddresses[0]}:${currentFrontendPort}`
    : network?.localFrontendUrl ?? `${window.location.protocol}//${window.location.hostname}:${currentFrontendPort}`;
  const visibleLanUrls = network?.lanAddresses.length
    ? network.lanAddresses.map((address) => `${window.location.protocol}//${address}:${currentFrontendPort}`)
    : [primaryLanUrl];
  const realtimeUserId = activeRoomParticipants.some((participant) => participant.user.id === selectedUserId)
    ? selectedUserId
    : masterUser?.id ?? selectedUserId;
  const activeWeapon = getActiveWeapon(inventoryDraft);
  const inventoryWeight = getInventoryWeight(inventoryDraft);
  const selectedInventoryCatalogItem =
    inventoryCatalog.find((item) => item.id === selectedInventoryCatalogId) ?? inventoryCatalog[0] ?? null;
  const inventoryKindOptions = selectedInventoryCatalogItem?.kinds ?? (Object.keys(inventoryKindLabels) as InventoryItemKind[]);
  const isInventoryKindLocked = inventoryKindOptions.length === 1;
  const cantrips = spellcastingDraft.spells.filter((spell) => spell.level === 0);
  const leveledSpells = spellcastingDraft.spells.filter((spell) => spell.level > 0);
  const activeCampaignActions = data?.saveSnapshots.filter((snapshot) => snapshot.campaignId === activeCampaign?.id) ?? [];
  const transferTargets = useMemo(
    () => activeCampaign?.characterStates.filter((state) => state.characterId !== viewedCampaignState?.characterId) ?? [],
    [activeCampaign?.characterStates, viewedCampaignState?.characterId],
  );
  const filteredSourceLinks = useMemo(() => {
    const normalizedQuery = sourceQuery.trim().toLocaleLowerCase('ru-RU');

    return (activeCampaign?.sourceBooks ?? []).filter((link) => {
      const sourceBook = link.sourceBook;
      const roomOverride = activeRoom?.sourceOverrides.find((override) => override.sourceBook.id === sourceBook.id);
      const effectiveEnabled = roomOverride?.isEnabled ?? link.isEnabled;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        sourceBook.titleRu.toLocaleLowerCase('ru-RU').includes(normalizedQuery) ||
        sourceBook.titleOriginal?.toLocaleLowerCase('ru-RU').includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      if (sourceFilter === 'active') {
        return effectiveEnabled;
      }

      if (sourceFilter === 'inactive') {
        return !effectiveEnabled;
      }

      if (sourceFilter === 'homebrew') {
        return isHomebrewSource(sourceBook);
      }

      if (sourceFilter === 'core') {
        return sourceBook.isCore;
      }

      return true;
    });
  }, [activeCampaign?.sourceBooks, activeRoom?.sourceOverrides, sourceFilter, sourceQuery]);

  async function refresh(signal?: AbortSignal, savedAt: Date | null = null) {
    const [bootstrap, networkInfo] = await Promise.all([
      getJson<BootstrapData>('/api/bootstrap', signal),
      getJson<NetworkInfo>('/api/network/info', signal).catch(() => null),
    ]);
    setApiState({ status: 'ready', data: bootstrap, network: networkInfo, savedAt });

    if (!selectedCampaignId && bootstrap.campaigns[0]) {
      setSelectedCampaignId(bootstrap.campaigns[0].id);
    }

    const firstUserCharacter = bootstrap.characters.find((character) => character.ownerId === selectedUserId);
    if (!selectedCharacterId && firstUserCharacter) {
      setSelectedCharacterId(firstUserCharacter.id);
      setConnectCharacterId(firstUserCharacter.id);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setApiState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Сервер не ответил на запрос.',
        });
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!activeCampaign) {
      setContextCharacterOptions(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      campaignId: activeCampaign.id,
      showInactive: String(showInactiveCharacterOptions),
    });

    if (activeRoom) {
      params.set('roomId', activeRoom.id);
    }

    getJson<CharacterOptions>(`/api/rules/character-options?${params.toString()}`, controller.signal)
      .then(setContextCharacterOptions)
      .catch(() => {
        if (!controller.signal.aborted) {
          setContextCharacterOptions(null);
        }
      });

    return () => controller.abort();
  }, [activeCampaign?.id, activeRoom?.id, showInactiveCharacterOptions]);

  useEffect(() => {
    if (userCharacters.length > 0 && !userCharacters.some((character) => character.id === connectCharacterId)) {
      setConnectCharacterId(userCharacters[0].id);
    }
    if (userCharacters.length > 0 && !userCharacters.some((character) => character.id === selectedCharacterId)) {
      setSelectedCharacterId(userCharacters[0].id);
    }
  }, [connectCharacterId, selectedCharacterId, userCharacters]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (screen === 'characters' && userCharacters.length === 0) {
      setScreen('create-character');
    }

    if (screen === 'campaigns' && data.campaigns.length === 0) {
      setScreen('create-campaign');
    }
  }, [data, screen, userCharacters.length]);

  useEffect(() => {
    if (screen !== 'create-campaign') {
      setCreatedCampaign(null);
    }
  }, [screen]);

  useEffect(() => {
    if (activeCampaign?.merchants.length && !activeCampaign.merchants.some((merchant) => merchant.id === selectedMerchantId)) {
      setSelectedMerchantId(activeCampaign.merchants[0].id);
    }
    if (activeCampaign?.characterStates.length && !activeCampaign.characterStates.some((state) => state.id === homebrewTargetStateId)) {
      setHomebrewTargetStateId(activeCampaign.characterStates[0].id);
    }
    if (activeCampaign?.npcProfiles.length && !activeCampaign.npcProfiles.some((npc) => npc.id === selectedNpcId)) {
      setSelectedNpcId(activeCampaign.npcProfiles.find((npc) => npc.isActive)?.id ?? activeCampaign.npcProfiles[0].id);
    }
    if (activeCampaign?.noteDocuments.length && !activeCampaign.noteDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(activeCampaign.noteDocuments[0].id);
    }
  }, [
    activeCampaign?.id,
    activeCampaign?.merchants,
    activeCampaign?.characterStates,
    activeCampaign?.npcProfiles,
    activeCampaign?.noteDocuments,
    homebrewTargetStateId,
    selectedMerchantId,
    selectedDocumentId,
    selectedNpcId,
  ]);

  useEffect(() => {
    setDocumentTitle(activeDocument?.title ?? 'Записка');
    setDocumentTextDraft(activeDocument?.textContent ?? '');
    setDocumentDrawingDraft(parseDocumentDrawing(activeDocument?.drawingJson));
  }, [activeDocument?.id, activeDocument?.title, activeDocument?.textContent, activeDocument?.drawingJson]);

  useEffect(() => {
    setSheetDraft(selectedCharacter ? createDraftFromCharacter(selectedCharacter) : null);
  }, [selectedCharacter?.id]);

  useEffect(() => {
    if (screen === 'characters' && characterView === 'library' && selectedCharacterStates.length === 1) {
      setCharacterView(selectedCharacterStates[0].campaignId);
    }
  }, [characterView, screen, selectedCharacterStates]);

  useEffect(() => {
    setInventoryDraft(parseInventory(viewedCampaignState?.inventoryJson));
    setSpellcastingDraft(parseSpellcasting(viewedCampaignState?.sheetJson));
    setTransferTargetCharacterId((current) => {
      if (current && transferTargets.some((state) => state.characterId === current)) {
        return current;
      }
      return transferTargets[0]?.characterId ?? '';
    });
  }, [viewedCampaignState?.id, viewedCampaignState?.inventoryJson, viewedCampaignState?.sheetJson, transferTargets]);

  useEffect(() => {
    if (!['campaigns', 'master-room', 'player-room'].includes(screen) || !activeRoom || !realtimeUserId) {
      setRealtimeStatus('offline');
      return;
    }

    let disposed = false;
    const socket = new WebSocket(getRoomSocketUrl(activeRoom.id, realtimeUserId, network?.backendPort ?? 3000));
    setRealtimeStatus('connecting');

    socket.addEventListener('open', () => {
      if (disposed) {
        return;
      }
      setRealtimeStatus('online');
      socket.send('ping');
    });

    socket.addEventListener('message', (event) => {
      if (disposed) {
        return;
      }

      try {
        const realtimeEvent = JSON.parse(event.data as string) as RealtimeEvent;
        setLastRealtimeEvent(realtimeEvent);

        if (
          realtimeEvent.type === 'room:joined' ||
          realtimeEvent.type === 'room:left' ||
          realtimeEvent.type === 'room:participant-status' ||
          realtimeEvent.type === 'character:hp-updated' ||
          realtimeEvent.type === 'turn:updated' ||
          realtimeEvent.type === 'room:refreshed'
        ) {
          void refresh(undefined, new Date());
        }
      } catch {
        setRealtimeStatus('error');
      }
    });

    socket.addEventListener('close', () => {
      if (!disposed) {
        setRealtimeStatus('offline');
      }
    });

    socket.addEventListener('error', () => {
      if (!disposed) {
        setRealtimeStatus('error');
      }
    });

    return () => {
      disposed = true;
      socket.close();
    };
  }, [screen, activeRoom?.id, realtimeUserId, network?.backendPort]);

  async function runAction(action: () => Promise<void>, success: string) {
    setFeedback('Сохраняю на сервере...');
    try {
      await action();
      await refresh(undefined, new Date());
      setFeedback(success);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Не удалось выполнить действие.');
    }
  }

  function connectToCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAction(
      async () => {
        const participant = await sendJson<JoinRoomResult>('/api/rooms/join-by-code', 'POST', {
          userId: selectedUserId,
          characterId: connectCharacterId,
          inviteCode: connectCode.trim().toUpperCase(),
        });
        setSelectedCampaignId(participant.room.campaignId);
        setScreen('player-room');
      },
      'Персонаж подключен к кампании. Состояние в кампании сохранено на сервере.',
    );
  }

  function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAction(
      async () => {
        const character = await sendJson<Character>('/api/characters', 'POST', {
          ownerUserId: selectedUserId,
          name: characterName,
          ancestry: characterAncestry,
          className: characterClass,
          portraitUrl: characterPortraitUrl || null,
          level: 1,
          maxHp: 10,
          currentHp: 10,
          armorClass: 10,
          speed: 30,
          sheetJson: {
            backgroundName: characterBackground,
            abilityScores: defaultAbilityScores,
            skillProficiencies: [],
            passiveFeatures: '',
          },
        });
        setCreatedCharacter(character);
        setSelectedCharacterId(character.id);
        setConnectCharacterId(character.id);
      },
      'Персонаж создан в личной библиотеке.',
    );
  }

  function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!masterUser) {
      setFeedback('Локальный мастер не найден.');
      return;
    }

    void runAction(
      async () => {
        const campaign = await sendJson<Campaign>('/api/campaigns', 'POST', {
          name: campaignName,
          description: campaignDescription,
          masterUserId: masterUser.id,
          settingId: campaignSettingId || null,
          includeSettingDlc,
          includeHomebrewDlc,
        });
        setSelectedCampaignId(campaign.id);
        setCreatedCampaign(campaign);
      },
      'Кампания сохранена. Теперь её можно запустить или открыть в просмотре.',
    );
  }

  function startCreatedCampaign() {
    if (!createdCampaign || !masterUser) {
      return;
    }

    const campaignId = createdCampaign.id;
    void runAction(
      async () => {
        const room = await sendJson<GameRoom>(`/api/campaigns/${campaignId}/load`, 'POST', {
          masterUserId: masterUser.id,
        });
        setSelectedCampaignId(campaignId);
        setConnectCode(room.inviteCode);
        setScreen('master-room');
      },
      'Кампания запущена. Комната открыта для подключения.',
    );
  }

  function updateCampaignSource(link: CampaignSourceBook) {
    if (!activeCampaign || !masterUser) {
      return;
    }

    const nextEnabled = !link.isEnabled;
    void runAction(
      async () => {
        await sendJson(`/api/campaigns/${activeCampaign.id}/source-books/${link.sourceBook.id}`, 'PATCH', {
          masterUserId: masterUser.id,
          isEnabled: nextEnabled,
        });
      },
      nextEnabled ? 'Источник включен для кампании.' : 'Источник выключен для кампании.',
    );
  }

  function updateRoomSourceOverride(link: CampaignSourceBook, isEnabled: boolean | null) {
    if (!activeRoom || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/rooms/${activeRoom.id}/source-books/${link.sourceBook.id}`, 'PATCH', {
          masterUserId: masterUser.id,
          isEnabled,
          inherit: false,
        });
      },
      getRoomOverrideLabel(isEnabled),
    );
  }

  function updateRoomSetting(settingId: string) {
    if (!activeRoom || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<GameRoom>(`/api/rooms/${activeRoom.id}`, 'PATCH', {
          masterUserId: masterUser.id,
          settingId: settingId || null,
        });
      },
      'Настройки комнаты обновлены.',
    );
  }

  function loadCampaign() {
    if (!activeCampaign || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        const room = await sendJson<GameRoom>(`/api/campaigns/${activeCampaign.id}/load`, 'POST', {
          masterUserId: masterUser.id,
        });
        setConnectCode(room.inviteCode);
        setScreen('master-room');
      },
      'Кампания загружена. Комната открыта для сети, код подключения обновлен.',
    );
  }

  function leaveCampaign() {
    if (!activeRoom || !currentUserRoomParticipant) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<RoomParticipant>(`/api/rooms/${activeRoom.id}/leave`, 'POST', {
          userId: selectedUserId,
        });
        setScreen('connect');
      },
      'Вы вышли из кампании. Персонаж и прогресс сохранены.',
    );
  }

  function updateCampaignHp(state: CampaignCharacterState, delta: number) {
    const actorUserId = state.character.ownerId === selectedUserId ? selectedUserId : masterUser?.id ?? selectedUserId;
    const nextHp = Math.max(0, Math.min(state.maxHp, state.currentHp + delta));

    void runAction(
      async () => {
        await sendJson<CampaignCharacterState>(`/api/campaigns/${state.campaignId}/characters/${state.characterId}/hp`, 'PATCH', {
          userId: actorUserId,
          currentHp: nextHp,
          maxHp: state.maxHp,
        });
      },
      `HP персонажа ${state.character.name}: ${nextHp}/${state.maxHp}.`,
    );
  }

  function saveInventory(nextInventory: CharacterInventory, success: string) {
    if (!viewedCampaignState) {
      return;
    }

    const actorUserId = viewedCampaignState.character.ownerId === selectedUserId ? selectedUserId : masterUser?.id ?? selectedUserId;
    setInventoryDraft(nextInventory);
    void runAction(
      async () => {
        await sendJson<CampaignCharacterState>(
          `/api/campaigns/${viewedCampaignState.campaignId}/characters/${viewedCampaignState.characterId}/inventory`,
          'PATCH',
          {
            userId: actorUserId,
            inventory: nextInventory,
          },
        );
      },
      success,
    );
  }

  function updateMoney(key: 'cp' | 'sp' | 'ep' | 'gp' | 'pp', value: number) {
    saveInventory({ ...inventoryDraft, [key]: clampNumber(value, 0, 999999) }, 'Монеты обновлены.');
  }

  function selectInventoryCatalogItem(itemId: string) {
    const reference = inventoryCatalog.find((item) => item.id === itemId);
    if (!reference) {
      return;
    }

    setSelectedInventoryCatalogId(itemId);
    setNewItemDraft(getInventoryCatalogDraft(reference));
  }

  function updateInventoryDraftKind(kind: InventoryItemKind) {
    const reference = selectedInventoryCatalogItem;
    if (reference) {
      setNewItemDraft(getInventoryCatalogDraft(reference, kind));
      return;
    }
    setNewItemDraft((draft) => ({ ...draft, kind }));
  }

  function addInventoryItem() {
    const item = createInventoryItem(newItemDraft);
    saveInventory(
      {
        ...inventoryDraft,
        items: [...inventoryDraft.items, item],
      },
      `Предмет "${item.name}" добавлен.`,
    );
    setSelectedInventoryCatalogId(inventoryCatalog[0]?.id ?? '');
    setNewItemDraft(inventoryCatalog[0] ? getInventoryCatalogDraft(inventoryCatalog[0]) : defaultInventoryItemDraft);
  }

  function updateItemQuantity(itemId: string, quantity: number) {
    const nextItems = inventoryDraft.items
      .map((item) => (item.id === itemId ? { ...item, quantity: clampNumber(quantity, 0, 9999) } : item))
      .filter((item) => item.quantity > 0);
    saveInventory({ ...inventoryDraft, items: nextItems }, 'Количество предмета обновлено.');
  }

  function equipInventoryItem(item: InventoryItem, slot: EquipmentSlot | null) {
    const nextItems = inventoryDraft.items.map((current) => {
      if (current.id === item.id) {
        return { ...current, equippedSlot: current.equippedSlot === slot ? null : slot };
      }

      if (slot && current.equippedSlot === slot) {
        return { ...current, equippedSlot: null };
      }

      return current;
    });

    saveInventory({ ...inventoryDraft, items: nextItems }, slot ? `${equipmentSlotLabels[slot]} обновлен.` : 'Предмет снят.');
  }

  function transferInventoryItem(item: InventoryItem) {
    if (!viewedCampaignState || !transferTargetCharacterId) {
      return;
    }

    const actorUserId = viewedCampaignState.character.ownerId === selectedUserId ? selectedUserId : masterUser?.id ?? selectedUserId;
    void runAction(
      async () => {
        await sendJson(
          `/api/campaigns/${viewedCampaignState.campaignId}/characters/${viewedCampaignState.characterId}/transfer-item`,
          'POST',
          {
            userId: actorUserId,
            targetCharacterId: transferTargetCharacterId,
            itemId: item.id,
            quantity: 1,
          },
        );
      },
      `Передан предмет "${item.name}".`,
    );
  }

  function saveSpellcasting(nextSpellcasting: SpellcastingState, success: string) {
    if (!viewedCampaignState) {
      return;
    }

    const actorUserId = viewedCampaignState.character.ownerId === selectedUserId ? selectedUserId : masterUser?.id ?? selectedUserId;
    setSpellcastingDraft(nextSpellcasting);
    void runAction(
      async () => {
        await sendJson<CampaignCharacterState>(
          `/api/campaigns/${viewedCampaignState.campaignId}/characters/${viewedCampaignState.characterId}/spellcasting`,
          'PATCH',
          {
            userId: actorUserId,
            spellcasting: nextSpellcasting,
          },
        );
      },
      success,
    );
  }

  function updateSpellSlot(level: string, field: 'max' | 'current', value: number) {
    const currentSlot = spellcastingDraft.slots[level] ?? { max: 0, current: 0 };
    const nextSlot =
      field === 'max'
        ? {
            max: clampNumber(value, 0, 99),
            current: Math.min(currentSlot.current, clampNumber(value, 0, 99)),
          }
        : {
            ...currentSlot,
            current: clampNumber(value, 0, currentSlot.max),
          };

    saveSpellcasting(
      {
        ...spellcastingDraft,
        slots: {
          ...spellcastingDraft.slots,
          [level]: nextSlot,
        },
      },
      'Ячейки заклинаний обновлены.',
    );
  }

  function updateClassResource(field: 'primaryName' | 'max' | 'current', value: string | number) {
    const nextResources = { ...spellcastingDraft.resources };
    if (field === 'primaryName') {
      nextResources.primaryName = String(value);
    } else if (field === 'max') {
      nextResources.max = clampNumber(Number(value), 0, 99);
      nextResources.current = Math.min(nextResources.current, nextResources.max);
    } else {
      nextResources.current = clampNumber(Number(value), 0, nextResources.max);
    }

    saveSpellcasting({ ...spellcastingDraft, resources: nextResources }, 'Классовый ресурс обновлен.');
  }

  function addSpellFromReference() {
    const reference = testSpellReferences.find((spell) => spell.id === selectedSpellReferenceId) ?? testSpellReferences[0];
    const spell = createSpellFromReference(reference);
    saveSpellcasting(
      {
        ...spellcastingDraft,
        spells: [...spellcastingDraft.spells, spell],
      },
      `Заклинание "${spell.name}" добавлено.`,
    );
  }

  function removeSpell(spellId: string) {
    saveSpellcasting(
      {
        ...spellcastingDraft,
        spells: spellcastingDraft.spells.filter((spell) => spell.id !== spellId),
      },
      'Заклинание убрано из списка.',
    );
  }

  function castSpell(spell: Spell) {
    if (!viewedCampaignState) {
      return;
    }

    const actorUserId = viewedCampaignState.character.ownerId === selectedUserId ? selectedUserId : masterUser?.id ?? selectedUserId;
    const slotLevel = Math.max(1, spell.level);
    void runAction(
      async () => {
        await sendJson(
          `/api/campaigns/${viewedCampaignState.campaignId}/characters/${viewedCampaignState.characterId}/cast-spell`,
          'POST',
          {
            userId: actorUserId,
            spellId: spell.id,
            slotLevel,
          },
        );
      },
      spell.level === 0 ? `Заговор "${spell.name}" применен.` : `Заклинание "${spell.name}" применено, слот потрачен.`,
    );
  }

  function undoAction(snapshot: SaveSnapshot) {
    if (!masterUser) {
      setFeedback('Локальный мастер не найден.');
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/action-log/${snapshot.id}/undo`, 'POST', {
          masterUserId: masterUser.id,
        });
      },
      'Действие отменено мастером.',
    );
  }

  function startTurnEncounter() {
    if (!activeCampaign || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<TurnEncounter>(`/api/campaigns/${activeCampaign.id}/turn-encounters`, 'POST', {
          masterUserId: masterUser.id,
          roomId: activeRoom?.id ?? null,
          name: `${getCampaignDisplayName(activeCampaign)}: сцена`,
          participantStateIds: activeCampaign.characterStates.map((state) => state.id),
        });
      },
      'Походовая сцена начата.',
    );
  }

  function addTurnNpc() {
    if (!activeTurnEncounter || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<TurnEncounter>(`/api/turn-encounters/${activeTurnEncounter.id}/npcs`, 'POST', {
          masterUserId: masterUser.id,
          name: turnNpcName,
          initiative: turnNpcInitiative,
          armorClass: 12,
          currentHp: 7,
          maxHp: 7,
          speed: 30,
        });
      },
      'NPC добавлен в инициативу.',
    );
  }

  function updateTurnInitiative(participant: TurnParticipant, initiative: number) {
    if (!activeTurnEncounter || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<TurnEncounter>(`/api/turn-encounters/${activeTurnEncounter.id}/participants/${participant.id}`, 'PATCH', {
          masterUserId: masterUser.id,
          initiative,
        });
      },
      `Инициатива ${participant.name} обновлена.`,
    );
  }

  function markTurnResource(participant: TurnParticipant, resource: 'action' | 'bonusAction' | 'reaction' | 'movement', allowOverride = false) {
    if (!activeTurnEncounter) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<{ encounter: TurnEncounter }>(
          `/api/turn-encounters/${activeTurnEncounter.id}/participants/${participant.id}/use-resource`,
          'POST',
          {
            userId: allowOverride ? undefined : selectedUserId,
            masterUserId: allowOverride ? masterUser?.id : undefined,
            resource,
            movement: resource === 'movement' ? 5 : undefined,
            allowOverride,
          },
        );
      },
      allowOverride ? `${getTurnResourceLabel(resource)} подтверждено override мастера.` : `${getTurnResourceLabel(resource)} отмечено.`,
    );
  }

  function advanceTurn() {
    if (!activeTurnEncounter || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<TurnEncounter>(`/api/turn-encounters/${activeTurnEncounter.id}/next-turn`, 'POST', {
          masterUserId: masterUser.id,
        });
      },
      'Ход передан следующему участнику.',
    );
  }

  function addTurnEffect() {
    if (!activeTurnEncounter || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<TurnEncounter>(`/api/turn-encounters/${activeTurnEncounter.id}/effects`, 'POST', {
          masterUserId: masterUser.id,
          participantId: turnEffectParticipantId || null,
          name: turnEffectName,
          remainingRounds: turnEffectRounds,
        });
      },
      'Эффект добавлен в походовую сцену.',
    );
  }

  function endTurnEncounter() {
    if (!activeTurnEncounter || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<TurnEncounter>(`/api/turn-encounters/${activeTurnEncounter.id}/end`, 'POST', {
          masterUserId: masterUser.id,
        });
      },
      'Походовая сцена завершена.',
    );
  }

  function updateRestHitDice(characterId: string, value: number) {
    setRestHitDiceByCharacter((current) => ({
      ...current,
      [characterId]: clampNumber(value, 0, 40),
    }));
  }

  function runCampaignRest(allowUnsafeRest = false) {
    if (!activeCampaign || !masterUser) {
      return;
    }

    const hitDice = activeCampaign.characterStates.map((state) => ({
      characterId: state.characterId,
      hitDice: restType === 'short' ? restHitDiceByCharacter[state.characterId] ?? 0 : 0,
    }));

    void runAction(
      async () => {
        await sendJson(`/api/campaigns/${activeCampaign.id}/rest`, 'POST', {
          masterUserId: masterUser.id,
          type: restType,
          hitDice,
          allowUnsafeRest,
        });
        setRestHitDiceByCharacter({});
      },
      `${getRestTypeLabel(restType)} проведен.`,
    );
  }

  function createMerchant() {
    if (!activeCampaign || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        const merchant = await sendJson<Merchant>(`/api/campaigns/${activeCampaign.id}/merchants`, 'POST', {
          masterUserId: masterUser.id,
          name: merchantName,
          inventory: { gp: 100, items: [] },
        });
        setSelectedMerchantId(merchant.id);
      },
      'Торговец создан.',
    );
  }

  function updateMerchantBuyer(characterStateId: string) {
    if (!activeMerchant || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<Merchant>(`/api/merchants/${activeMerchant.id}`, 'PATCH', {
          masterUserId: masterUser.id,
          activeBuyerStateId: characterStateId,
        });
      },
      'Активный покупатель выбран.',
    );
  }

  function addMerchantItem() {
    if (!activeMerchant || !masterUser || !selectedMerchantCatalogItem) {
      return;
    }

    const item = {
      ...createInventoryItem(getInventoryCatalogDraft(selectedMerchantCatalogItem, selectedMerchantCatalogItem.kinds[0])),
      quantity: clampNumber(merchantItemQuantity, 1, 9999),
      gpValue: clampNumber(merchantItemPrice, 1, 999999),
    };

    void runAction(
      async () => {
        await sendJson<Merchant>(`/api/merchants/${activeMerchant.id}/items`, 'POST', {
          masterUserId: masterUser.id,
          item,
        });
      },
      `Предмет "${item.name}" добавлен торговцу.`,
    );
  }

  function buyMerchantItem(item: InventoryItem) {
    if (!activeMerchant || !activeBuyerState || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/merchants/${activeMerchant.id}/buy`, 'POST', {
          masterUserId: masterUser.id,
          characterStateId: activeBuyerState.id,
          itemId: item.id,
          quantity: 1,
        });
      },
      `Покупка подтверждена: ${item.name}.`,
    );
  }

  function sellMerchantItem(item: InventoryItem) {
    if (!activeMerchant || !activeBuyerState || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/merchants/${activeMerchant.id}/sell`, 'POST', {
          masterUserId: masterUser.id,
          characterStateId: activeBuyerState.id,
          itemId: item.id,
          quantity: 1,
        });
      },
      `Продажа подтверждена: ${item.name}.`,
    );
  }

  function requestTheft(item: InventoryItem) {
    if (!activeMerchant || !activeBuyerState) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<TheftRequest>(`/api/merchants/${activeMerchant.id}/theft-requests`, 'POST', {
          userId: activeBuyerState.character.ownerId,
          characterStateId: activeBuyerState.id,
          itemId: item.id,
          dc: 12,
          notes: merchantTheftNotes,
        });
        setMerchantTheftNotes('');
      },
      `Запрос на кражу создан: ${item.name}.`,
    );
  }

  function resolveTheftRequest(request: TheftRequest, approved: boolean) {
    if (!activeMerchant || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/merchants/${activeMerchant.id}/theft-requests/${request.id}/resolve`, 'POST', {
          masterUserId: masterUser.id,
          approved,
        });
      },
      approved ? 'Кража одобрена мастером.' : 'Кража отклонена мастером.',
    );
  }

  function createHomebrew() {
    if (!masterUser) {
      return;
    }

    const payload =
      homebrewKind === 'spell'
        ? {
            name: homebrewName,
            level: 1,
            school: 'Хоумбрю',
            castingTime: '1 действие',
            range: '60 фт.',
            duration: 'Мгновенная',
            damage: `${homebrewDamageDice} ${homebrewDamageType}`,
          }
        : homebrewKind === 'effect'
          ? {
              name: homebrewName,
              durationRounds: homebrewDurationRounds,
              notes: `${homebrewDamageType || 'хоумбрю'} эффект`,
            }
          : homebrewKind === 'race' || homebrewKind === 'rule'
            ? {
                name: homebrewName,
                notes: homebrewDamageType,
              }
            : {
              name: homebrewName,
              kind: homebrewKind === 'weapon' ? 'weapon' : 'note',
              quantity: 1,
              weight: 1,
              gpValue: 0,
              damageDice: homebrewKind === 'weapon' ? homebrewDamageDice : '',
              damageType: homebrewKind === 'weapon' ? homebrewDamageType : '',
              proficient: true,
            };

    void runAction(
      async () => {
        await sendJson<HomebrewContent>('/api/homebrew', 'POST', {
          masterUserId: masterUser.id,
          name: homebrewName,
          kind: homebrewKind,
          status: 'published',
          payload,
        });
      },
      `Хоумбрю "${homebrewName}" создано.`,
    );
  }

  function grantHomebrew(content: HomebrewContent, mode: 'permanent' | 'temporary' = 'permanent') {
    if (!activeHomebrewTargetState || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/homebrew/${content.id}/grant`, 'POST', {
          masterUserId: masterUser.id,
          characterStateId: activeHomebrewTargetState.id,
          mode,
          durationRounds: homebrewDurationRounds,
        });
      },
      `Хоумбрю "${content.name}" выдано.`,
    );
  }

  function revokeHomebrew(content: HomebrewContent) {
    if (!activeHomebrewTargetState || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/homebrew/${content.id}/revoke`, 'POST', {
          masterUserId: masterUser.id,
          characterStateId: activeHomebrewTargetState.id,
        });
      },
      `Хоумбрю "${content.name}" отозвано.`,
    );
  }

  function changeHomebrewEffectDuration(content: HomebrewContent, rounds: number, end = false) {
    if (!masterUser || !activeCampaign) {
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/homebrew/${content.id}/effect-duration`, 'POST', {
          masterUserId: masterUser.id,
          campaignId: activeCampaign.id,
          rounds,
          end,
        });
      },
      end ? `Эффект "${content.name}" завершен.` : `Эффект "${content.name}" обновлен.`,
    );
  }

  function toggleHomebrewSelection(homebrewId: string) {
    setSelectedHomebrewIds((current) =>
      current.includes(homebrewId) ? current.filter((id) => id !== homebrewId) : [...current, homebrewId],
    );
  }

  function toggleHomebrewCampaignSelection(campaignId: string) {
    setSelectedHomebrewCampaignIds((current) =>
      current.includes(campaignId) ? current.filter((id) => id !== campaignId) : [...current, campaignId],
    );
  }

  function updateHomebrewCampaignLinks(action: 'link' | 'unlink') {
    if (!masterUser || selectedHomebrewIds.length === 0 || selectedHomebrewCampaignIds.length === 0) {
      return;
    }

    void runAction(
      async () => {
        await sendJson('/api/homebrew/campaign-links', 'POST', {
          masterUserId: masterUser.id,
          homebrewIds: selectedHomebrewIds,
          campaignIds: selectedHomebrewCampaignIds,
          action,
        });
      },
      action === 'link' ? 'Выбранные материалы добавлены в кампании.' : 'Выбранные материалы отключены от кампаний.',
    );
  }

  function createNpc(random = false) {
    if (!activeCampaign || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        const npc = await sendJson<NpcProfile>(`/api/campaigns/${activeCampaign.id}/npcs`, 'POST', {
          masterUserId: masterUser.id,
          name: random ? undefined : npcName,
          random,
          stat: { armorClass: 12, currentHp: 9, maxHp: 9, speed: 30 },
        });
        setSelectedNpcId(npc.id);
      },
      random ? 'Случайный NPC создан.' : 'NPC создан.',
    );
  }

  function activateNpc(npc: NpcProfile) {
    if (!masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<NpcProfile>(`/api/npcs/${npc.id}`, 'PATCH', {
          masterUserId: masterUser.id,
          isActive: true,
        });
      },
      `Активный NPC: ${npc.name}.`,
    );
  }

  function generateNpcLoot() {
    if (!activeNpc || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<NpcProfile>(`/api/npcs/${activeNpc.id}/generate-loot`, 'POST', {
          masterUserId: masterUser.id,
        });
      },
      `Лут NPC "${activeNpc.name}" обновлен.`,
    );
  }

  function requestNpcTheft(item: InventoryItem) {
    if (!activeNpc || !activeHomebrewTargetState) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<NpcTheftRequest>(`/api/npcs/${activeNpc.id}/theft-requests`, 'POST', {
          userId: activeHomebrewTargetState.character.ownerId,
          characterStateId: activeHomebrewTargetState.id,
          itemId: item.id,
          dc: 12,
          notes: npcTheftNotes,
        });
        setNpcTheftNotes('');
      },
      `Запрос на кражу у NPC создан: ${item.name}.`,
    );
  }

  function resolveNpcTheftRequest(request: NpcTheftRequest, approved: boolean) {
    if (!activeNpc || !masterUser) {
      return;
    }

    void runAction(
      async () => {
        await sendJson(`/api/npcs/${activeNpc.id}/theft-requests/${request.id}/resolve`, 'POST', {
          masterUserId: masterUser.id,
          approved,
        });
      },
      approved ? 'Кража у NPC одобрена.' : 'Кража у NPC отклонена.',
    );
  }

  function createDocument() {
    if (!activeCampaign || !activeHomebrewTargetState) {
      return;
    }

    const actorUserId = activeHomebrewTargetState.character.ownerId ?? masterUser?.id ?? selectedUserId;
    void runAction(
      async () => {
        const document = await sendJson<NoteDocument>(`/api/campaigns/${activeCampaign.id}/documents`, 'POST', {
          userId: actorUserId,
          characterStateId: activeHomebrewTargetState.id,
          title: documentTitle,
        });
        setSelectedDocumentId(document.id);
      },
      'Документ создан.',
    );
  }

  function saveDocument(showToGm = false) {
    if (!activeDocument) {
      return;
    }

    const ownerState = activeCampaign?.characterStates.find((state) => state.id === activeDocument.ownerStateId) ?? activeHomebrewTargetState;
    const actorUserId = ownerState?.character.ownerId ?? masterUser?.id ?? selectedUserId;
    const previousDrawingLength = parseDocumentDrawing(activeDocument.drawingJson).length;

    void runAction(
      async () => {
        await sendJson<NoteDocument>(`/api/documents/${activeDocument.id}`, 'PATCH', {
          userId: actorUserId,
          title: documentTitle,
          textContent: documentTextDraft,
          drawing: documentDrawingDraft,
          inkDelta: Math.max(0, documentDrawingDraft.length - previousDrawingLength),
          isShownToGm: showToGm ? true : activeDocument.isShownToGm,
        });
      },
      showToGm ? 'Документ показан мастеру.' : 'Документ сохранен.',
    );
  }

  function transferDocument() {
    if (!activeDocument || !activeHomebrewTargetState) {
      return;
    }

    const ownerState = activeCampaign?.characterStates.find((state) => state.id === activeDocument.ownerStateId) ?? activeHomebrewTargetState;
    const actorUserId = ownerState?.character.ownerId ?? masterUser?.id ?? selectedUserId;

    void runAction(
      async () => {
        await sendJson<NoteDocument>(`/api/documents/${activeDocument.id}/transfer`, 'POST', {
          userId: actorUserId,
          targetCharacterStateId: activeHomebrewTargetState.id,
        });
      },
      'Документ передан.',
    );
  }

  function getDocumentPoint(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  }

  function startDocumentStroke(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveDrawingPath(`M ${getDocumentPoint(event)}`);
  }

  function moveDocumentStroke(event: PointerEvent<SVGSVGElement>) {
    if (!activeDrawingPath) {
      return;
    }
    setActiveDrawingPath((path) => `${path} L ${getDocumentPoint(event)}`);
  }

  function endDocumentStroke() {
    if (!activeDrawingPath) {
      return;
    }
    setDocumentDrawingDraft((paths) => [...paths, activeDrawingPath]);
    setActiveDrawingPath('');
  }

  function patchSheetDraft(update: Partial<CharacterSheetDraft>) {
    setSheetDraft((draft) => (draft ? { ...draft, ...update } : draft));
  }

  function updateAbilityScore(key: AbilityKey, value: number) {
    setSheetDraft((draft) =>
      draft
        ? {
            ...draft,
            abilityScores: {
              ...draft.abilityScores,
              [key]: clampNumber(value, 1, 30),
            },
          }
        : draft,
    );
  }

  function toggleSkill(skillId: string) {
    setSheetDraft((draft) => {
      if (!draft) {
        return draft;
      }

      const enabled = draft.skillProficiencies.includes(skillId);
      return {
        ...draft,
        skillProficiencies: enabled
          ? draft.skillProficiencies.filter((item) => item !== skillId)
          : [...draft.skillProficiencies, skillId],
      };
    });
  }

  function saveCharacterSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCharacter || !sheetDraft) {
      return;
    }

    void runAction(
      async () => {
        await sendJson<Character>(`/api/characters/${selectedCharacter.id}`, 'PATCH', {
          name: sheetDraft.name,
          level: sheetDraft.level,
          ancestry: sheetDraft.ancestry,
          className: sheetDraft.className,
          portraitUrl: sheetDraft.portraitUrl || null,
          currentHp: sheetDraft.currentHp,
          maxHp: sheetDraft.maxHp,
          armorClass: sheetDraft.armorClass,
          speed: sheetDraft.speed,
          sheetJson: {
            backgroundName: sheetDraft.backgroundName,
            abilityScores: sheetDraft.abilityScores,
            skillProficiencies: sheetDraft.skillProficiencies,
            passiveFeatures: sheetDraft.passiveFeatures,
          },
        });
      },
      'Лист персонажа сохранен.',
    );
  }

  function beginDeleteCampaign(campaignId: string) {
    setDeleteCampaignId(campaignId);
    setDeleteCampaignArmed(false);
    setDeleteCampaignText('');
  }

  function cancelDeleteCampaign() {
    setDeleteCampaignId(null);
    setDeleteCampaignArmed(false);
    setDeleteCampaignText('');
  }

  function confirmDeleteCampaign() {
    if (!activeCampaign || !masterUser || deleteCampaignText.trim().toLocaleLowerCase('ru-RU') !== 'удалить') {
      return;
    }

    const campaignId = activeCampaign.id;
    void runAction(
      async () => {
        await sendJson(`/api/campaigns/${campaignId}`, 'DELETE', {
          masterUserId: masterUser.id,
          confirmText: deleteCampaignText,
        });
        setSelectedCampaignId('');
        cancelDeleteCampaign();
        if (data?.campaigns.length === 1) {
          setScreen('create-campaign');
        }
      },
      'Кампания удалена с локального сервера.',
    );
  }

  function beginDeleteCharacter(characterId: string) {
    setDeleteCharacterId(characterId);
    setDeleteCharacterArmed(false);
    setDeleteCharacterText('');
  }

  function cancelDeleteCharacter() {
    setDeleteCharacterId(null);
    setDeleteCharacterArmed(false);
    setDeleteCharacterText('');
  }

  function confirmDeleteCharacter() {
    if (!selectedCharacter || deleteCharacterText.trim().toLocaleLowerCase('ru-RU') !== 'удалить') {
      return;
    }

    const characterId = selectedCharacter.id;
    void runAction(
      async () => {
        await sendJson(`/api/characters/${characterId}`, 'DELETE', {
          userId: selectedUserId,
          confirmText: deleteCharacterText,
        });
        setSelectedCharacterId('');
        setCharacterView('library');
        setConnectCharacterId('');
        cancelDeleteCharacter();
        if (userCharacters.length === 1) {
          setScreen('create-character');
        }
      },
      'Персонаж удален из локальной библиотеки.',
    );
  }

  function loginToProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!data) {
      return;
    }

    const normalizedLogin = loginName.trim().toLocaleUpperCase('ru-RU');
    const matchedUser = playerUsers.find((user) => user.displayName.toLocaleUpperCase('ru-RU') === normalizedLogin) ?? null;

    if (!matchedUser) {
      setFeedback('Профиль не найден. Введите логин ERHA или ERHACHECK.');
      return;
    }

    if (localProfilePasswords[normalizedLogin] !== loginPassword.trim()) {
      setFeedback('Неверный пароль профиля.');
      return;
    }

    setSelectedUserId(matchedUser.id);
    setLoginName(matchedUser.displayName);
    setIsProfileUnlocked(true);
    setScreen('main-menu');
    setFeedback(`Вход выполнен: ${matchedUser.displayName}`);
    window.localStorage.setItem('dnd:last-login', matchedUser.displayName);

    if (rememberProfile) {
      window.localStorage.setItem('dnd:remember-profile', '1');
      window.localStorage.setItem('dnd:last-user-id', matchedUser.id);
    } else {
      window.localStorage.removeItem('dnd:remember-profile');
      window.localStorage.removeItem('dnd:last-user-id');
    }
  }

  function logoutProfile() {
    window.localStorage.removeItem('dnd:remember-profile');
    window.localStorage.removeItem('dnd:last-user-id');
    setRememberProfile(false);
    setIsProfileUnlocked(false);
    setLoginPassword('');
    setScreen('connect');
    setFeedback('Вы вышли из игрового профиля.');
  }

  return (
    <main className="game-shell focused-shell">
      <section className="play-surface">
        {apiState.status === 'loading' && <p className="notice">Загружаю серверные данные...</p>}
        {apiState.status === 'error' && <p className="notice error">Сервер недоступен: {apiState.message}</p>}
        {data && !isProfileUnlocked && (
          <section className="auth-screen">
            <div className="screen-brand">Костёр · D&D 5e 2014</div>
            <form className="auth-card" onSubmit={loginToProfile}>
              <p className="eyebrow">Игровой профиль</p>
              <h1>Вход в игровой профиль</h1>
              <label className="field">
                <span>Логин</span>
                <input
                  autoComplete="username"
                  value={loginName}
                  onChange={(event) => setLoginName(event.target.value)}
                  placeholder="ERHA"
                />
              </label>
              <label className="field">
                <span>Пароль</span>
                <input
                  autoComplete="current-password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Локальный пароль"
                />
              </label>
              <label className="toggle-row auth-remember">
                <input checked={rememberProfile} onChange={(event) => setRememberProfile(event.target.checked)} type="checkbox" />
                <span>Запомнить меня при входе</span>
              </label>
              <button className="primary-button auth-submit" type="submit">
                Войти
              </button>
              <div className="auth-help">
                <span>
                  {localContactEmail
                    ? `Нет аккаунта? Обратись на почту ${localContactEmail}`
                    : 'Демонстрационные профили: ERHA и ERHACHECK, пароль: demo. Создание профилей пока не реализовано.'}
                </span>
                <button className="link-button" onClick={() => setShowAccountReason((value) => !value)} type="button">
                  Почему нельзя самим создать аккаунт?
                </button>
                {showAccountReason && (
                  <small>
                    Сейчас это локальный стол мастера: профили создаются на компьютере, где хранится кампания, чтобы не смешивать игроков,
                    персонажей и авторские материалы без разрешения.
                  </small>
                )}
              </div>
              {feedback && <p className="auth-feedback">{feedback}</p>}
            </form>
          </section>
        )}
        {data && (
          <>
            <datalist id="ancestry-options">
              {characterOptions.ancestries.map((option) => (
                <option key={option.id} value={option.russianName}>
                  {option.sourceTitle}
                </option>
              ))}
            </datalist>
            <datalist id="class-options">
              {characterOptions.classes.map((option) => (
                <option key={option.id} value={option.russianName}>
                  {option.sourceTitle}
                </option>
              ))}
            </datalist>
            <datalist id="background-options">
              {characterOptions.backgrounds.map((option) => (
                <option key={option.id} value={option.russianName}>
                  {option.sourceTitle}
                </option>
              ))}
            </datalist>
          </>
        )}

        {data && isProfileUnlocked && screen === 'main-menu' && (
          <section className="hub-screen">
            <div className="screen-brand">Костёр · D&D 5e 2014</div>
            <nav className="hub-menu" aria-label="Главное меню">
              {menuItems.map((item) => {
                const isUnavailable =
                  (item.id === 'characters' && userCharacters.length === 0) ||
                  (item.id === 'campaigns' && data.campaigns.length === 0);

                return (
                  <button
                    className={isUnavailable ? 'hub-button unavailable' : 'hub-button'}
                    disabled={isUnavailable}
                    key={item.id}
                    onClick={() => setScreen(item.id)}
                    type="button"
                  >
                    <span>{item.title}</span>
                    <small>{isUnavailable ? 'Сначала создайте хотя бы один объект' : item.hint}</small>
                  </button>
                );
              })}
            </nav>
            <aside className="hub-status">
              <strong>{selectedUser?.displayName ?? 'Игрок'}</strong>
              <span>{savedAt ? `Сохранено: ${savedAt.toLocaleTimeString('ru-RU')}` : 'Сервер готов'}</span>
              <span>{getRealtimeStatusLabel(realtimeStatus)}</span>
              {feedback && <small>{feedback}</small>}
            </aside>
            <button className="secondary-button logout-button" onClick={logoutProfile} type="button">
              Выйти из аккаунта
            </button>
          </section>
        )}

        {data && isProfileUnlocked && screen === 'connect' && (
          <section className="join-screen">
            <div className="screen-brand">Костёр · D&D 5e 2014</div>
            <button className="secondary-button back-button" onClick={() => setScreen('main-menu')} type="button">
              Назад
            </button>
            <form className="join-card" onSubmit={connectToCampaign}>
              <p className="eyebrow">Подключение</p>
              <h1>Войти в кампанию</h1>
              <label className="field">
                <span>Код кампании</span>
                <input value={connectCode} onChange={(event) => setConnectCode(event.target.value)} placeholder="Например: HX2ARZ" />
              </label>
              <label className="field">
                <span>Персонаж</span>
                <select value={connectCharacterId} onChange={(event) => setConnectCharacterId(event.target.value)}>
                  {userCharacters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} · ур. {character.level}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="submit" disabled={userCharacters.length === 0}>
                Подключиться
              </button>
            </form>
            <aside className="join-note">
              <strong>Код дает мастер.</strong>
              <span>Это отдельный экран подключения, чтобы игрок не искал нужную кнопку в общем меню.</span>
            </aside>
          </section>
        )}

        {data && screen === 'master-room' && activeCampaign && (
          <section className="screen-panel room-panel master-room-panel">
            <div className="room-topbar">
              <div>
                <p className="eyebrow">Окно мастера</p>
                <h2>{getCampaignDisplayName(activeCampaign)}</h2>
              </div>
              <div className="button-row">
                <button className="secondary-button" onClick={() => setScreen('campaigns')} type="button">
                  Выйти
                </button>
                <button className="secondary-button" onClick={() => setScreen('settings')} type="button">
                  Настройки
                </button>
              </div>
            </div>
            <div className="room-status-grid">
              <div>
                <span>Код кампании</span>
                <strong>{activeRoom?.inviteCode ?? 'комната не открыта'}</strong>
              </div>
              <div>
                <span>Игроки</span>
                <strong>
                  {onlineParticipantCount}/{activeCampaign.members.length}
                </strong>
              </div>
              <div>
                <span>Персонажи</span>
                <strong>{activeCampaign.characterStates.length}</strong>
              </div>
            </div>
            <div className="room-placeholder">
              <strong>Мастерское пространство</strong>
              <small>Здесь будет отдельный дизайн мастера: сцены, заметки, управление боем и доступом игроков.</small>
            </div>
          </section>
        )}

        {data && isProfileUnlocked && screen === 'player-room' && activeCampaign && (
          <section className="player-hud">
            <div className="screen-brand">Костёр · D&D 5e 2014</div>
            <button className="secondary-button back-button" onClick={currentUserRoomParticipant ? leaveCampaign : () => setScreen('connect')} type="button">
              Выйти
            </button>

            <aside className="hero-rail">
              <div className="hero-portrait">
                {selectedCharacter?.portraitUrl ? <img alt="" src={selectedCharacter.portraitUrl} /> : <span>Картинка героя</span>}
              </div>
              <div className="armor-chip">
                <span>Класс брони</span>
                <strong>{playerCampaignState?.armorClass ?? selectedCharacter?.sheetState?.armorClass ?? 10}</strong>
              </div>
              <div className="paper-doll" aria-label="Экипировка">
                {['Шлем', 'Броня', 'Перчатки', 'Сапоги', 'Амулет', 'Кольцо'].map((slot, index) => (
                  <div className={playerEquipmentItems[index] ? 'paper-slot filled' : 'paper-slot'} key={slot}>
                    <span>{playerEquipmentItems[index]?.name.slice(0, 2) ?? slot.slice(0, 1)}</span>
                  </div>
                ))}
              </div>
              <div className="damage-dice">
                <span>Кубики урона</span>
                <strong>{playerWeapon?.damageDice || '1к20'}</strong>
                <small>{playerWeapon?.name ?? 'с учетом бафов'}</small>
              </div>
            </aside>

            <div className="party-strip" aria-label="Герои в комнате">
              {activeRoomParticipants.length > 0 ? (
                activeRoomParticipants.map((participant) => (
                  <div className="party-card" key={participant.id}>
                    <strong>{participant.character?.name.slice(0, 1) ?? participant.user.displayName.slice(0, 1)}</strong>
                    <span>{participant.character?.name ?? participant.user.displayName}</span>
                  </div>
                ))
              ) : (
                <div className="party-card">
                  <strong>?</strong>
                  <span>Другие герои появятся здесь</span>
                </div>
              )}
            </div>

            <section className="hud-inventory" aria-label="Инвентарь">
              <div className="hud-panel-title">
                <p className="eyebrow">Инвентарь</p>
                <h2>Сумка и фильтры предметов</h2>
                <span>{playerInventoryWeight.toFixed(1)} фнт. · {playerInventory.items.length} предметов</span>
              </div>
              <div className="inventory-filter-row">
                {['Все', 'Оружие', 'Броня', 'Зелья', 'Ценности'].map((filter) => (
                  <button className="tab" key={filter} type="button">
                    {filter}
                  </button>
                ))}
              </div>
              <div className="hud-inventory-grid">
                {playerInventory.items.slice(0, 24).map((item) => (
                  <div className={item.equippedSlot ? 'hud-item equipped' : 'hud-item'} key={item.id}>
                    <strong>{item.name.slice(0, 2)}</strong>
                    <span>{item.quantity}</span>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 24 - playerInventory.items.length) }).map((_, index) => (
                  <div className="hud-item empty" key={`empty-${index}`} />
                ))}
              </div>
            </section>

            <aside className="character-card-panel">
              <div className="character-card-preview">
                <span>{selectedCharacter?.ancestry ?? 'Герой'}</span>
                <strong>{selectedCharacter?.name ?? 'Персонаж'}</strong>
                <small>
                  Уровень {playerCampaignState?.level ?? selectedCharacter?.level ?? 1}
                  {selectedCharacter?.className ? ` · ${selectedCharacter.className}` : ''}
                </small>
                <div className="stat-line">
                  {abilityKeys.map((key) => (
                    <div key={key}>
                      <span>{abilityLabels[key].slice(0, 3)}</span>
                      <strong>{playerSheetDetails.abilityScores[key]}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="features-panel">
                <strong>Прочие умения</strong>
                <small>{playerSheetDetails.passiveFeatures || 'Пассивные особенности, сопротивления и правила появятся здесь.'}</small>
              </div>
              <div className="rules-panel">
                <strong>Ответные действия</strong>
                <small>Здесь можно открыть карточку персонажа, подготовить заклинания и посмотреть доступные реакции по правилам.</small>
              </div>
            </aside>

            <section className="quickbar" aria-label="Быстрые действия">
              {[...playerQuickItems, ...inventoryCatalog.slice(0, Math.max(0, 12 - playerQuickItems.length)).map((item) => getInventoryCatalogDraft(item))].slice(0, 12).map((item, index) => (
                <button className="quick-slot" key={`${item.name}-${index}`} type="button">
                  <span>{item.name.slice(0, 2)}</span>
                  <small>{'quantity' in item ? item.quantity : ''}</small>
                </button>
              ))}
            </section>

            <aside className="context-actions">
              <strong>Контекст мастера</strong>
              <small>Если мастер покажет торговца или НПС, здесь появятся кнопки: торговать, украсть, поговорить или открыть карточку.</small>
              <div className="button-row">
                <button className="secondary-button" type="button">Торговать</button>
                <button className="secondary-button" type="button">Украсть</button>
              </div>
            </aside>
          </section>
        )}

        {data && screen === 'homebrew' && (
          <section className="screen-panel department-screen">
            <div className="screen-brand">Костёр · D&amp;D 5e 2014</div>
            <button className="secondary-button back-button" onClick={() => setScreen('main-menu')} type="button">
              Назад
            </button>
            <p className="eyebrow">Материалы</p>
            <div className="section-title-row">
              <h2>Хоумбрю</h2>
              <button className="primary-button" onClick={createHomebrew} type="button">
                Создать материал
              </button>
            </div>
            <div className="source-context-strip">
              <div>
                <strong>Личная библиотека мастера</strong>
                <small>{masterHomebrewContents.length} материалов · создавать можно до появления кампаний</small>
              </div>
              {activeCampaign ? (
                <label className="field campaign-view-select">
                  <span>Кампания для выдачи персонажу</span>
                  <select value={activeCampaign.id} onChange={(event) => setSelectedCampaignId(event.target.value)}>
                    {data.campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {getCampaignDisplayName(campaign)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <small>Кампаний пока нет. Материалы можно создать сейчас и подключить позже.</small>
              )}
            </div>

            <div className="homebrew-editor">
              <label className={fieldClass(homebrewName)}>
                <span>Название</span>
                <input value={homebrewName} onChange={(event) => setHomebrewName(event.target.value)} />
              </label>
              <label className="field">
                <span>Тип</span>
                <select value={homebrewKind} onChange={(event) => setHomebrewKind(event.target.value as HomebrewKind)}>
                  <option value="weapon">Оружие</option>
                  <option value="item">Предмет / зелье</option>
                  <option value="spell">Заклинание</option>
                  <option value="effect">Эффект</option>
                  <option value="race">Раса / происхождение</option>
                  <option value="rule">Правило</option>
                </select>
              </label>
              <label className="field filled-field">
                <span>{homebrewKind === 'effect' ? 'Раунды' : homebrewKind === 'race' || homebrewKind === 'rule' ? 'Краткое значение' : 'Формула'}</span>
                <input
                  value={homebrewKind === 'effect' ? homebrewDurationRounds : homebrewKind === 'race' || homebrewKind === 'rule' ? homebrewDamageType : homebrewDamageDice}
                  onChange={(event) => {
                    if (homebrewKind === 'effect') {
                      setHomebrewDurationRounds(clampNumber(Number(event.target.value), 1, 999));
                    } else if (homebrewKind === 'race' || homebrewKind === 'rule') {
                      setHomebrewDamageType(event.target.value);
                    } else {
                      setHomebrewDamageDice(event.target.value);
                    }
                  }}
                />
              </label>
              {homebrewKind !== 'race' && homebrewKind !== 'rule' && (
                <label className="field">
                  <span>Тип урона / заметка</span>
                  <input value={homebrewDamageType} onChange={(event) => setHomebrewDamageType(event.target.value)} />
                </label>
              )}
            </div>

            {data.campaigns.length > 0 && (
              <section className="homebrew-bulk-panel" aria-label="Массовая привязка хоумбрю">
                <div className="homebrew-bulk-header">
                  <div>
                    <strong>Привязать к кампаниям</strong>
                    <small>Выбрано материалов: {selectedHomebrewIds.length} · кампаний: {selectedHomebrewCampaignIds.length}</small>
                  </div>
                  <div className="button-row">
                    <button className="secondary-button" onClick={() => setSelectedHomebrewIds(masterHomebrewContents.map((content) => content.id))} type="button">
                      Все материалы
                    </button>
                    <button className="secondary-button" onClick={() => setSelectedHomebrewCampaignIds(data.campaigns.map((campaign) => campaign.id))} type="button">
                      Все кампании
                    </button>
                    <button className="secondary-button" onClick={() => { setSelectedHomebrewIds([]); setSelectedHomebrewCampaignIds([]); }} type="button">
                      Сбросить
                    </button>
                  </div>
                </div>
                <div className="homebrew-campaign-selection">
                  {data.campaigns.map((campaign) => (
                    <label className={selectedHomebrewCampaignIds.includes(campaign.id) ? 'selection-card selected' : 'selection-card'} key={campaign.id}>
                      <input
                        checked={selectedHomebrewCampaignIds.includes(campaign.id)}
                        onChange={() => toggleHomebrewCampaignSelection(campaign.id)}
                        type="checkbox"
                      />
                      <span>{getCampaignDisplayName(campaign)}</span>
                    </label>
                  ))}
                </div>
                <div className="button-row bulk-action-row">
                  <button
                    className="primary-button"
                    disabled={selectedHomebrewIds.length === 0 || selectedHomebrewCampaignIds.length === 0}
                    onClick={() => updateHomebrewCampaignLinks('link')}
                    type="button"
                  >
                    Добавить в кампании
                  </button>
                  <button
                    className="danger-button"
                    disabled={selectedHomebrewIds.length === 0 || selectedHomebrewCampaignIds.length === 0}
                    onClick={() => updateHomebrewCampaignLinks('unlink')}
                    type="button"
                  >
                    Удалить из кампаний
                  </button>
                </div>
              </section>
            )}

            <div className="homebrew-library">
              {masterHomebrewContents.map((content) => {
                const payload = parseHomebrewPayload(content.payloadJson);
                const detail =
                  content.kind === 'effect'
                    ? `${String(payload.durationRounds ?? homebrewDurationRounds)} раунд.`
                    : content.kind === 'spell'
                      ? String(payload.damage ?? 'заклинание')
                      : `${String(payload.damageDice ?? '')} ${String(payload.damageType ?? '')}`.trim() || String(payload.notes ?? '') || getHomebrewKindLabel(content.kind);
                const isLinkedToActiveCampaign = Boolean(activeCampaign && content.campaignLinks.some((link) => link.campaignId === activeCampaign.id));
                const canGrantToCharacter = Boolean(
                  activeHomebrewTargetState &&
                  isLinkedToActiveCampaign &&
                  ['item', 'weapon', 'spell', 'effect'].includes(content.kind),
                );

                return (
                  <article className={selectedHomebrewIds.includes(content.id) ? 'homebrew-row selected' : 'homebrew-row'} key={content.id}>
                    <label className="homebrew-select-control">
                      <input
                        checked={selectedHomebrewIds.includes(content.id)}
                        onChange={() => toggleHomebrewSelection(content.id)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{content.name}</strong>
                        <small>{getHomebrewKindLabel(content.kind)} · {content.status} · {detail}</small>
                        <small>
                          {content.campaignLinks.length > 0
                            ? `Подключено: ${content.campaignLinks.map((link) => link.campaign.name).join(', ')}`
                            : 'Пока не подключено ни к одной кампании'}
                        </small>
                      </span>
                    </label>
                    {canGrantToCharacter && (
                      <div className="button-row">
                        <label className="field compact-target-select">
                          <span>Персонаж</span>
                          <select value={activeHomebrewTargetState?.id ?? ''} onChange={(event) => setHomebrewTargetStateId(event.target.value)}>
                            {activeCampaign?.characterStates.map((state) => (
                              <option key={state.id} value={state.id}>{state.character.name}</option>
                            ))}
                          </select>
                        </label>
                        <button className="secondary-button" onClick={() => grantHomebrew(content, 'permanent')} type="button">Выдать</button>
                        <button className="secondary-button" onClick={() => grantHomebrew(content, 'temporary')} type="button">Временно</button>
                        {content.kind === 'effect' && (
                          <button className="secondary-button" onClick={() => changeHomebrewEffectDuration(content, 1)} type="button">+1 раунд</button>
                        )}
                        <button className="danger-button compact-danger" onClick={() => revokeHomebrew(content)} type="button">Отозвать</button>
                      </div>
                    )}
                  </article>
                );
              })}
              {masterHomebrewContents.length === 0 && (
                <article className="homebrew-row">
                  <div>
                    <strong>Материалов пока нет</strong>
                    <small>Создайте оружие, предмет, заклинание, расу, эффект или правило. Кампания для этого не нужна.</small>
                  </div>
                </article>
              )}
            </div>
          </section>
        )}

        {data && screen === 'create-character' && (
          <section className="screen-panel department-screen">
            <div className="screen-brand">Костёр · D&amp;D 5e 2014</div>
            <button className="secondary-button back-button" onClick={() => setScreen('main-menu')} type="button">
              Назад
            </button>
            <p className="eyebrow">Новый герой</p>
            <div className="section-title-row">
              <h2>Создать персонажа</h2>
            </div>
            {activeCampaign && (
              <div className="source-context-strip">
                <div>
                  <strong>Подсказки по источникам: {activeCampaign.name}</strong>
                  <small>
                    Классы, происхождения и предыстории фильтруются по активным источникам
                    {activeRoom ? ` комнаты "${activeRoom.name}"` : ' кампании'}.
                  </small>
                </div>
                <label className="toggle-row">
                  <input
                    checked={showInactiveCharacterOptions}
                    onChange={(event) => setShowInactiveCharacterOptions(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Показывать неактивные</span>
                </label>
              </div>
            )}
            <form className="creator-grid" onSubmit={createCharacter}>
              <label className={fieldClass(characterName)}>
                <span>Имя</span>
                <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} />
              </label>
              <label className={fieldClass(characterAncestry)}>
                <span>Раса / происхождение</span>
                <input list="ancestry-options" value={characterAncestry} onChange={(event) => setCharacterAncestry(event.target.value)} />
                <small>{getOptionHint(characterOptions.ancestries, characterAncestry)}</small>
              </label>
              <label className={fieldClass(characterClass)}>
                <span>Класс</span>
                <input list="class-options" value={characterClass} onChange={(event) => setCharacterClass(event.target.value)} />
                <small>{getOptionHint(characterOptions.classes, characterClass)}</small>
              </label>
              <label className={fieldClass(characterBackground)}>
                <span>Предыстория</span>
                <input list="background-options" value={characterBackground} onChange={(event) => setCharacterBackground(event.target.value)} />
                <small>{getOptionHint(characterOptions.backgrounds, characterBackground)}</small>
              </label>
              <label className={fieldClass(characterPortraitUrl, 'wide-field')}>
                <span>Портрет</span>
                <input value={characterPortraitUrl} onChange={(event) => setCharacterPortraitUrl(event.target.value)} placeholder="URL изображения, можно оставить пустым" />
              </label>
              <button className="primary-button" type="submit">
                Создать героя
              </button>
            </form>

            {createdCharacter && (
              <div className="choice-box">
                <strong>{createdCharacter.name} сохранен в библиотеке.</strong>
                <div className="button-row">
                  <button className="secondary-button" onClick={() => setScreen('connect')} type="button">
                    Подключиться к кампании
                  </button>
                  <button className="secondary-button" onClick={() => setScreen('characters')} type="button">
                    Сохранить и открыть просмотр
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {data && screen === 'characters' && (
          <section className="screen-panel department-screen">
            <div className="screen-brand">Костёр · D&amp;D 5e 2014</div>
            <button className="secondary-button back-button" onClick={() => setScreen('main-menu')} type="button">
              Назад
            </button>
            <p className="eyebrow">Библиотека персонажей</p>
            <div className="section-title-row">
              <h2>Персонажи</h2>
              <button className="primary-button" onClick={() => setScreen('create-character')} type="button">
                Создать персонажа
              </button>
            </div>
            <div className="two-column">
              <div className="list-panel">
                {userCharacters.map((character) => (
                  <button
                    className={selectedCharacter?.id === character.id ? 'list-button active' : 'list-button'}
                    key={character.id}
                    onClick={() => {
                      setSelectedCharacterId(character.id);
                      setCharacterView('library');
                    }}
                    type="button"
                  >
                    <strong>{character.name}</strong>
                    <small>ID: {character.id}</small>
                  </button>
                ))}
              </div>

              {selectedCharacter && (
                <div className="detail-panel">
                  <div className="tabs-toolbar">
                    <label className="field campaign-view-select">
                      <span>Просмотр данных</span>
                      <select value={characterView} onChange={(event) => setCharacterView(event.target.value)}>
                        <option value="library">Default</option>
                        {selectedCharacterStates.map((state) => (
                          <option key={state.id} value={state.campaignId}>
                            {getCampaignDisplayName(state.campaign)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="danger-button" onClick={() => beginDeleteCharacter(selectedCharacter.id)} type="button">
                      Удалить
                    </button>
                  </div>

                  {deleteCharacterId === selectedCharacter.id && (
                    <div className="confirm-box">
                      {!deleteCharacterArmed ? (
                        <>
                          <strong>Вы уверены что хотите удалить?</strong>
                          <div className="button-row">
                            <button className="danger-button" onClick={() => setDeleteCharacterArmed(true)} type="button">
                              Да
                            </button>
                            <button className="secondary-button" onClick={cancelDeleteCharacter} type="button">
                              Отмена
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="field">
                            <span>Напишите слово "удалить"</span>
                            <input value={deleteCharacterText} onChange={(event) => setDeleteCharacterText(event.target.value)} />
                          </label>
                          <div className="button-row">
                            <button
                              className="danger-button"
                              disabled={deleteCharacterText.trim().toLocaleLowerCase('ru-RU') !== 'удалить'}
                              onClick={confirmDeleteCharacter}
                              type="button"
                            >
                              Удалить персонажа
                            </button>
                            <button className="secondary-button" onClick={cancelDeleteCharacter} type="button">
                              Отмена
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {sheetDraft && (
                    <form className={viewedCampaignState ? 'sheet-editor readonly-sheet' : 'sheet-editor'} onSubmit={saveCharacterSheet}>
                      {viewedCampaignState && (
                        <div className="readonly-banner">
                          <strong>Только просмотр кампании</strong>
                          <small>Инвентарь, деньги, заклинания и параметры показаны из выбранной кампании без редактирования.</small>
                        </div>
                      )}
                      <div className="sheet-header">
                        <div className="portrait-frame">
                          {sheetDraft.portraitUrl ? <img alt="" src={sheetDraft.portraitUrl} /> : <span>{sheetDraft.name.slice(0, 1)}</span>}
                        </div>
                        <div className="sheet-title">
                          <label className="field">
                            <span>Имя</span>
                            <input value={sheetDraft.name} onChange={(event) => patchSheetDraft({ name: event.target.value })} />
                          </label>
                          <div className="sheet-source-row">
                            <span>{getOptionHint(characterOptions.classes, sheetDraft.className)}</span>
                            <span>{getOptionHint(characterOptions.ancestries, sheetDraft.ancestry)}</span>
                            <span>{getOptionHint(characterOptions.backgrounds, sheetDraft.backgroundName)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="sheet-basics">
                        <label className={fieldClass(sheetDraft.portraitUrl)}>
                          <span>Портрет</span>
                          <input value={sheetDraft.portraitUrl} onChange={(event) => patchSheetDraft({ portraitUrl: event.target.value })} placeholder="URL изображения" />
                        </label>
                        <label className={fieldClass(sheetDraft.level)}>
                          <span>Уровень</span>
                          <input min={1} max={20} type="number" value={sheetDraft.level} onChange={(event) => patchSheetDraft({ level: clampNumber(Number(event.target.value), 1, 20) })} />
                        </label>
                        <label className={fieldClass(sheetDraft.className)}>
                          <span>Класс</span>
                          <input list="class-options" value={sheetDraft.className} onChange={(event) => patchSheetDraft({ className: event.target.value })} />
                        </label>
                        <label className={fieldClass(sheetDraft.ancestry)}>
                          <span>Раса / происхождение</span>
                          <input list="ancestry-options" value={sheetDraft.ancestry} onChange={(event) => patchSheetDraft({ ancestry: event.target.value })} />
                        </label>
                        <label className={fieldClass(sheetDraft.backgroundName)}>
                          <span>Предыстория</span>
                          <input list="background-options" value={sheetDraft.backgroundName} onChange={(event) => patchSheetDraft({ backgroundName: event.target.value })} />
                        </label>
                        <label className={fieldClass(sheetDraft.currentHp)}>
                          <span>Текущие HP</span>
                          <input min={0} max={sheetDraft.maxHp} type="number" value={sheetDraft.currentHp} onChange={(event) => patchSheetDraft({ currentHp: clampNumber(Number(event.target.value), 0, sheetDraft.maxHp) })} />
                        </label>
                        <label className={fieldClass(sheetDraft.maxHp)}>
                          <span>Максимум HP</span>
                          <input min={1} type="number" value={sheetDraft.maxHp} onChange={(event) => patchSheetDraft({ maxHp: clampNumber(Number(event.target.value), 1, 999) })} />
                        </label>
                        <label className={fieldClass(sheetDraft.armorClass)}>
                          <span>КД</span>
                          <input min={1} type="number" value={sheetDraft.armorClass} onChange={(event) => patchSheetDraft({ armorClass: clampNumber(Number(event.target.value), 1, 40) })} />
                        </label>
                        <label className={fieldClass(sheetDraft.speed)}>
                          <span>Скорость</span>
                          <input min={0} type="number" value={sheetDraft.speed} onChange={(event) => patchSheetDraft({ speed: clampNumber(Number(event.target.value), 0, 300) })} />
                        </label>
                      </div>

                      <div className="derived-grid">
                        <div>
                          <span>Бонус мастерства</span>
                          <strong>{formatModifier(getProficiencyBonus(sheetDraft.level))}</strong>
                        </div>
                        <div>
                          <span>Инициатива</span>
                          <strong>{formatModifier(getModifier(sheetDraft.abilityScores.dexterity))}</strong>
                        </div>
                        <div>
                          <span>Пассивная внимательность</span>
                          <strong>{10 + getSkillBonus(sheetDraft, 'perception', 'wisdom')}</strong>
                        </div>
                      </div>

                      {viewedCampaignState && (
                        <div className="campaign-hp-box">
                          <div>
                            <span>HP в кампании</span>
                            <strong>{viewedCampaignState.currentHp}/{viewedCampaignState.maxHp}</strong>
                          </div>
                          <div className="inline-stepper">
                            <button onClick={() => updateCampaignHp(viewedCampaignState, -1)} type="button">
                              -1
                            </button>
                            <button onClick={() => updateCampaignHp(viewedCampaignState, 1)} type="button">
                              +1
                            </button>
                          </div>
                        </div>
                      )}

                      {viewedCampaignState && (
                        <section className="spellcasting-panel" aria-label="Заклинания">
                          <div className="spellcasting-header">
                            <div>
                              <span>Заклинания и ресурсы</span>
                              <strong>{cantrips.length} заг. · {leveledSpells.length} закл.</strong>
                              <small>Заговоры не тратят ячейки, заклинания уровней расходуют доступный слот.</small>
                            </div>
                            <div className="spell-stats">
                              <label className="field filled-field">
                                <span>Характеристика</span>
                                <input value={spellcastingDraft.spellcastingAbility} onChange={(event) => saveSpellcasting({ ...spellcastingDraft, spellcastingAbility: event.target.value }, 'Характеристика заклинаний обновлена.')} />
                              </label>
                              <label className="field filled-field">
                                <span>Сл. спасброска</span>
                                <input min={0} type="number" value={spellcastingDraft.spellSaveDc} onChange={(event) => saveSpellcasting({ ...spellcastingDraft, spellSaveDc: clampNumber(Number(event.target.value), 0, 40) }, 'Сложность заклинаний обновлена.')} />
                              </label>
                              <label className="field filled-field">
                                <span>Атака</span>
                                <input type="number" value={spellcastingDraft.spellAttackBonus} onChange={(event) => saveSpellcasting({ ...spellcastingDraft, spellAttackBonus: clampNumber(Number(event.target.value), -20, 40) }, 'Бонус атаки заклинанием обновлен.')} />
                              </label>
                            </div>
                          </div>

                          <div className="spell-reference-row">
                            <label className="field">
                              <span>Тестовый справочник</span>
                              <select value={selectedSpellReferenceId} onChange={(event) => setSelectedSpellReferenceId(event.target.value)}>
                                {testSpellReferences.map((spell) => (
                                  <option key={spell.id} value={spell.id}>
                                    {spell.name} · {getSpellLevelLabel(spell.level)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button className="secondary-button" onClick={addSpellFromReference} type="button">
                              Добавить заклинание
                            </button>
                          </div>

                          <div className="spell-slots-grid">
                            {(['1', '2', '3'] as const).map((level) => (
                              <div className="spell-slot-card" key={level}>
                                <span>{level} уровень</span>
                                <div>
                                  <input
                                    aria-label={`Текущие ячейки ${level} уровня`}
                                    min={0}
                                    max={spellcastingDraft.slots[level]?.max ?? 0}
                                    type="number"
                                    value={spellcastingDraft.slots[level]?.current ?? 0}
                                    onChange={(event) => updateSpellSlot(level, 'current', Number(event.target.value))}
                                  />
                                  <strong>/</strong>
                                  <input
                                    aria-label={`Максимум ячеек ${level} уровня`}
                                    min={0}
                                    type="number"
                                    value={spellcastingDraft.slots[level]?.max ?? 0}
                                    onChange={(event) => updateSpellSlot(level, 'max', Number(event.target.value))}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="class-resource-row">
                            <label className="field filled-field">
                              <span>Классовый ресурс</span>
                              <input value={spellcastingDraft.resources.primaryName} onChange={(event) => updateClassResource('primaryName', event.target.value)} />
                            </label>
                            <label className="field filled-field">
                              <span>Текущий</span>
                              <input min={0} max={spellcastingDraft.resources.max} type="number" value={spellcastingDraft.resources.current} onChange={(event) => updateClassResource('current', Number(event.target.value))} />
                            </label>
                            <label className="field filled-field">
                              <span>Максимум</span>
                              <input min={0} type="number" value={spellcastingDraft.resources.max} onChange={(event) => updateClassResource('max', Number(event.target.value))} />
                            </label>
                          </div>

                          <div className="spell-card-grid">
                            {spellcastingDraft.spells.map((spell) => {
                              const slot = spell.level > 0 ? spellcastingDraft.slots[String(spell.level)] : null;
                              const canCast = spell.level === 0 || Boolean(slot && slot.current > 0);
                              const spellName = getSafeText(spell.name, 'Заклинание без названия');
                              const spellSchool = getSafeText(spell.school, 'школа не указана');
                              const castingTime = getSafeText(spell.castingTime, '1 действие');
                              const spellRange = getSafeText(spell.range, 'дистанция не указана');
                              const spellDuration = getSafeText(spell.duration, 'длительность не указана');
                              const spellComponents = getSafeText(spell.components, 'компоненты не указаны');
                              const spellDamage = getSafeText(spell.damage, '');
                              const spellHealing = getSafeText(spell.healing, '');
                              const spellNotes = getSafeText(spell.notes, '');

                              return (
                                <article className={spell.level === 0 ? 'spell-card cantrip' : 'spell-card'} key={spell.id}>
                                  <div className="spell-card-title">
                                    <div>
                                      <strong>{spellName}</strong>
                                      <small>{getSpellLevelLabel(spell.level)} · {spellSchool}</small>
                                    </div>
                                    <span>{spell.prepared ? 'подготовлено' : 'не подготовлено'}</span>
                                  </div>
                                  <div className="spell-meta-grid">
                                    <span>{castingTime}</span>
                                    <span>{spellRange}</span>
                                    <span>{spellDuration}</span>
                                    <span>{spellComponents}</span>
                                  </div>
                                  {(spellDamage || spellHealing || spellNotes) && (
                                    <small>
                                      {spellDamage ? `Урон: ${spellDamage}` : ''}
                                      {spellDamage && spellHealing ? ' · ' : ''}
                                      {spellHealing ? `Лечение: ${spellHealing}` : ''}
                                      {spellNotes ? ` · ${spellNotes}` : ''}
                                    </small>
                                  )}
                                  <div className="spell-actions">
                                    <button className="primary-button" disabled={!canCast} onClick={() => castSpell(spell)} type="button">
                                      Применить
                                    </button>
                                    <button className="secondary-button" onClick={() => removeSpell(spell.id)} type="button">
                                      Убрать
                                    </button>
                                  </div>
                                </article>
                              );
                            })}
                            {spellcastingDraft.spells.length === 0 && (
                              <article className="spell-card">
                                <strong>Список заклинаний пуст</strong>
                                <small>Добавьте тестовый заговор или заклинание 1 уровня из справочника.</small>
                              </article>
                            )}
                          </div>
                        </section>
                      )}

                      {viewedCampaignState && (
                        <section className="inventory-panel" aria-label="Инвентарь">
                          <div className="inventory-header">
                            <div>
                              <span>Инвентарь кампании</span>
                              <strong>{inventoryWeight.toFixed(1)} фнт.</strong>
                              <small>Предметы, деньги и экипировка сохраняются в состоянии персонажа этой кампании.</small>
                            </div>
                            <div className="equipment-slot-grid" aria-label="Слоты экипировки">
                              {equipmentPreviewSlots.map((slot) => {
                                const equippedArmor =
                                  slot.id === 'torso'
                                    ? inventoryDraft.items.find((item) => item.equippedSlot === 'armor')
                                    : null;
                                const equippedWeapon =
                                  slot.id === 'hands'
                                    ? inventoryDraft.items.find((item) => item.equippedSlot === 'mainHand')
                                    : null;
                                const equippedItem = equippedArmor ?? equippedWeapon;

                                return (
                                  <div className={equippedItem ? 'equipment-slot filled' : 'equipment-slot'} key={slot.id}>
                                    <span>{slot.title}</span>
                                    <strong>{equippedItem?.name ?? 'пусто'}</strong>
                                    <small>{equippedItem ? inventoryKindLabels[equippedItem.kind] : slot.hint}</small>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="money-grid">
                            {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((coin) => (
                              <label className="field filled-field" key={coin}>
                                <span>{coinLabels[coin]}</span>
                                <input
                                  min={0}
                                  type="number"
                                  value={inventoryDraft[coin]}
                                  onChange={(event) => updateMoney(coin, Number(event.target.value))}
                                />
                              </label>
                            ))}
                          </div>

                          <div className="inventory-add-form">
                            <label className={fieldClass(newItemDraft.name)}>
                              <span>Предмет</span>
                              <select value={selectedInventoryCatalogId} onChange={(event) => selectInventoryCatalogItem(event.target.value)}>
                                {inventoryCatalog.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field filled-field">
                              <span>Тип</span>
                              <select
                                disabled={isInventoryKindLocked}
                                value={newItemDraft.kind}
                                onChange={(event) => updateInventoryDraftKind(event.target.value as InventoryItemKind)}
                              >
                                {inventoryKindOptions.map((kind) => (
                                  <option key={kind} value={kind}>
                                    {inventoryKindLabels[kind]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field filled-field">
                              <span>Кол-во</span>
                              <input min={1} type="number" value={newItemDraft.quantity} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, quantity: clampNumber(Number(event.target.value), 1, 9999) }))} />
                            </label>
                            <label className="field filled-field">
                              <span>Вес</span>
                              <input min={0} step={0.1} type="number" value={newItemDraft.weight} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, weight: clampDecimal(Number(event.target.value), 0, 9999) }))} />
                            </label>
                            <label className={fieldClass(newItemDraft.damageDice)}>
                              <span>Урон</span>
                              <input value={newItemDraft.damageDice} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, damageDice: event.target.value }))} placeholder="1к8" />
                            </label>
                            <label className={fieldClass(newItemDraft.damageType)}>
                              <span>Тип урона</span>
                              <input value={newItemDraft.damageType} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, damageType: event.target.value }))} placeholder="рубящий" />
                            </label>
                            <label className="field filled-field">
                              <span>КД доспеха</span>
                              <input min={0} type="number" value={newItemDraft.armorClass} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, armorClass: clampNumber(Number(event.target.value), 0, 40) }))} />
                            </label>
                            <label className="toggle-row inventory-proficiency">
                              <input checked={newItemDraft.proficient} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, proficient: event.target.checked }))} type="checkbox" />
                              <span>Есть владение</span>
                            </label>
                            <label className="field wide-field">
                              <span>Заметка</span>
                              <input value={newItemDraft.notes} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, notes: event.target.value }))} />
                            </label>
                            <button className="secondary-button" onClick={addInventoryItem} type="button">
                              Добавить предмет
                            </button>
                          </div>

                          {transferTargets.length > 0 && (
                            <label className="field transfer-target-field">
                              <span>Кому передавать</span>
                              <select value={transferTargetCharacterId} onChange={(event) => setTransferTargetCharacterId(event.target.value)}>
                                {transferTargets.map((state) => (
                                  <option key={state.id} value={state.characterId}>
                                    {state.character.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}

                          <div className="inventory-table">
                            {inventoryDraft.items.map((item) => (
                              <article className={item.equippedSlot ? 'inventory-row equipped' : 'inventory-row'} key={item.id}>
                                <div>
                                  <strong>{item.name}</strong>
                                  <small>
                                    {inventoryKindLabels[item.kind]} · {item.quantity} шт. · {(item.weight * item.quantity).toFixed(1)} фнт.
                                  </small>
                                  {(item.damageDice || item.armorClass > 0 || item.notes) && (
                                    <small>
                                      {item.damageDice ? `Урон ${item.damageDice}${item.damageType ? ` ${item.damageType}` : ''}` : ''}
                                      {item.damageDice && item.armorClass > 0 ? ' · ' : ''}
                                      {item.armorClass > 0 ? `КД ${item.armorClass}` : ''}
                                      {item.notes ? ` · ${item.notes}` : ''}
                                    </small>
                                  )}
                                </div>
                                <div className="inventory-actions">
                                  <input
                                    aria-label="Количество"
                                    min={0}
                                    type="number"
                                    value={item.quantity}
                                    onChange={(event) => updateItemQuantity(item.id, Number(event.target.value))}
                                  />
                                  <select
                                    aria-label="Контекстное действие"
                                    value={item.equippedSlot ?? ''}
                                    onChange={(event) => equipInventoryItem(item, event.target.value ? (event.target.value as EquipmentSlot) : null)}
                                  >
                                    <option value="">В сумке</option>
                                    <option value="mainHand">Основная рука</option>
                                    <option value="offHand">Вторая рука</option>
                                    <option value="armor">Доспех</option>
                                    <option value="quick">Быстрый слот</option>
                                  </select>
                                  <button className="secondary-button" disabled={transferTargets.length === 0} onClick={() => transferInventoryItem(item)} type="button">
                                    Передать
                                  </button>
                                </div>
                              </article>
                            ))}
                            {inventoryDraft.items.length === 0 && (
                              <article className="inventory-row">
                                <div>
                                  <strong>Инвентарь пуст</strong>
                                  <small>Добавьте меч, доспех, зелье или любую заметку.</small>
                                </div>
                              </article>
                            )}
                          </div>
                        </section>
                      )}

                      <section className="ability-grid" aria-label="Характеристики">
                        {abilityKeys.map((key) => (
                          <label className="ability-card filled-field" key={key}>
                            <span>{abilityLabels[key]}</span>
                            <input min={1} max={30} type="number" value={sheetDraft.abilityScores[key]} onChange={(event) => updateAbilityScore(key, Number(event.target.value))} />
                            <strong>{formatModifier(getModifier(sheetDraft.abilityScores[key]))}</strong>
                          </label>
                        ))}
                      </section>

                      <section className="skill-grid" aria-label="Навыки">
                        {skillList.map((skill) => (
                          <label className="skill-row" key={skill.id}>
                            <input checked={sheetDraft.skillProficiencies.includes(skill.id)} onChange={() => toggleSkill(skill.id)} type="checkbox" />
                            <span>{skill.title}</span>
                            <strong>{formatModifier(getSkillBonus(sheetDraft, skill.id, skill.ability))}</strong>
                          </label>
                        ))}
                      </section>

                      <label className="field">
                        <span>Пассивные особенности</span>
                        <textarea
                          rows={5}
                          value={sheetDraft.passiveFeatures}
                          onChange={(event) => patchSheetDraft({ passiveFeatures: event.target.value })}
                          placeholder="Черты класса, расы, предыстории и постоянные эффекты."
                        />
                      </label>

                      <div className="button-row">
                        <button className="primary-button" disabled={Boolean(viewedCampaignState)} type="submit">
                          Сохранить лист
                        </button>
                        <button className="secondary-button" disabled={Boolean(viewedCampaignState)} onClick={() => setSheetDraft(createDraftFromCharacter(selectedCharacter))} type="button">
                          Сбросить правки
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {data && screen === 'create-campaign' && (
          <section className="screen-panel department-screen">
            <div className="screen-brand">Костёр · D&amp;D 5e 2014</div>
            <button className="secondary-button back-button" onClick={() => setScreen('main-menu')} type="button">
              Назад
            </button>
            <p className="eyebrow">Мастер игры</p>
            <div className="section-title-row">
              <h2>Создать кампанию</h2>
              <button className="primary-button" form="campaign-create-form" type="submit">
                Сохранить кампанию
              </button>
            </div>
            <form className="creator-grid" id="campaign-create-form" onSubmit={createCampaign}>
              <label className={fieldClass(campaignName)}>
                <span>Название кампании</span>
                <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
              </label>
              <label className={fieldClass(campaignSettingId)}>
                <span>Сеттинг</span>
                <select value={campaignSettingId} onChange={(event) => setCampaignSettingId(event.target.value)}>
                  <option value="">Универсальная кампания</option>
                  {data.settings.map((setting) => (
                    <option key={setting.id} value={setting.id}>
                      {setting.titleRu}
                    </option>
                  ))}
                </select>
              </label>
              <label className="toggle-row dlc-toggle">
                <input checked={includeSettingDlc} onChange={(event) => setIncludeSettingDlc(event.target.checked)} type="checkbox" />
                <span>Включить DLC сеттинга и универсальные DLC</span>
              </label>
              <label className="toggle-row dlc-toggle">
                <input checked={includeHomebrewDlc} onChange={(event) => setIncludeHomebrewDlc(event.target.checked)} type="checkbox" />
                <span>Включить все хоумбрю DLC</span>
              </label>
              <label className="field wide-field">
                <span>Заметка мастера</span>
                <textarea value={campaignDescription} onChange={(event) => setCampaignDescription(event.target.value)} rows={4} />
              </label>
              <button className="primary-button" type="submit">
                Сохранить кампанию
              </button>
            </form>

            {createdCampaign && (
              <div className="choice-box campaign-created-actions">
                <strong>Кампания «{getCampaignDisplayName(createdCampaign)}» сохранена.</strong>
                <small>Можно сразу открыть игровую комнату или перейти к карточке кампании и продолжить настройку.</small>
                <div className="button-row">
                  <button className="primary-button" onClick={startCreatedCampaign} type="button">
                    Запустить кампанию
                  </button>
                  <button className="secondary-button" onClick={() => setScreen('campaigns')} type="button">
                    Сохранить и открыть просмотр
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {data && screen === 'campaigns' && (
          <section className="screen-panel department-screen">
            <div className="screen-brand">Костёр · D&amp;D 5e 2014</div>
            <button className="secondary-button back-button" onClick={() => setScreen('main-menu')} type="button">
              Назад
            </button>
            <p className="eyebrow">Мастерская</p>
            <div className="section-title-row">
              <h2>Кампании</h2>
              <button className="primary-button" onClick={() => setScreen('create-campaign')} type="button">
                Создать кампанию
              </button>
            </div>
            <div className="two-column">
              <div className="list-panel">
                {data.campaigns.map((campaign) => (
                  <button
                    className={activeCampaign?.id === campaign.id ? 'list-button active' : 'list-button'}
                    key={campaign.id}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    type="button"
                  >
                    <strong>{getCampaignDisplayName(campaign)}</strong>
                    <small>{campaign.rooms.length} комнат · {campaign.members.length} игроков</small>
                  </button>
                ))}
              </div>

              {activeCampaign && (
                <div className="detail-panel">
                  <div className="detail-title-row">
                    <h3>{getCampaignDisplayName(activeCampaign)}</h3>
                    <div className="button-row">
                      <button className="secondary-button" onClick={loadCampaign} type="button">
                        Загрузить кампанию
                      </button>
                      {currentUserRoomParticipant && (
                        <button className="secondary-button leave-button" onClick={leaveCampaign} type="button">
                          Выйти из кампании
                        </button>
                      )}
                      <button className="danger-button" onClick={() => beginDeleteCampaign(activeCampaign.id)} type="button">
                        Удалить
                      </button>
                    </div>
                  </div>

                  {deleteCampaignId === activeCampaign.id && (
                    <div className="confirm-box">
                      {!deleteCampaignArmed ? (
                        <>
                          <strong>Вы уверены что хотите удалить?</strong>
                          <div className="button-row">
                            <button className="danger-button" onClick={() => setDeleteCampaignArmed(true)} type="button">
                              Да
                            </button>
                            <button className="secondary-button" onClick={cancelDeleteCampaign} type="button">
                              Отмена
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="field">
                            <span>Напишите слово "удалить"</span>
                            <input value={deleteCampaignText} onChange={(event) => setDeleteCampaignText(event.target.value)} />
                          </label>
                          <div className="button-row">
                            <button
                              className="danger-button"
                              disabled={deleteCampaignText.trim().toLocaleLowerCase('ru-RU') !== 'удалить'}
                              onClick={confirmDeleteCampaign}
                              type="button"
                            >
                              Удалить кампанию
                            </button>
                            <button className="secondary-button" onClick={cancelDeleteCampaign} type="button">
                              Отмена
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div className="code-card">
                    <span>Код подключения</span>
                    <strong>{activeRoom?.inviteCode ?? 'Комната не открыта'}</strong>
                    <small>Игрок открывает адрес мастера в локальной сети и вводит этот код.</small>
                  </div>
                  <div className="lan-card">
                    <div>
                      <span>LAN-адрес мастера</span>
                      <strong>{primaryLanUrl}</strong>
                    </div>
                    <small>
                      {network?.lanFrontendUrls.length
                        ? 'Откройте этот адрес на втором устройстве в той же сети.'
                        : 'LAN-адрес не найден автоматически. Проверьте, что устройства в одной сети.'}
                    </small>
                    <div className="lan-url-list">
                      {visibleLanUrls.map((url) => (
                        <code key={url}>{url}</code>
                      ))}
                    </div>
                  </div>
                  <div className={`realtime-card ${realtimeStatus}`}>
                    <div>
                      <span>Синхронизация комнаты</span>
                      <strong>{getRealtimeStatusLabel(realtimeStatus)}</strong>
                    </div>
                    <small>{getRealtimeEventLabel(lastRealtimeEvent)}</small>
                  </div>
                  <div
                    className="stat-grid campaign-stats"
                    onClick={(event) => {
                      const card = (event.target as HTMLElement).closest('.campaign-stats > div');
                      if (!card) {
                        return;
                      }
                      const index = Array.from(event.currentTarget.children).indexOf(card);
                      if (index === 0) {
                        setCampaignInspect('players');
                      }
                      if (index === 1) {
                        setCampaignInspect('characters');
                      }
                    }}
                  >
                    <div>
                      <span>Игроки в комнате</span>
                      <strong>{onlineParticipantCount}/{activeRoomParticipants.length}</strong>
                    </div>
                    <div>
                      <span>Персонажей</span>
                      <strong>{activeCampaign.characterStates.length}</strong>
                    </div>
                    <div>
                      <span>Источников</span>
                      <strong>{enabledSourceCount}/{activeCampaign.sourceBooks.length}</strong>
                    </div>
                    <div>
                      <span>Статус</span>
                      <strong>{activeCampaign.status}</strong>
                    </div>
                  </div>
                  <section className="turn-panel" aria-label="Походовый режим">
                    <div className="source-manager-header">
                      <div>
                        <span>Походовый режим</span>
                        <strong>{activeTurnEncounter ? `Раунд ${activeTurnEncounter.round}` : 'свободно'}</strong>
                        <small>
                          {currentTurnParticipant
                            ? `Сейчас ходит: ${currentTurnParticipant.name}`
                            : 'Инициатива выключена. Можно начать сцену из персонажей кампании.'}
                        </small>
                      </div>
                      <div className="button-row">
                        {!activeTurnEncounter ? (
                          <button className="primary-button" onClick={startTurnEncounter} type="button">
                            Начать инициативу
                          </button>
                        ) : (
                          <>
                            <button className="primary-button" onClick={advanceTurn} type="button">
                              Следующий ход
                            </button>
                            <button className="secondary-button" onClick={endTurnEncounter} type="button">
                              Завершить
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {activeTurnEncounter ? (
                      <>
                        <div className="turn-summary-grid">
                          <div>
                            <span>Участники</span>
                            <strong>{activeTurnParticipants.length}</strong>
                          </div>
                          <div>
                            <span>Текущий ход</span>
                            <strong>{currentTurnParticipant?.name ?? 'нет'}</strong>
                          </div>
                          <div>
                            <span>Эффекты</span>
                            <strong>{activeTurnEncounter.effects.filter((effect) => effect.isActive).length}</strong>
                          </div>
                        </div>

                        <div className="turn-tools">
                          <label className="field">
                            <span>NPC</span>
                            <input value={turnNpcName} onChange={(event) => setTurnNpcName(event.target.value)} />
                          </label>
                          <label className="field filled-field">
                            <span>Инициатива</span>
                            <input
                              type="number"
                              value={turnNpcInitiative}
                              onChange={(event) => setTurnNpcInitiative(clampNumber(Number(event.target.value), -10, 40))}
                            />
                          </label>
                          <button className="secondary-button" onClick={addTurnNpc} type="button">
                            Добавить NPC
                          </button>
                        </div>

                        <div className="turn-order-list">
                          {activeTurnParticipants.map((participant) => {
                            const isCurrent = participant.id === currentTurnParticipant?.id;
                            const passiveFeatures = getTurnParticipantPassiveFeatures(participant);

                            return (
                              <article className={isCurrent ? 'turn-row current' : 'turn-row'} key={participant.id}>
                                <div className="turn-row-main">
                                  <div>
                                    <strong>{participant.name}</strong>
                                    <small>
                                      {participant.kind === 'npc' ? 'NPC' : 'Игрок'} · КД {participant.armorClass} · HP {participant.currentHp}/{participant.maxHp}
                                    </small>
                                    {passiveFeatures && <small className="passive-hint">Пассивно: {passiveFeatures}</small>}
                                  </div>
                                  <label className="field compact-field">
                                    <span>Иниц.</span>
                                    <input
                                      defaultValue={participant.initiative}
                                      onBlur={(event) => updateTurnInitiative(participant, Number(event.target.value))}
                                      type="number"
                                    />
                                  </label>
                                </div>
                                <div className="turn-resource-grid">
                                  {(['action', 'bonusAction', 'reaction'] as const).map((resource) => {
                                    const used = resource === 'action' ? participant.actionUsed : resource === 'bonusAction' ? participant.bonusActionUsed : participant.reactionUsed;
                                    return (
                                      <div className={used ? 'turn-resource used' : 'turn-resource'} key={resource}>
                                        <button onClick={() => markTurnResource(participant, resource)} type="button">
                                          {getTurnResourceLabel(resource)}
                                        </button>
                                        {used && (
                                          <button className="override-button" onClick={() => markTurnResource(participant, resource, true)} type="button">
                                            Override
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div className={participant.movementUsed > participant.movementLimit ? 'turn-resource used warning' : 'turn-resource'}>
                                    <button onClick={() => markTurnResource(participant, 'movement')} type="button">
                                      Движение {participant.movementUsed}/{participant.movementLimit}
                                    </button>
                                    {participant.movementUsed >= participant.movementLimit && (
                                      <button className="override-button" onClick={() => markTurnResource(participant, 'movement', true)} type="button">
                                        Override
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>

                        <div className="turn-tools effect-tools">
                          <label className="field">
                            <span>Эффект</span>
                            <input value={turnEffectName} onChange={(event) => setTurnEffectName(event.target.value)} />
                          </label>
                          <label className="field filled-field">
                            <span>Раунды</span>
                            <input
                              min={1}
                              type="number"
                              value={turnEffectRounds}
                              onChange={(event) => setTurnEffectRounds(clampNumber(Number(event.target.value), 1, 999))}
                            />
                          </label>
                          <label className="field">
                            <span>Цель</span>
                            <select value={turnEffectParticipantId} onChange={(event) => setTurnEffectParticipantId(event.target.value)}>
                              <option value="">Вся сцена</option>
                              {activeTurnParticipants.map((participant) => (
                                <option key={participant.id} value={participant.id}>
                                  {participant.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="secondary-button" onClick={addTurnEffect} type="button">
                            Добавить эффект
                          </button>
                        </div>

                        <div className="turn-effects-list">
                          {activeTurnEncounter.effects.map((effect) => (
                            <article className={effect.isActive ? 'effect-row' : 'effect-row expired'} key={effect.id}>
                              <strong>{effect.name}</strong>
                              <small>
                                {effect.participant?.name ?? 'Вся сцена'} · {effect.remainingRounds} раунд. · {effect.isActive ? 'активен' : 'завершен'}
                              </small>
                            </article>
                          ))}
                          {activeTurnEncounter.effects.length === 0 && (
                            <article className="effect-row">
                              <strong>Эффектов пока нет</strong>
                              <small>Добавьте бафф, дебафф или состояние с длительностью в раундах.</small>
                            </article>
                          )}
                        </div>
                      </>
                    ) : (
                      <article className="turn-empty">
                        <strong>Походовый режим выключен</strong>
                        <small>Начните инициативу, чтобы приложение отслеживало раунды, ход, экономику действий и эффекты.</small>
                      </article>
                    )}
                  </section>
                  <section className="rest-panel" aria-label="Отдых">
                    <div className="source-manager-header rest-header">
                      <div>
                        <span>Отдых</span>
                        <strong>{getRestTypeLabel(restType)}</strong>
                        <small>{activeTurnEncounter ? 'Активная сцена требует подтверждения мастера.' : 'Группа вне инициативы.'}</small>
                      </div>
                      <div className="rest-actions">
                        <label className="field">
                          <span>Тип отдыха</span>
                          <select value={restType} onChange={(event) => setRestType(event.target.value as RestType)}>
                            <option value="short">Короткий</option>
                            <option value="long">Длинный</option>
                          </select>
                        </label>
                        <button className="primary-button" onClick={() => runCampaignRest(false)} type="button">
                          Провести отдых
                        </button>
                        {activeTurnEncounter && (
                          <button className="secondary-button" onClick={() => runCampaignRest(true)} type="button">
                            Подтвердить
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rest-character-grid">
                      {activeCampaign.characterStates.map((state) => {
                        const rest = parseRestState(state.sheetJson, state.level);
                        const hitDiceToSpend = clampNumber(restHitDiceByCharacter[state.characterId] ?? 0, 0, rest.hitDiceCurrent);
                        const healing = hitDiceToSpend * getAverageHitDieHealing(rest.hitDieSize);
                        const nextHp = restType === 'short' ? Math.min(state.maxHp, state.currentHp + healing) : state.maxHp;
                        const nextHitDice =
                          restType === 'short'
                            ? rest.hitDiceCurrent - hitDiceToSpend
                            : Math.min(rest.hitDiceMax, rest.hitDiceCurrent + Math.max(1, Math.floor(rest.hitDiceMax / 2)));
                        const spellcasting = parseSpellcasting(state.sheetJson);
                        const slotCurrent = Object.values(spellcasting.slots).reduce((sum, slot) => sum + slot.current, 0);
                        const slotMax = Object.values(spellcasting.slots).reduce((sum, slot) => sum + slot.max, 0);

                        return (
                          <article className="rest-row" key={state.id}>
                            <div>
                              <strong>{state.character.name}</strong>
                              <small>
                                HP {state.currentHp}/{state.maxHp} {'->'} {nextHp}/{state.maxHp}
                              </small>
                              <small>
                                Кости хитов {rest.hitDiceCurrent}/{rest.hitDiceMax} {'->'} {nextHitDice}/{rest.hitDiceMax} · к{rest.hitDieSize}
                              </small>
                              <small>
                                Слоты {slotCurrent}/{slotMax} · {spellcasting.resources.primaryName} {spellcasting.resources.current}/{spellcasting.resources.max}
                              </small>
                            </div>
                            {restType === 'short' ? (
                              <label className="field compact-field">
                                <span>Потратить</span>
                                <input
                                  max={rest.hitDiceCurrent}
                                  min={0}
                                  type="number"
                                  value={hitDiceToSpend}
                                  onChange={(event) => updateRestHitDice(state.characterId, Number(event.target.value))}
                                />
                              </label>
                            ) : (
                              <span className="rest-result-pill">полное восстановление</span>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                  <section className="merchant-panel" aria-label="Торговцы и кража">
                    <div className="source-manager-header merchant-header">
                      <div>
                        <span>Торговцы</span>
                        <strong>{activeMerchant?.name ?? 'нет торговца'}</strong>
                        <small>Касса торговца видна только мастеру.</small>
                      </div>
                      <div className="merchant-create-row">
                        <label className="field">
                          <span>Имя</span>
                          <input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} />
                        </label>
                        <button className="secondary-button" onClick={createMerchant} type="button">
                          Создать торговца
                        </button>
                      </div>
                    </div>

                    {activeMerchant ? (
                      <>
                        <div className="merchant-toolbar">
                          <label className="field">
                            <span>Торговец</span>
                            <select value={activeMerchant.id} onChange={(event) => setSelectedMerchantId(event.target.value)}>
                              {activeCampaign.merchants.map((merchant) => (
                                <option key={merchant.id} value={merchant.id}>
                                  {merchant.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Активный покупатель</span>
                            <select value={activeBuyerState?.id ?? ''} onChange={(event) => updateMerchantBuyer(event.target.value)}>
                              {activeCampaign.characterStates.map((state) => (
                                <option key={state.id} value={state.id}>
                                  {state.character.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="merchant-cash">
                            <span>Касса</span>
                            <strong>{activeMerchantInventory.gp} золота</strong>
                          </div>
                        </div>

                        <div className="merchant-stock-form">
                          <label className="field">
                            <span>Предмет</span>
                            <select value={merchantCatalogItemId} onChange={(event) => setMerchantCatalogItemId(event.target.value)}>
                              {inventoryCatalog.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field filled-field">
                            <span>Цена, золото</span>
                            <input
                              min={1}
                              type="number"
                              value={merchantItemPrice}
                              onChange={(event) => setMerchantItemPrice(clampNumber(Number(event.target.value), 1, 999999))}
                            />
                          </label>
                          <label className="field filled-field">
                            <span>Кол-во</span>
                            <input
                              min={1}
                              type="number"
                              value={merchantItemQuantity}
                              onChange={(event) => setMerchantItemQuantity(clampNumber(Number(event.target.value), 1, 9999))}
                            />
                          </label>
                          <button className="secondary-button" onClick={addMerchantItem} type="button">
                            Добавить товар
                          </button>
                        </div>

                        <div className="merchant-trade-grid">
                          <div className="merchant-list-box">
                            <div className="merchant-list-title">
                              <strong>Товары</strong>
                              <span>{activeMerchantInventory.items.length}</span>
                            </div>
                            {activeMerchantInventory.items.map((item) => (
                              <article className="merchant-item-row" key={item.id}>
                                <div>
                                  <strong>{item.name}</strong>
                                  <small>
                                    {inventoryKindLabels[item.kind]} · {item.quantity} шт. · {getInventoryItemPrice(item, activeMerchant.priceMultiplier)} зол.
                                  </small>
                                </div>
                                <div className="button-row">
                                  <button className="secondary-button" disabled={!activeBuyerState} onClick={() => buyMerchantItem(item)} type="button">
                                    Купить
                                  </button>
                                  <button className="secondary-button" disabled={!activeBuyerState} onClick={() => requestTheft(item)} type="button">
                                    Кража
                                  </button>
                                </div>
                              </article>
                            ))}
                            {activeMerchantInventory.items.length === 0 && (
                              <article className="merchant-item-row">
                                <div>
                                  <strong>Товаров нет</strong>
                                  <small>Добавьте предмет из справочника-заглушки.</small>
                                </div>
                              </article>
                            )}
                          </div>

                          <div className="merchant-list-box">
                            <div className="merchant-list-title">
                              <strong>{activeBuyerState?.character.name ?? 'Покупатель'}</strong>
                              <span>{activeBuyerInventory.gp} зол.</span>
                            </div>
                            {activeBuyerInventory.items.map((item) => (
                              <article className="merchant-item-row" key={item.id}>
                                <div>
                                  <strong>{item.name}</strong>
                                  <small>
                                    {inventoryKindLabels[item.kind]} · {item.quantity} шт. · продажа {Math.max(1, Math.floor(getInventoryItemPrice(item, 0.5)))} зол.
                                  </small>
                                </div>
                                <button className="secondary-button" disabled={!activeBuyerState} onClick={() => sellMerchantItem(item)} type="button">
                                  Продать
                                </button>
                              </article>
                            ))}
                            {activeBuyerInventory.items.length === 0 && (
                              <article className="merchant-item-row">
                                <div>
                                  <strong>Инвентарь пуст</strong>
                                  <small>Персонажу нечего продать.</small>
                                </div>
                              </article>
                            )}
                          </div>
                        </div>

                        <div className="theft-panel">
                          <label className="field">
                            <span>Заметка к краже</span>
                            <input value={merchantTheftNotes} onChange={(event) => setMerchantTheftNotes(event.target.value)} />
                          </label>
                          <div className="mini-list inspector-list">
                            {activeMerchant.theftRequests.map((request) => {
                              const thief = activeCampaign.characterStates.find((state) => state.id === request.characterStateId);

                              return (
                                <article className={request.status === 'pending' ? 'mini-row' : 'mini-row muted-row'} key={request.id}>
                                  <div>
                                    <strong>{request.itemName}</strong>
                                    <small>
                                      {thief?.character.name ?? 'Персонаж'} · СЛ {request.dc} · {getTheftStatusLabel(request.status)}
                                    </small>
                                  </div>
                                  {request.status === 'pending' && (
                                    <div className="button-row">
                                      <button className="secondary-button" onClick={() => resolveTheftRequest(request, true)} type="button">
                                        Одобрить
                                      </button>
                                      <button className="danger-button compact-danger" onClick={() => resolveTheftRequest(request, false)} type="button">
                                        Отклонить
                                      </button>
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                            {activeMerchant.theftRequests.length === 0 && (
                              <article className="mini-row">
                                <div>
                                  <strong>Запросов на кражу нет</strong>
                                  <small>Игрок выбирает товар и отправляет запрос мастеру.</small>
                                </div>
                              </article>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <article className="turn-empty">
                        <strong>Торговец еще не создан</strong>
                        <small>Создайте лавку для этой кампании.</small>
                      </article>
                    )}
                  </section>
                  <section className="npc-panel" aria-label="NPC мастера">
                    <div className="source-manager-header merchant-header">
                      <div>
                        <span>NPC мастера</span>
                        <strong>{activeNpc?.name ?? 'нет NPC'}</strong>
                        <small>{activeNpc ? `${activeNpc.socialClass} · ${activeNpc.wealthTier}` : 'Создайте NPC для сцены.'}</small>
                      </div>
                      <div className="merchant-create-row">
                        <label className="field">
                          <span>Имя NPC</span>
                          <input value={npcName} onChange={(event) => setNpcName(event.target.value)} />
                        </label>
                        <button className="secondary-button" onClick={() => createNpc(false)} type="button">
                          Создать NPC
                        </button>
                        <button className="secondary-button" onClick={() => createNpc(true)} type="button">
                          Случайный
                        </button>
                      </div>
                    </div>

                    {activeNpc ? (
                      <>
                        <div className="merchant-toolbar">
                          <label className="field">
                            <span>NPC</span>
                            <select value={activeNpc.id} onChange={(event) => setSelectedNpcId(event.target.value)}>
                              {activeCampaign.npcProfiles.map((npc) => (
                                <option key={npc.id} value={npc.id}>
                                  {npc.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Кто крадет</span>
                            <select value={activeHomebrewTargetState?.id ?? ''} onChange={(event) => setHomebrewTargetStateId(event.target.value)}>
                              {activeCampaign.characterStates.map((state) => (
                                <option key={state.id} value={state.id}>
                                  {state.character.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="secondary-button" onClick={() => activateNpc(activeNpc)} type="button">
                            Сделать активным
                          </button>
                          <button className="secondary-button" onClick={generateNpcLoot} type="button">
                            Сгенерировать лут
                          </button>
                        </div>

                        <div className="npc-summary-grid">
                          <div>
                            <span>КД</span>
                            <strong>{activeNpcStats.armorClass}</strong>
                          </div>
                          <div>
                            <span>HP</span>
                            <strong>
                              {activeNpcStats.currentHp}/{activeNpcStats.maxHp}
                            </strong>
                          </div>
                          <div>
                            <span>Скорость</span>
                            <strong>{activeNpcStats.speed}</strong>
                          </div>
                          <div>
                            <span>Деньги</span>
                            <strong>{activeNpcInventory.gp} зол.</strong>
                          </div>
                        </div>

                        <div className="merchant-trade-grid">
                          <div className="merchant-list-box">
                            <div className="merchant-list-title">
                              <strong>Лут NPC</strong>
                              <span>{activeNpcInventory.items.length}</span>
                            </div>
                            {activeNpcInventory.items.map((item) => (
                              <article className="merchant-item-row" key={item.id}>
                                <div>
                                  <strong>{item.name}</strong>
                                  <small>
                                    {inventoryKindLabels[item.kind]} · {item.quantity} шт. · {getInventoryItemPrice(item)} зол.
                                  </small>
                                </div>
                                <button className="secondary-button" onClick={() => requestNpcTheft(item)} type="button">
                                  Кража
                                </button>
                              </article>
                            ))}
                            {activeNpcInventory.items.length === 0 && (
                              <article className="merchant-item-row">
                                <div>
                                  <strong>Лута нет</strong>
                                  <small>Сгенерируйте или создайте другого NPC.</small>
                                </div>
                              </article>
                            )}
                          </div>

                          <div className="theft-panel">
                            <label className="field">
                              <span>Заметка к краже</span>
                              <input value={npcTheftNotes} onChange={(event) => setNpcTheftNotes(event.target.value)} />
                            </label>
                            <div className="mini-list inspector-list">
                              {activeNpc.theftRequests.map((request) => {
                                const thief = activeCampaign.characterStates.find((state) => state.id === request.characterStateId);

                                return (
                                  <article className={request.status === 'pending' ? 'mini-row' : 'mini-row muted-row'} key={request.id}>
                                    <div>
                                      <strong>{request.itemName}</strong>
                                      <small>
                                        {thief?.character.name ?? 'Персонаж'} · СЛ {request.dc} · {getTheftStatusLabel(request.status)}
                                      </small>
                                    </div>
                                    {request.status === 'pending' && (
                                      <div className="button-row">
                                        <button className="secondary-button" onClick={() => resolveNpcTheftRequest(request, true)} type="button">
                                          Одобрить
                                        </button>
                                        <button className="danger-button compact-danger" onClick={() => resolveNpcTheftRequest(request, false)} type="button">
                                          Отклонить
                                        </button>
                                      </div>
                                    )}
                                  </article>
                                );
                              })}
                              {activeNpc.theftRequests.length === 0 && (
                                <article className="mini-row">
                                  <div>
                                    <strong>Краж у NPC нет</strong>
                                    <small>Выберите предмет из лута NPC.</small>
                                  </div>
                                </article>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <article className="turn-empty">
                        <strong>NPC еще не создан</strong>
                        <small>Создайте вручную или сгенерируйте случайного.</small>
                      </article>
                    )}
                  </section>
                  <section className="document-panel" aria-label="Документы и заметки">
                    <div className="source-manager-header merchant-header">
                      <div>
                        <span>Документы</span>
                        <strong>{activeDocument?.title ?? 'нет документа'}</strong>
                        <small>{activeDocument ? `чернила: ${activeDocument.inkUsed} · ${activeDocument.isShownToGm ? 'показано мастеру' : 'личный документ'}` : 'Создайте записку.'}</small>
                      </div>
                      <div className="merchant-create-row">
                        <label className="field">
                          <span>Название</span>
                          <input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} />
                        </label>
                        <button className="secondary-button" onClick={createDocument} type="button">
                          Создать документ
                        </button>
                      </div>
                    </div>

                    {activeDocument ? (
                      <>
                        <div className="merchant-toolbar">
                          <label className="field">
                            <span>Документ</span>
                            <select value={activeDocument.id} onChange={(event) => setSelectedDocumentId(event.target.value)}>
                              {activeCampaign.noteDocuments.map((document) => (
                                <option key={document.id} value={document.id}>
                                  {document.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Персонаж</span>
                            <select value={activeHomebrewTargetState?.id ?? ''} onChange={(event) => setHomebrewTargetStateId(event.target.value)}>
                              {activeCampaign.characterStates.map((state) => (
                                <option key={state.id} value={state.id}>
                                  {state.character.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="secondary-button" onClick={() => saveDocument(false)} type="button">
                            Сохранить
                          </button>
                          <button className="secondary-button" onClick={() => saveDocument(true)} type="button">
                            Показать мастеру
                          </button>
                          <button className="secondary-button" onClick={transferDocument} type="button">
                            Передать
                          </button>
                        </div>

                        <div className="document-editor-grid">
                          <label className="field document-text-field">
                            <span>Текст</span>
                            <textarea value={documentTextDraft} onChange={(event) => setDocumentTextDraft(event.target.value)} rows={8} />
                          </label>
                          <div className="document-drawing-box">
                            <div className="merchant-list-title">
                              <strong>Рисунок</strong>
                              <button className="secondary-button" onClick={() => setDocumentDrawingDraft([])} type="button">
                                Очистить
                              </button>
                            </div>
                            <svg
                              className="drawing-pad"
                              onPointerDown={startDocumentStroke}
                              onPointerLeave={endDocumentStroke}
                              onPointerMove={moveDocumentStroke}
                              onPointerUp={endDocumentStroke}
                              viewBox="0 0 100 100"
                            >
                              {[...documentDrawingDraft, activeDrawingPath].filter(Boolean).map((path, index) => (
                                <path d={path} key={`${path}-${index}`} />
                              ))}
                            </svg>
                          </div>
                        </div>

                        <div className="mini-list inspector-list">
                          {parseDocumentHistory(activeDocument.historyJson).slice(-5).map((entry, index) => {
                            const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};

                            return (
                              <article className="mini-row" key={`${activeDocument.id}-${index}`}>
                                <div>
                                  <strong>{typeof record.action === 'string' ? record.action : 'update'}</strong>
                                  <small>{typeof record.at === 'string' ? formatDate(record.at) : 'без даты'}</small>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <article className="turn-empty">
                        <strong>Документов пока нет</strong>
                        <small>Создайте записку для выбранного персонажа.</small>
                      </article>
                    )}
                  </section>
                  {campaignInspect === 'players' && (
                    <div className="mini-list inspector-list">
                      {activeRoomParticipants.map((participant) => (
                        <article className="mini-row" key={participant.id}>
                          <div>
                            <strong>{participant.user.displayName}</strong>
                            <small>
                              {participant.character?.name ?? 'Персонаж не выбран'} · ID игрока: {participant.user.id}
                            </small>
                          </div>
                          <span className={`status-pill ${participant.status}`}>{getConnectionStatusLabel(participant.status)}</span>
                        </article>
                      ))}
                      {activeRoomParticipants.length === 0 && (
                        <article className="mini-row">
                          <div>
                            <strong>Игроки еще не подключались</strong>
                            <small>Когда игрок войдет по коду, он появится здесь без обновления страницы.</small>
                          </div>
                        </article>
                      )}
                    </div>
                  )}
                  {campaignInspect === 'characters' && (
                  <div className="mini-list inspector-list">
                    {activeCampaign.characterStates.map((state) => (
                      <article className="mini-row" key={state.id}>
                        <div>
                          <strong>{state.character.name}</strong>
                          <small>ID персонажа: {state.character.id}</small>
                        </div>
                        <span>ур. {state.level}</span>
                      </article>
                    ))}
                  </div>
                  )}
                  <section className="action-history-panel" aria-label="История действий">
                    <div className="source-manager-header">
                      <div>
                        <span>История действий</span>
                        <strong>{activeCampaignActions.length}</strong>
                        <small>Заклинания, HP, передача предметов и откаты мастера.</small>
                      </div>
                    </div>
                    <div className="mini-list inspector-list">
                      {activeCampaignActions.map((snapshot) => (
                        <article className={isRevertedAction(snapshot) ? 'mini-row reverted-action' : 'mini-row'} key={snapshot.id}>
                          <div>
                            <strong>{snapshot.summary}</strong>
                            <small>
                              {getActionKindLabel(snapshot)} · {snapshot.user?.displayName ?? 'Система'} · {formatDate(snapshot.createdAt)}
                              {isRevertedAction(snapshot) ? ' · отменено' : ''}
                            </small>
                          </div>
                          {canUndoAction(snapshot) && (
                            <button className="secondary-button" onClick={() => undoAction(snapshot)} type="button">
                              Отменить
                            </button>
                          )}
                        </article>
                      ))}
                      {activeCampaignActions.length === 0 && (
                        <article className="mini-row">
                          <div>
                            <strong>История пока пуста</strong>
                            <small>Примените заклинание, измените HP или передайте предмет.</small>
                          </div>
                        </article>
                      )}
                    </div>
                  </section>
                  <section className="source-manager" aria-label="Источники dnd.su">
                    <div className="source-manager-header">
                      <div>
                        <span>Активные источники dnd.su</span>
                        <strong>{enabledSourceCount}/{activeCampaign.sourceBooks.length}</strong>
                        <small>Источник: каталог dnd.su.</small>
                      </div>
                      {activeRoom && (
                        <label className="field room-setting-field">
                          <span>Сеттинг комнаты</span>
                          <select value={activeRoom.setting?.id ?? ''} onChange={(event) => updateRoomSetting(event.target.value)}>
                            <option value="">Наследовать кампанию</option>
                            {data.settings.map((setting) => (
                              <option key={setting.id} value={setting.id}>
                                {setting.titleRu}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>

                    <div className="source-toolbar">
                      <label className="field source-search">
                        <span>Поиск</span>
                        <input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Название источника" />
                      </label>
                      <div className="tabs source-filter-tabs">
                        {(['all', 'active', 'inactive', 'homebrew', 'core'] as SourceFilter[]).map((filter) => (
                          <button
                            className={sourceFilter === filter ? 'tab active' : 'tab'}
                            key={filter}
                            onClick={() => setSourceFilter(filter)}
                            type="button"
                          >
                            {getSourceFilterLabel(filter)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="source-table">
                      {filteredSourceLinks.map((link) => {
                        const sourceBook = link.sourceBook;
                        const roomOverride = activeRoom?.sourceOverrides.find((override) => override.sourceBook.id === sourceBook.id);
                        const effectiveEnabled = roomOverride?.isEnabled ?? link.isEnabled;

                        return (
                          <article className={effectiveEnabled ? 'source-row active' : 'source-row'} key={link.id}>
                            <div className="source-main">
                              <strong>{sourceBook.titleRu}</strong>
                              <small>{sourceBook.titleOriginal ?? 'Название dnd.su'} · {getEditionLabel(sourceBook.editionCompatibility)}</small>
                              <small>Источник: dnd.su</small>
                              <div className="source-badges">
                                {sourceBook.isCore && <span>базовый</span>}
                                <span>{getQualityLabel(sourceBook.quality)}</span>
                                {isHomebrewSource(sourceBook) && <span>хоумбрю</span>}
                                <span>{effectiveEnabled ? 'активен' : 'выключен'}</span>
                              </div>
                            </div>
                            <div className="source-controls">
                              <button
                                className={link.isEnabled ? 'source-pill active' : 'source-pill'}
                                onClick={() => updateCampaignSource(link)}
                                type="button"
                              >
                                {link.isEnabled ? 'В кампании включен' : 'В кампании выключен'}
                              </button>
                              {activeRoom && (
                                <label className="field room-override-field">
                                  <span>Комната</span>
                                  <select
                                    value={(roomOverride?.isEnabled ?? link.isEnabled) ? 'enabled' : 'disabled'}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      updateRoomSourceOverride(link, value === 'enabled');
                                    }}
                                  >
                                    <option value="enabled">Включить</option>
                                    <option value="disabled">Выключить</option>
                                  </select>
                                </label>
                              )}
                            </div>
                          </article>
                        );
                      })}
                      {filteredSourceLinks.length === 0 && (
                        <article className="source-row">
                          <div className="source-main">
                            <strong>Источники не найдены</strong>
                            <small>Измените фильтр или строку поиска.</small>
                          </div>
                        </article>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </section>
        )}

        {data && screen === 'settings' && (
          <section className="screen-panel department-screen">
            <div className="screen-brand">Костёр · D&amp;D 5e 2014</div>
            <button className="secondary-button back-button" onClick={() => setScreen('main-menu')} type="button">
              Назад
            </button>
            <p className="eyebrow">Параметры</p>
            <h2>Настройки</h2>
            <div className="settings-grid">
              <div>
                <span>Язык интерфейса</span>
                <strong>Русский</strong>
              </div>
              <div>
                <span>Режим данных</span>
                <strong>Сервер на ПК мастера</strong>
              </div>
              <div>
                <span>Графика</span>
                <strong>Практичный игровой интерфейс</strong>
              </div>
              <div>
                <span>Сеть</span>
                <strong>LAN сейчас, полноценный ПК-сервер позже</strong>
              </div>
              <div>
                <span>Адрес для второго устройства</span>
                <strong>{primaryLanUrl}</strong>
              </div>
              <div>
                <span>Backend API</span>
                <strong>{network?.lanBackendUrls[0] ?? network?.localBackendUrl ?? 'http://localhost:3000'}</strong>
              </div>
            </div>
            <div className="mini-list">
              {data.saveSnapshots.slice(0, 6).map((snapshot) => (
                <article className="mini-row" key={snapshot.id}>
                  <div>
                    <strong>{snapshot.summary}</strong>
                    <small>{snapshot.user?.displayName ?? 'Система'} · {formatDate(snapshot.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
