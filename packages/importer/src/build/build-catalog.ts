import { openSpellCache } from '../dndsu/spell-cache.ts';
import type { ImportIssue } from '../report/issues.ts';
import { loadReviewedSpells } from '../reviewed/reviewed-spells.ts';
import { collectSpells, type CollectStats } from './collect-spells.ts';
import { writeCatalog, type WriteStats } from './write-catalog.ts';

/** Версия импортёра: пишется в каждую новую ревизию. На ревизии не влияет. */
export const IMPORTER_VERSION = 'spell-importer/1';

export interface BuildOptions {
  /** Кэш заклинаний DnD.su: index.json и pages/. */
  cacheDir: string;
  reviewedDir: string;
  outFile: string;
  /** Прошлая сборка; `null` — с нуля, без переноса ревизий. */
  previousFile: string | null;
  /** `full` — кэш сайта; `fixtures` — тестовые страницы. Пишется в catalog_info. */
  sourceKind: 'full' | 'fixtures';
  now: Date;
}

export interface BuildResult {
  collect: CollectStats;
  write: WriteStats;
  issues: ImportIssue[];
}

/** Полная цепочка раздела 6 для заклинаний: кэш → … → catalog.db. */
export function buildCatalog(options: BuildOptions): BuildResult {
  const issues: ImportIssue[] = [];
  const cache = openSpellCache(options.cacheDir);
  const reviewed = loadReviewedSpells(options.reviewedDir);
  const { entities, stats } = collectSpells(cache, reviewed, issues);

  const write = writeCatalog(
    {
      entities,
      outFile: options.outFile,
      previousFile: options.previousFile,
      importerVersion: IMPORTER_VERSION,
      builtAt: options.now.toISOString(),
      sourceInfo: {
        source_site: new URL(cache.list.cards[0]?.url ?? 'https://5e14.dnd.su').origin,
        source_checked_on: cache.list.checkedOn,
        source_kind: options.sourceKind,
      },
    },
    issues,
  );
  return { collect: stats, write, issues };
}
