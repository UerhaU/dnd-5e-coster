import path from 'node:path';
import { openArticleCache, type ArticleCache } from '../dndsu/article-cache.ts';

// Кэш страниц этапа 3 (раздел 6, шаг fetch): три папки формата кэша статей.
//   reference/   статьи «Использование характеристик» (навыки), «Языки», «Состояния»
//   backgrounds/ страницы предысторий (/backgrounds/N-…, /multiverse/backgrounds/N-…)
//   feats/       страницы черт (/feats/N-…)
//   classes/     страницы классов (/class/N-…): класс и все его подклассы на одной странице

export const CHARACTER_CACHE_PARTS = ['reference', 'backgrounds', 'feats', 'classes'] as const;

export type CharacterCachePart = (typeof CHARACTER_CACHE_PARTS)[number];

export type CharacterCache = Record<CharacterCachePart, ArticleCache>;

export function openCharacterCache(folder: string): CharacterCache {
  return {
    reference: openArticleCache(path.join(folder, 'reference')),
    backgrounds: openArticleCache(path.join(folder, 'backgrounds')),
    feats: openArticleCache(path.join(folder, 'feats')),
    classes: openArticleCache(path.join(folder, 'classes')),
  };
}
