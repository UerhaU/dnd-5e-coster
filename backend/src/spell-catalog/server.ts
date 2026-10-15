import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSpellCatalogServer } from './app.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const databasePath = process.env.SPELL_CATALOG_DATABASE ?? resolve(root, 'storage/spell-catalog.sqlite');
const server = buildSpellCatalogServer(databasePath);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void server.close().then(() => process.exit(0)); });
}
await server.listen({ host: '127.0.0.1', port: Number(process.env.SPELL_CATALOG_PORT ?? 3011) });
