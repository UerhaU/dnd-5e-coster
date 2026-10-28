import { openArticleCache } from '../dndsu/article-cache.ts';
import { openSpellCache } from '../dndsu/spell-cache.ts';
import type { ImportIssue } from '../report/issues.ts';
import { loadReviewedItems } from '../reviewed/reviewed-items.ts';
import { loadReviewedRaces } from '../reviewed/reviewed-races.ts';
import { loadReviewedSpells } from '../reviewed/reviewed-spells.ts';
import { collectItems, type ItemCollectStats } from './collect-items.ts';
import { collectRaces, type RaceCollectStats } from './collect-races.ts';
import { collectSpells, type CollectStats } from './collect-spells.ts';
import { linkSpellMaterials, type MaterialLinkStats } from './link-spell-materials.ts';
import { readLedger, writeLedger } from './ledger.ts';
import { writeCatalog, type WriteStats } from './write-catalog.ts';

/** Версия импортёра: пишется в каждую новую ревизию. На ревизии не влияет. */
export const IMPORTER_VERSION = 'catalog-importer/2';

export interface BuildOptions {
  /** Кэш заклинаний DnD.su: index.json и pages/. */
  cacheDir: string;
  reviewedDir: string;
  /** Кэш статей «Инвентарь» (снаряжение); `null` — каталог без снаряжения. */
  itemCacheDir: string | null;
  reviewedItemsDir: string;
  /** Кэш страниц рас; `null` — каталог без рас. */
  raceCacheDir: string | null;
  reviewedRacesDir: string;
  outFile: string;
  /** Прошлая сборка; `null` — с нуля, без переноса ревизий. */
  previousFile: string | null;
  /**
   * Папка журнала ревизий в git (Р51): читается перед сборкой и перезаписывается
   * после. `null` — журнал не трогать (тестовый каталог).
   */
  ledgerDir: string | null;
  /** `full` — кэш сайта; `fixtures` — тестовые страницы. Пишется в catalog_info. */
  sourceKind: 'full' | 'fixtures';
  now: Date;
}

export interface BuildResult {
  collect: CollectStats;
  items: ItemCollectStats | null;
  races: RaceCollectStats | null;
  /** Связи материальных компонентов (без снаряжения в сборке — `null`). */
  materials: MaterialLinkStats | null;
  write: WriteStats;
  issues: ImportIssue[];
}

/** Полная цепочка раздела 6: кэш → … → catalog.db. Заклинания, снаряжение, расы. */
export function buildCatalog(options: BuildOptions): BuildResult {
  const issues: ImportIssue[] = [];
  const cache = openSpellCache(options.cacheDir);
  const reviewed = loadReviewedSpells(options.reviewedDir);
  const spells = collectSpells(cache, reviewed, issues);
  const reviewedItems = loadReviewedItems(options.reviewedItemsDir);
  const items = options.itemCacheDir
    ? collectItems(openArticleCache(options.itemCacheDir), reviewedItems, issues, {
        knownSources: spells.entities.flatMap((entity) =>
          entity.sources.map(({ source }) => source),
        ),
        reportUnusedReviewed: options.sourceKind === 'full',
      })
    : null;
  const materials = items
    ? linkSpellMaterials(
        spells.entities.filter(
          (entity): entity is Extract<typeof entity, { category: 'spell' }> =>
            entity.category === 'spell',
        ),
        items.entities.filter(
          (entity): entity is Extract<typeof entity, { category: 'item' }> =>
            entity.category === 'item',
        ),
        reviewedItems,
        issues,
        { full: options.sourceKind === 'full' },
      )
    : null;
  const knownSources = [...spells.entities, ...(items?.entities ?? [])].flatMap((entity) =>
    entity.sources.map(({ source }) => source),
  );
  const races = options.raceCacheDir
    ? collectRaces(
        openArticleCache(options.raceCacheDir),
        loadReviewedRaces(options.reviewedRacesDir),
        issues,
        {
          knownSources,
          reportUnusedReviewed: options.sourceKind === 'full',
        },
      )
    : null;
  const entities = [
    ...spells.entities,
    ...(items?.entities ?? []),
    ...(materials?.components ?? []),
    ...(races?.entities ?? []),
  ];
  const ledger = options.ledgerDir ? readLedger(options.ledgerDir) : null;

  const written = writeCatalog(
    {
      entities,
      outFile: options.outFile,
      previousFile: options.previousFile,
      ledger,
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
  if (options.ledgerDir) {
    writeLedger(options.ledgerDir, written.ledger);
  }
  return {
    collect: spells.stats,
    items: items?.stats ?? null,
    races: races?.stats ?? null,
    materials: materials?.stats ?? null,
    write: written.stats,
    issues,
  };
}
