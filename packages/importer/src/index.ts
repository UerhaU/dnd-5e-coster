// Импорт DnD.su и сборка catalog.db (раздел 6). Только для разработки:
// пакет не входит в собранную программу. Команды — в src/cli/.

export {
  buildCatalog,
  IMPORTER_VERSION,
  type BuildOptions,
  type BuildResult,
} from './build/build-catalog.ts';
export { parseSpellPage, type RawSpellPage } from './spells/parse-page.ts';
