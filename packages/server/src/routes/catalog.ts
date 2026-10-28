import {
  itemFacets,
  listCategories,
  listItems,
  listRaces,
  listReference,
  referenceFacets,
  raceFacets,
  listSpells,
  searchCatalog,
  readEntity,
  spellFacets,
  type CatalogConnection,
} from '@koster/db';
import {
  catalogSearchQuerySchema,
  categoryParamsSchema,
  entityParamsSchema,
  entityResponseSchema,
  itemListQuerySchema,
  raceListQuerySchema,
  REFERENCE_LIST_CATEGORIES,
  referenceListQuerySchema,
  revisionParamsSchema,
  spellListQuerySchema,
  type CatalogSearchResponse,
  type CategoriesResponse,
  type EntityResponse,
  type ItemFacetsResponse,
  type ItemListResponse,
  type RaceFacetsResponse,
  type RaceListResponse,
  type ReferenceFacetsResponse,
  type ReferenceListCategory,
  type ReferenceListResponse,
  type SpellFacetsResponse,
  type SpellListResponse,
} from '@koster/shared';
import type { FastifyInstance } from 'fastify';
import { HttpError, parseOr400 } from '../errors';

// Маршруты каталога (раздел 7). Каталог открыт только для чтения (Р21).
// Категории со списком: заклинания, снаряжение, расы и справочные категории этапа 3
// (навыки, языки, состояния, предыстории, черты); остальные отвечают 404.

function requireCatalog(catalog: CatalogConnection | null): CatalogConnection {
  if (!catalog) {
    throw new HttpError(
      'catalog_unavailable',
      'Каталог не найден. Соберите его: npm run catalog:build',
    );
  }
  return catalog;
}

type ListCategory = 'spell' | 'item' | 'race' | ReferenceListCategory;

const LIST_CATEGORIES: readonly string[] = ['spell', 'item', 'race', ...REFERENCE_LIST_CATEGORIES];

/** Категория из адреса; неизвестная — 404. */
function listCategory(params: unknown): ListCategory {
  const { category } = parseOr400(categoryParamsSchema, params);
  if (!LIST_CATEGORIES.includes(category)) {
    throw new HttpError('not_found', `Нет категории «${category}»`);
  }
  return category as ListCategory;
}

function entityCard(catalog: CatalogConnection, id: string, revision?: number): EntityResponse {
  const record = readEntity(catalog, id, revision);
  if (!record) {
    throw new HttpError(
      'not_found',
      revision === undefined ? `Нет объекта ${id}` : `Нет ревизии ${revision} объекта ${id}`,
    );
  }
  // Проверка схемой своей категории: в окно не уходят данные, которых интерфейс не ждёт.
  return entityResponseSchema.parse(record);
}

export function registerCatalogRoutes(
  server: FastifyInstance,
  catalog: CatalogConnection | null,
): void {
  server.get('/api/catalog/categories', async (): Promise<CategoriesResponse> => {
    return listCategories(requireCatalog(catalog));
  });

  server.get('/api/catalog/entity/:id', async (request): Promise<EntityResponse> => {
    const { id } = parseOr400(entityParamsSchema, request.params);
    return entityCard(requireCatalog(catalog), id);
  });

  server.get('/api/catalog/entity/:id/revisions/:rev', async (request): Promise<EntityResponse> => {
    const { id, rev } = parseOr400(revisionParamsSchema, request.params);
    return entityCard(requireCatalog(catalog), id, rev);
  });

  // Поиск по всему каталогу (Р54). Постоянный адрес важнее `/:category`.
  server.get('/api/catalog/search', async (request): Promise<CatalogSearchResponse> => {
    const query = parseOr400(catalogSearchQuerySchema, request.query);
    return searchCatalog(requireCatalog(catalog), query);
  });

  server.get(
    '/api/catalog/:category/facets',
    async (
      request,
    ): Promise<
      SpellFacetsResponse | ItemFacetsResponse | RaceFacetsResponse | ReferenceFacetsResponse
    > => {
      const category = listCategory(request.params);
      const connection = requireCatalog(catalog);
      if (category === 'race') return raceFacets(connection);
      if (category === 'spell') return spellFacets(connection);
      if (category === 'item') return itemFacets(connection);
      return referenceFacets(connection, category);
    },
  );

  server.get(
    '/api/catalog/:category',
    async (
      request,
    ): Promise<SpellListResponse | ItemListResponse | RaceListResponse | ReferenceListResponse> => {
      const category = listCategory(request.params);
      if (category === 'race') {
        const query = parseOr400(raceListQuerySchema, request.query);
        return listRaces(requireCatalog(catalog), query);
      }
      if (category === 'spell') {
        const query = parseOr400(spellListQuerySchema, request.query);
        return listSpells(requireCatalog(catalog), query);
      }
      if (category === 'item') {
        const query = parseOr400(itemListQuerySchema, request.query);
        return listItems(requireCatalog(catalog), query);
      }
      const query = parseOr400(referenceListQuerySchema, request.query);
      return listReference(requireCatalog(catalog), category, query);
    },
  );
}
