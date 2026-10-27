// npm run catalog:fetch — докачать в кэш страницы, которых в нём нет.
// Список страниц берётся из index.json кэша; уже скачанные страницы не трогаются.
//
//   npm run catalog:fetch                    заклинания (storage/spell-fill)
//   npm run catalog:fetch -- --items         статьи со снаряжением (storage/dndsu-articles)
//   npm run catalog:fetch -- --races         страницы рас (storage/dndsu-races)
//   npm run catalog:fetch -- --cache <папка>

import path from 'node:path';
import { parseArgs } from 'node:util';
import { fetchMissingPages } from '../dndsu/fetch-missing.ts';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { openSpellCache } from '../dndsu/spell-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';

const { values } = parseArgs({
  options: {
    cache: { type: 'string' },
    items: { type: 'boolean', default: false },
    races: { type: 'boolean', default: false },
  },
});
// Страницы рас — тот же формат кэша, что у статей: index.json и pages/article-N.html.
const cache = values.items
  ? openArticleCache(path.resolve(values.cache ?? DEFAULT_PATHS.itemCache))
  : values.races
    ? openArticleCache(path.resolve(values.cache ?? DEFAULT_PATHS.raceCache))
    : openSpellCache(path.resolve(values.cache ?? DEFAULT_PATHS.spellCache));

const result = await fetchMissingPages(cache, { log: (message) => console.log(message) });
console.log(
  `Нет в кэше: ${result.missing}; скачано: ${result.fetched}; не удалось: ${result.failed.length}`,
);
if (result.failed.length > 0) {
  process.exitCode = 1;
}
