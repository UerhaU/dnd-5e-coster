import { z } from 'zod';
import { CLASS_IDS, DAMAGE_TYPES, idsOf, MAGIC_SCHOOLS } from '../catalog/codes.ts';
import {
  automationSchema,
  categorySchema,
  editionSchema,
  entityIdSchema,
  reviewStatusSchema,
} from '../catalog/entity.ts';
import { ITEM_CATEGORIES, ITEM_KINDS, WEAPON_PROPERTIES } from '../catalog/item-codes.ts';
import { armorRulesSchema, itemRulesSchema, weaponRulesSchema } from '../catalog/item-rules.ts';
import { itemDataSchema } from '../catalog/item.ts';
import { SIZES } from '../catalog/race-codes.ts';
import { raceRulesSchema } from '../catalog/race-rules.ts';
import { raceDataSchema } from '../catalog/race.ts';
import { spellRulesSchema } from '../catalog/spell-rules.ts';
import { spellDataSchema } from '../catalog/spell.ts';

// Запросы и ответы API каталога (раздел 7, «Каталог»).
// Параметры строки запроса приходят строками, поэтому числа и флаги разбираются здесь.

export const CATALOG_PAGE_SIZE_MAX = 100;
export const CATALOG_PAGE_SIZE_DEFAULT = 25;
/** Длина поискового запроса: поле поиска не даёт ввести больше. */
export const CATALOG_QUERY_MAX = 200;

const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Поиск, страницы и источник: общие для списков всех категорий. */
const listPaging = {
  /** Поиск по названию (русскому и английскому) и тексту, по началу слова. */
  q: z.string().trim().max(CATALOG_QUERY_MAX).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(CATALOG_PAGE_SIZE_MAX)
    .default(CATALOG_PAGE_SIZE_DEFAULT),
  /** ID источника: `ph14`, `xge`, `al00-06`. */
  source: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
};

/** `GET /api/catalog/spell?…` */
export const spellListQuerySchema = z.strictObject({
  ...listPaging,
  level: z.coerce.number().int().min(0).max(9).optional(),
  school: z.enum(idsOf(MAGIC_SCHOOLS)).optional(),
  class: z.enum(CLASS_IDS).optional(),
  ritual: flag.optional(),
  concentration: flag.optional(),
  /** `relevance` — сначала совпадения в названии; без `q` равно `name`. */
  sort: z.enum(['relevance', 'name', 'level']).default('relevance'),
});

export type SpellListQuery = z.infer<typeof spellListQuerySchema>;
/** Что передаёт клиент: те же поля, все необязательные; флаги — `true`/`false`. */
export type SpellListParams = Partial<SpellListQuery>;

/** `GET /api/catalog/item?…` */
export const itemListQuerySchema = z.strictObject({
  ...listPaging,
  kind: z.enum(idsOf(ITEM_KINDS)).optional(),
  category: z.enum(idsOf(ITEM_CATEGORIES)).optional(),
  property: z.enum(idsOf(WEAPON_PROPERTIES)).optional(),
  damageType: z.enum(idsOf(DAMAGE_TYPES)).optional(),
  /** Вариант правил (нужно разрешение мастера): `false` — только обычные правила. */
  optionalRule: flag.optional(),
  /** `relevance` — сначала совпадения в названии; без `q` равно `name`. */
  sort: z.enum(['relevance', 'name', 'cost', 'weight']).default('relevance'),
});

export type ItemListQuery = z.infer<typeof itemListQuerySchema>;
export type ItemListParams = Partial<ItemListQuery>;

/** `GET /api/catalog/race?…` */
export const raceListQuerySchema = z.strictObject({
  ...listPaging,
  /** `race` — только расы, `variant` — только разновидности. */
  kind: z.enum(['race', 'variant']).optional(),
  /** Разновидности этой расы. */
  variantOf: entityIdSchema.optional(),
  size: z.enum(idsOf(SIZES)).optional(),
  /** Есть скорость полёта. */
  flying: flag.optional(),
  /** Есть тёмное зрение. */
  darkvision: flag.optional(),
  sort: z.enum(['relevance', 'name']).default('relevance'),
});

