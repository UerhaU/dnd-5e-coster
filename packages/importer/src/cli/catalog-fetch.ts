// npm run catalog:fetch — докачать в кэш страницы заклинаний, которых в нём нет.
// Список заклинаний берётся из index.json кэша; уже скачанные страницы не трогаются.
//
//   npm run catalog:fetch
//   npm run catalog:fetch -- --cache <папка>

import path from 'node:path';
import { parseArgs } from 'node:util';
import { fetchMissingPages } from '../dndsu/fetch-missing.ts';
import { openSpellCache } from '../dndsu/spell-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';

const { values } = parseArgs({ options: { cache: { type: 'string' } } });
const cache = openSpellCache(path.resolve(values.cache ?? DEFAULT_PATHS.spellCache));

const result = await fetchMissingPages(cache, { log: (message) => console.log(message) });
console.log(
  `Нет в кэше: ${result.missing}; скачано: ${result.fetched}; не удалось: ${result.failed.length}`,
);
if (result.failed.length > 0) {
  process.exitCode = 1;
}
