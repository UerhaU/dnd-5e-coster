import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Кэш страниц заклинаний DnD.su на диске (раздел 6, шаг fetch).
// Устройство папки (как его оставила v0.1, storage/spell-fill/):
//   index.json        список заклинаний сайта: карточки и словари фильтров
//   pages/spell-N.html страница заклинания с номером N на сайте

const filterListSchema = z.array(
  z.object({
    title: z.string(),
    list: z.array(z.object({ title: z.string(), value: z.unknown() })),
  }),
);
const groupedFilterSchema = z.record(
  z.string(),
  z.object({
    title: z.string(),
    list: z.union([
      z.array(z.object({ title: z.string(), value: z.unknown() })),
      z.record(z.string(), z.object({ title: z.string(), value: z.unknown() })),
    ]),
  }),
);

export const spellCardSchema = z.object({
  siteId: z.number().int().positive(),
  url: z.url(),
  title: z.string(),
  title_en: z.string(),
  level: z.string(),
  filter_class: z.array(z.number()),
  filter_class_tce: z.array(z.number()),
  filter_archetype: z.array(z.number()),
  filter_source: z.array(z.number()),
  filter_concentration: z.array(z.string()),
  filter_ritual: z.array(z.string()),
  filter_damtype: z.array(z.number()),
});

export const spellListSchema = z.object({
  checkedOn: z.string(),
  edition: z.string(),
  cards: z.array(spellCardSchema),
  maps: z.object({
    class: filterListSchema,
    archetype: groupedFilterSchema,
    source: groupedFilterSchema,
    damtype: filterListSchema,
  }),
});

export type SpellCard = z.infer<typeof spellCardSchema>;
export type SpellList = z.infer<typeof spellListSchema>;

/** Пары «название — номер» из словаря фильтра DnD.su. */
export interface FilterEntry {
  title: string;
  value: number;
  /** Название группы: для подклассов — класс. */
  group: string;
}

export function flattenFilter(
  filter: z.infer<typeof filterListSchema> | z.infer<typeof groupedFilterSchema>,
): FilterEntry[] {
  const groups = Array.isArray(filter) ? filter : Object.values(filter);
  return groups.flatMap((group) =>
    Object.values(group.list).map((entry) => ({
      title: entry.title,
      value: Number(entry.value),
      group: group.title,
    })),
  );
}

/** Кэш страниц DnD.su: какие страницы должны лежать на диске и где. */
export interface PageList {
  listPages(): { url: string; file: string }[];
}

export interface SpellCache extends PageList {
  folder: string;
  list: SpellList;
  pagePath(siteId: number): string;
  /** HTML страницы или `null`, если её нет в кэше. */
  readPage(siteId: number): string | null;
}

export function openSpellCache(folder: string): SpellCache {
  const listFile = path.join(folder, 'index.json');
  const list = spellListSchema.parse(JSON.parse(fs.readFileSync(listFile, 'utf8')));
  const pagePath = (siteId: number) => path.join(folder, 'pages', `spell-${siteId}.html`);

  return {
    folder,
    list,
    pagePath,
    listPages: () => list.cards.map((card) => ({ url: card.url, file: pagePath(card.siteId) })),
    readPage(siteId) {
      const file = pagePath(siteId);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    },
  };
}
