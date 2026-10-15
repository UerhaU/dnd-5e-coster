import Fastify from 'fastify';
import { SpellCatalog } from './repository.js';
import type { SpellFilters } from './types.js';

export function buildSpellCatalogServer(databasePath: string, logger = true) {
  const app = Fastify({ logger });
  const catalog = new SpellCatalog(databasePath);
  app.addHook('onClose', async () => catalog.close());
  app.get('/api/spellbook/health', async () => ({ status: 'ok', catalog: 'isolated', schemaVersion: '1.2' }));
  app.get('/api/spellbook/lookups', async () => catalog.lookups());
  app.get<{ Querystring: SpellFilters }>('/api/spellbook/spells', {
    schema: { querystring: { type: 'object', additionalProperties: false, properties: {
      q: { type: 'string', maxLength: 200 }, level: { type: 'integer', minimum: 0, maximum: 9 },
      school: { type: 'integer', minimum: 1 }, class: { type: 'integer', minimum: 1 },
      ritual: { type: 'boolean' }, concentration: { type: 'boolean' },
    } } },
  }, async (request) => catalog.list(request.query));
  app.get<{ Params: { id: number } }>('/api/spellbook/spells/:id', {
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } } },
  }, async (request, reply) => {
    const spell = catalog.detail(request.params.id);
    return spell ?? reply.code(404).send({ message: 'Заклинание не найдено.' });
  });
  return app;
}
