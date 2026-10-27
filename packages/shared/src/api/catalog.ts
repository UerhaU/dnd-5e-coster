import { z } from 'zod';
import { CLASS_IDS, idsOf, MAGIC_SCHOOLS } from '../catalog/codes.ts';
import {
  automationSchema,
  categorySchema,
  editionSchema,
  entityIdSchema,
  reviewStatusSchema,
} from '../catalog/entity.ts';
import { spellRulesSchema } from '../catalog/spell-rules.ts';
import { spellDataSchema } from '../catalog/spell.ts';

// Запросы и ответы API каталога (раздел 7, «Каталог»).
// Параметры строки запроса приходят строками, поэтому числа и флаги разбираются здесь.

export const CATALOG_PAGE_SIZE_MAX = 100;
export const CATALOG_PAGE_SIZE_DEFAULT = 25;
/** Длина поискового запроса: поле поиска не даёт ввести больше. */
export const CATALOG_QUERY_MAX = 200;

const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

/** `GET /api/catalog/spell?…` */
export const spellListQuerySchema = z.strictObject({
  /** Поиск по названию (русскому и английскому) и тексту, по началу слова. */
  q: z.string().trim().max(CATALOG_QUERY_MAX).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(CATALOG_PAGE_SIZE_MAX)
    .default(CATALOG_PAGE_SIZE_DEFAULT),
  level: z.coerce.number().int().min(0).max(9).optional(),
  school: z.enum(idsOf(MAGIC_SCHOOLS)).optional(),
  class: z.enum(CLASS_IDS).optional(),
  /** ID источника: `ph14`, `xge`, `al00-06`. */
  source: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  ritual: flag.optional(),
  concentration: flag.optional(),
  /** `relevance` — сначала совпадения в названии; без `q` равно `name`. */
  sort: z.enum(['relevance', 'name', 'level']).default('relevance'),
});

export type SpellListQuery = z.infer<typeof spellListQuerySchema>;
/** Что передаёт клиент: те же поля, все необязательные; флаги — `true`/`false`. */
export type SpellListParams = Partial<SpellListQuery>;

export const entitySourceSchema = z.object({
  id: z.string(),
  code: z.string(),
  nameRu: z.string().nullable(),
  nameEn: z.string(),
  /** Номер и адрес страницы на DnD.su. */
  dndsuId: z.number().int().nullable(),
  url: z.string().nullable(),
});

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
});

export const spellListResponseSchema = z.object({
  items: z.array(spellListItemSchema),
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

/** `GET /api/catalog/entity/:id` и `…/revisions/:rev` — карточка заклинания. */
export const spellEntityResponseSchema = z.object({
  id: entityIdSchema,
  category: z.literal('spell'),
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
  data: spellDataSchema,
  rules: spellRulesSchema.nullable(),
});

export const entityParamsSchema = z.strictObject({ id: entityIdSchema });
export const revisionParamsSchema = z.strictObject({
  id: entityIdSchema,
  rev: z.coerce.number().int().positive(),
});
export const categoryParamsSchema = z.strictObject({ category: z.string() });

export type SpellListItem = z.infer<typeof spellListItemSchema>;
export type SpellListResponse = z.infer<typeof spellListResponseSchema>;
export type SpellFacetsResponse = z.infer<typeof spellFacetsResponseSchema>;
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;
export type EntitySource = z.infer<typeof entitySourceSchema>;
export type SpellEntityResponse = z.infer<typeof spellEntityResponseSchema>;
