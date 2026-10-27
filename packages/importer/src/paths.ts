import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень репозитория: packages/importer/src → ../../.. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));

export const DEFAULT_PATHS = {
  /** Кэш v0.1 с 524 страницами 5e14.dnd.su от 2026-10-16 (выбран на этапе 1). */
  spellCache: path.join(REPO_ROOT, 'storage', 'spell-fill'),
  /** Тестовый кэш в git: несколько страниц для тестов и для CI (Р47). */
  spellFixtures: path.join(REPO_ROOT, 'data', 'fixtures', 'dndsu', 'spells'),
  reviewedSpells: path.join(REPO_ROOT, 'data', 'reviewed', 'spells'),
  /** Статьи DnD.su «Инвентарь» с таблицами снаряжения (выбран на этапе 2). */
  itemCache: path.join(REPO_ROOT, 'storage', 'dndsu-articles'),
  /** Тестовые статьи в git: таблицы урезаны до нескольких строк (Р47). */
  itemFixtures: path.join(REPO_ROOT, 'data', 'fixtures', 'dndsu', 'articles'),
  reviewedItems: path.join(REPO_ROOT, 'data', 'reviewed', 'items'),
  /** Страницы рас 5e14.dnd.su (/race/ и /multiverse/race/), этап 2, часть Б. */
  raceCache: path.join(REPO_ROOT, 'storage', 'dndsu-races'),
  /** Журнал ревизий без текстов (Р51): в git, пишется сборкой полного каталога. */
  catalogLedger: path.join(REPO_ROOT, 'data', 'catalog-ledger'),
  /** Каталог, который попадает в собранную программу (resources/). */
  catalog: path.join(REPO_ROOT, 'apps', 'desktop', 'resources', 'catalog.db'),
  reports: path.join(REPO_ROOT, 'storage', 'imports', 'reports'),
} as const;
