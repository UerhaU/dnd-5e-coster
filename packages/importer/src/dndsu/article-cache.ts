import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { PageList } from './spell-cache.ts';

// Кэш статей DnD.su «Инвентарь» (раздел 6, шаг fetch): обычное снаряжение лежит
// не на отдельных страницах, а таблицами в статьях.
//   index.json          какие статьи нужны и когда кэш проверен
//   pages/article-N.html статья с номером N на сайте

export const articleListSchema = z.strictObject({
  /** Дата, когда страницы кэша сверены с сайтом. */
  checkedOn: z.string(),
  pages: z
    .array(
      z.strictObject({
        /** Номер статьи: 147 в `/articles/inventory/147-armor-arms-equipment-tools/`. */
        id: z.number().int().positive(),
        url: z.url(),
      }),
    )
    .min(1),
});

export type ArticleList = z.infer<typeof articleListSchema>;

export interface ArticleCache extends PageList {
  folder: string;
  list: ArticleList;
  pagePath(id: number): string;
  /** HTML статьи или `null`, если её нет в кэше. */
  readPage(id: number): string | null;
}

export function openArticleCache(folder: string): ArticleCache {
  const list = articleListSchema.parse(
    JSON.parse(fs.readFileSync(path.join(folder, 'index.json'), 'utf8')),
  );
  const pagePath = (id: number) => path.join(folder, 'pages', `article-${id}.html`);
  return {
    folder,
    list,
    pagePath,
    listPages: () => list.pages.map((page) => ({ url: page.url, file: pagePath(page.id) })),
    readPage(id) {
      const file = pagePath(id);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    },
  };
}
