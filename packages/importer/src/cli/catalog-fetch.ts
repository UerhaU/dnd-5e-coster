// npm run catalog:fetch — докачать в кэш страницы, которых в нём нет.
// Список страниц берётся из index.json кэша; уже скачанные страницы не трогаются.
//
//   npm run catalog:fetch                    заклинания (storage/spell-fill)
//   npm run catalog:fetch -- --items         статьи со снаряжением (storage/dndsu-articles)
//   npm run catalog:fetch -- --races         страницы рас (storage/dndsu-races)
//   npm run catalog:fetch -- --character     статьи-справочники, предыстории и черты
//                                            (storage/dndsu-character/{reference,backgrounds,feats})
//   npm run catalog:fetch -- --cache <папка>

import path from 'node:path';
import { parseArgs } from 'node:util';
import { fetchMissingPages } from '../dndsu/fetch-missing.ts';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { openSpellCache, type PageList } from '../dndsu/spell-cache.ts';
import { CHARACTER_CACHE_PARTS } from '../character/character-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';

const { values } = parseArgs({
  options: {
    cache: { type: 'string' },
    items: { type: 'boolean', default: false },
    races: { type: 'boolean', default: false },
    character: { type: 'boolean', default: false },
  },
});
// Страницы рас и персонажа — тот же формат кэша, что у статей: index.json и pages/article-N.html.
const caches: PageList[] = values.character
  ? CHARACTER_CACHE_PARTS.map((part) =>
      openArticleCache(path.join(path.resolve(values.cache ?? DEFAULT_PATHS.characterCache), part)),
    )
  : values.items
    ? [openArticleCache(path.resolve(values.cache ?? DEFAULT_PATHS.itemCache))]
    : values.races
      ? [openArticleCache(path.resolve(values.cache ?? DEFAULT_PATHS.raceCache))]
      : [openSpellCache(path.resolve(values.cache ?? DEFAULT_PATHS.spellCache))];

let failed = 0;
for (const cache of caches) {
  const result = await fetchMissingPages(cache, { log: (message) => console.log(message) });
  failed += result.failed.length;
  console.log(
    `Нет в кэше: ${result.missing}; скачано: ${result.fetched}; не удалось: ${result.failed.length}`,
  );
}
if (failed > 0) {
  process.exitCode = 1;
}
