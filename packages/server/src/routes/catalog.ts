import {
  listCategories,
  listSpells,
  readEntity,
  spellFacets,
  type CatalogConnection,
} from '@koster/db';
import {
  categoryParamsSchema,
  entityParamsSchema,
  revisionParamsSchema,
  spellEntityResponseSchema,
  spellListQuerySchema,
  type CategoriesResponse,
  type SpellEntityResponse,
  type SpellFacetsResponse,
  type SpellListResponse,
} from '@koster/shared';
import type { FastifyInstance } from 'fastify';
import { HttpError, parseOr400 } from '../errors';

// Маршруты каталога (раздел 7). Каталог открыт только для чтения (Р21).
// Пока в каталоге одна категория — заклинания; остальные отвечают 404.

function requireCatalog(catalog: CatalogConnection | null): CatalogConnection {
  if (!catalog) {
    throw new HttpError(
      'catalog_unavailable',
      'Каталог не найден. Соберите его: npm run catalog:build',
    );
  }
  return catalog;
}

function requireSpellCategory(params: unknown): void {
  const { category } = parseOr400(categoryParamsSchema, params);
  if (category !== 'spell') {
    throw new HttpError('not_found', `Нет категории «${category}»`);
  }
}

function entityCard(
  catalog: CatalogConnection,
  id: string,
  revision?: number,
): SpellEntityResponse {
  const record = readEntity(catalog, id, revision);
  if (!record) {
    throw new HttpError(
      'not_found',
      revision === undefined ? `Нет объекта ${id}` : `Нет ревизии ${revision} объекта ${id}`,
    );
  }
  // Проверка схемой: в окно не уходят данные, которых интерфейс не ждёт.
  return spellEntityResponseSchema.parse(record);
}

export function registerCatalogRoutes(
  server: FastifyInstance,
  catalog: CatalogConnection | null,
): void {
  server.get('/api/catalog/categories', async (): Promise<CategoriesResponse> => {
    return listCategories(requireCatalog(catalog));
  });

  server.get('/api/catalog/entity/:id', async (request): Promise<SpellEntityResponse> => {
    const { id } = parseOr400(entityParamsSchema, request.params);
    return entityCard(requireCatalog(catalog), id);
  });

  server.get(
    '/api/catalog/entity/:id/revisions/:rev',
    async (request): Promise<SpellEntityResponse> => {
      const { id, rev } = parseOr400(revisionParamsSchema, request.params);
      return entityCard(requireCatalog(catalog), id, rev);
    },
  );

  server.get('/api/catalog/:category/facets', async (request): Promise<SpellFacetsResponse> => {
    requireSpellCategory(request.params);
    return spellFacets(requireCatalog(catalog));
  });

  server.get('/api/catalog/:category', async (request): Promise<SpellListResponse> => {
    requireSpellCategory(request.params);
    const query = parseOr400(spellListQuerySchema, request.query);
    return listSpells(requireCatalog(catalog), query);
  });
}