export type RaceListQuery = z.infer<typeof raceListQuerySchema>;
export type RaceListParams = Partial<RaceListQuery>;

export const entitySourceSchema = z.object({
  id: z.string(),
  code: z.string(),
  nameRu: z.string().nullable(),
  nameEn: z.string(),
  /** Номер и адрес страницы на DnD.su. */
  dndsuId: z.number().int().nullable(),
  url: z.string().nullable(),
});

/** Как заклинание доступно классу: списком класса, по TCE или через подкласс (Р53). */
export const classAccessSchema = z.enum(['standard', 'optional', 'subclass']);

export const spellListItemSchema = z.object({
  id: entityIdSchema,
  nameRu: z.string(),
  nameEn: z.string(),
  level: z.number().int().min(0).max(9),
  school: z.enum(idsOf(MAGIC_SCHOOLS)),
  ritual: z.boolean(),
  concentration: z.boolean(),
  /** Коды источников, как на DnD.su: `PH14`, `XGE`. */
  sources: z.array(z.string()),
  reviewStatus: reviewStatusSchema,
  /** Доступ к классу из фильтра `class`; без фильтра по классу — `null`. */
  classAccess: classAccessSchema.nullable(),
});

export const spellListResponseSchema = z.object({
  items: z.array(spellListItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const itemListItemSchema = z.object({
  id: entityIdSchema,
  nameRu: z.string(),
  nameEn: z.string(),
  kind: z.enum(idsOf(ITEM_KINDS)),
  category: z.enum(idsOf(ITEM_CATEGORIES)).nullable(),
  /** Как на сайте: «1 500 зм»; `null` — ячейки нет. */
  costText: z.string().nullable(),
  costCp: z.number().int().nullable(),
  weightText: z.string().nullable(),
  weightLb: z.number().nullable(),
  quantity: z.number().int().positive(),
  optionalRule: z.boolean(),
  /** Урон оружия; `null` — не оружие или без урона. */
  damage: weaponRulesSchema.shape.damage,
  armorClass: armorRulesSchema.shape.armorClass.nullable(),
  /** Прибавка щита к КД. */
  armorClassBonus: z.number().int().nullable(),
  sources: z.array(z.string()),
  reviewStatus: reviewStatusSchema,
});

export const itemListResponseSchema = z.object({
  items: z.array(itemListItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const raceListItemSchema = z.object({
  id: entityIdSchema,
  nameRu: z.string(),
  nameEn: z.string(),
  kind: z.enum(['race', 'variant']),
  variantOf: entityIdSchema.nullable(),
  /** Название расы разновидности. */
  variantOfName: z.string().nullable(),
  size: z.enum(idsOf(SIZES)).nullable(),
  speedWalkFt: z.number().int().nullable(),
  flying: z.boolean(),
  darkvisionFt: z.number().int().nullable(),
  sources: z.array(z.string()),
  reviewStatus: reviewStatusSchema,
});

export const raceListResponseSchema = z.object({
  items: z.array(raceListItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

const facetValue = <T extends z.ZodType>(value: T) =>
  z.object({ value, label: z.string(), count: z.number().int().min(0) });

/** `GET /api/catalog/spell/facets` — возможные значения фильтров и сколько объектов у каждого. */
export const spellFacetsResponseSchema = z.object({
  level: z.array(facetValue(z.number().int())),
  school: z.array(facetValue(z.string())),
  class: z.array(facetValue(z.string())),
  source: z.array(facetValue(z.string())),
  ritual: z.number().int().min(0),
  concentration: z.number().int().min(0),
});

/** `GET /api/catalog/item/facets` */
export const itemFacetsResponseSchema = z.object({
  kind: z.array(facetValue(z.string())),
  category: z.array(facetValue(z.string())),
  property: z.array(facetValue(z.string())),
  damageType: z.array(facetValue(z.string())),
  source: z.array(facetValue(z.string())),
  optionalRule: z.number().int().min(0),
});

/** `GET /api/catalog/race/facets` */
export const raceFacetsResponseSchema = z.object({
  kind: z.array(facetValue(z.string())),
  size: z.array(facetValue(z.string())),
  source: z.array(facetValue(z.string())),
  flying: z.number().int().min(0),
  darkvision: z.number().int().min(0),
});

/** `GET /api/catalog/categories` */
export const categoriesResponseSchema = z.object({
  categories: z.array(
    z.object({ id: categorySchema, nameRu: z.string(), count: z.number().int().min(0) }),
  ),
});

export const revisionInfoSchema = z.object({
  /** `content_revisions.id`: на него будут ссылаться персонажи (Р21). */
  id: z.number().int().positive(),
  revision: z.number().int().positive(),
  schemaVersion: z.string(),
  createdAt: z.string(),
  /** Это текущая ревизия объекта. */
  current: z.boolean(),
});

/** Связь с другим объектом каталога: состав набора, боеприпас, материальный компонент. */
export const entityLinkSchema = z.object({
  kind: z.string(),
  /** `to` — этот объект ссылается на другой; `from` — другой ссылается на этот. */
  direction: z.enum(['to', 'from']),
  id: entityIdSchema,
  category: categorySchema,
  nameRu: z.string(),
});

/** Поля карточки, общие для всех категорий. */
const entityCardBase = {
  id: entityIdSchema,
  nameRu: z.string(),
  nameEn: z.string(),
  aliases: z.array(z.string()),
  edition: editionSchema,
  reviewStatus: reviewStatusSchema,
  automation: automationSchema,
  /** Объект пропал из источника; ревизии сохранены. */
  withdrawn: z.boolean(),
  revision: revisionInfoSchema,
  /** Все ревизии объекта, по возрастанию. */
  revisions: z.array(z.number().int().positive()),
  sources: z.array(entitySourceSchema),
  links: z.array(entityLinkSchema),
};

/** Карточка заклинания. */
export const spellEntityResponseSchema = z.object({
  ...entityCardBase,
  category: z.literal('spell'),
  data: spellDataSchema,
  rules: spellRulesSchema.nullable(),
});

/** Карточка предмета снаряжения. */
export const itemEntityResponseSchema = z.object({
  ...entityCardBase,
  category: z.literal('item'),
  data: itemDataSchema,
  rules: itemRulesSchema.nullable(),
});

/** Карточка расы или разновидности. */
export const raceEntityResponseSchema = z.object({
  ...entityCardBase,
  category: z.literal('race'),
  data: raceDataSchema,
  rules: raceRulesSchema,
});

/** `GET /api/catalog/entity/:id` и `…/revisions/:rev` — карточка объекта любой категории. */
export const entityResponseSchema = z.discriminatedUnion('category', [
  spellEntityResponseSchema,
  itemEntityResponseSchema,
  raceEntityResponseSchema,
]);

export const entityParamsSchema = z.strictObject({ id: entityIdSchema });
export const revisionParamsSchema = z.strictObject({
  id: entityIdSchema,
  rev: z.coerce.number().int().positive(),
});
export const categoryParamsSchema = z.strictObject({ category: z.string() });

export type SpellListItem = z.infer<typeof spellListItemSchema>;
export type ClassAccess = z.infer<typeof classAccessSchema>;
export type SpellListResponse = z.infer<typeof spellListResponseSchema>;
export type SpellFacetsResponse = z.infer<typeof spellFacetsResponseSchema>;
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;
export type EntitySource = z.infer<typeof entitySourceSchema>;
export type SpellEntityResponse = z.infer<typeof spellEntityResponseSchema>;
export type ItemEntityResponse = z.infer<typeof itemEntityResponseSchema>;
export type EntityResponse = z.infer<typeof entityResponseSchema>;
export type EntityLink = z.infer<typeof entityLinkSchema>;
export type ItemListItem = z.infer<typeof itemListItemSchema>;
export type ItemListResponse = z.infer<typeof itemListResponseSchema>;
export type ItemFacetsResponse = z.infer<typeof itemFacetsResponseSchema>;
export type RaceEntityResponse = z.infer<typeof raceEntityResponseSchema>;
export type RaceListItem = z.infer<typeof raceListItemSchema>;
export type RaceListResponse = z.infer<typeof raceListResponseSchema>;
export type RaceFacetsResponse = z.infer<typeof raceFacetsResponseSchema>;
