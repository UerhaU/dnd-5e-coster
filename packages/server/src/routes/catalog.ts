import {
  itemFacets,
  listCategories,
  listItems,
  listRaces,
  raceFacets,
  listSpells,
  readEntity,
  spellFacets,
  type CatalogConnection,
} from '@koster/db';
import {
  categoryParamsSchema,
  entityParamsSchema,
  entityResponseSchema,
  itemListQuerySchema,
  raceListQuerySchema,
  revisionParamsSchema,
  spellListQuerySchema,
  type CategoriesResponse,
  type EntityResponse,
  type ItemFacetsResponse,
  type ItemListResponse,
  type RaceFacetsResponse,
  type RaceListResponse,
  type SpellFacetsResponse,
  type SpellListResponse,
} from '@koster/shared';
import type { FastifyInstance } from 'fastify';
import { HttpError, parseOr400 } from '../errors';

// Маршруты каталога (раздел 7). Каталог открыт только для чтения (Р21).
// Категории со списком: заклинания, снаряжение и расы; остальные отвечают 404.

function requireCatalog(catalog: CatalogConnection | null): CatalogConnection {
  if (!catalog) {
    throw new HttpError(
      'catalog_unavailable',
      'Каталог не найден. Соберите его: npm run catalog:build',
    );
  }
  return catalog;
}

/** Категория из адреса; неизвестная — 404. */
function listCategory(params: unknown): 'spell' | 'item' | 'race' {
  const { category } = parseOr400(categoryParamsSchema, params);
  if (category !== 'spell' && category !== 'item' && category !== 'race') {
    throw new HttpError('not_found', `Нет категории «${category}»`);
  }
  return category;
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

  server.get(
    '/api/catalog/:category/facets',
    async (request): Promise<SpellFacetsResponse | ItemFacetsResponse | RaceFacetsResponse> => {
      const category = listCategory(request.params);
      const connection = requireCatalog(catalog);
      if (category === 'race') return raceFacets(connection);
      return category === 'spell' ? spellFacets(connection) : itemFacets(connection);
    },
  );

  server.get(
    '/api/catalog/:category',
    async (request): Promise<SpellListResponse | ItemListResponse | RaceListResponse> => {
      const category = listCategory(request.params);
      if (category === 'race') {
        const query = parseOr400(raceListQuerySchema, request.query);
        return listRaces(requireCatalog(catalog), query);
      }
      if (category === 'spell') {
        const query = parseOr400(spellListQuerySchema, request.query);
        return listSpells(requireCatalog(catalog), query);
      }
      const query = parseOr400(itemListQuerySchema, request.query);
      return listItems(requireCatalog(catalog), query);
    },
  );
}
