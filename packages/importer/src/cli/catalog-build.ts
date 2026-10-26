// npm run catalog:build — собрать catalog.db (раздел 6, раздел 10).
//
//   npm run catalog:build                       полный каталог из storage/spell-fill
//   npm run catalog:build -- --fixtures         тестовый каталог из data/fixtures (CI, Р47)
//   npm run catalog:build -- --cache <папка> --out <файл>
//   --fresh    не переносить ревизии прошлой сборки
//   --strict   выйти с кодом 1, если есть ошибки (для CI)
//   --force    разрешить тестовому каталогу заменить полный
//
// История ревизий есть только в самом catalog.db (Р21, Р47), поэтому перед заменой
// прошлая сборка копируется в storage/backups/catalog/.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openCatalogReadOnly, readCatalogInfo } from '@koster/db';
import { buildCatalog } from '../build/build-catalog.ts';
import { DEFAULT_PATHS, REPO_ROOT } from '../paths.ts';
import { summaryLines, writeBuildReport } from '../report/write-report.ts';

const { values } = parseArgs({
  options: {
    cache: { type: 'string' },
    out: { type: 'string' },
    fixtures: { type: 'boolean', default: false },
    fresh: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

const cacheDir = path.resolve(
  values.cache ?? (values.fixtures ? DEFAULT_PATHS.spellFixtures : DEFAULT_PATHS.spellCache),
);
const outFile = path.resolve(values.out ?? DEFAULT_PATHS.catalog);
// Тестовый каталог всегда собирается с нуля: его ревизии не должны смешиваться с полным.
const fresh = values.fresh || values.fixtures;
const sourceKind = values.fixtures ? 'fixtures' : 'full';

function readInfo(file: string): Record<string, string> | null {
  if (!fs.existsSync(file)) {
    return null;
  }
  const catalog = openCatalogReadOnly(file);
  try {
    return readCatalogInfo(catalog);
  } finally {
    catalog.close();
  }
}

const previousInfo = readInfo(outFile);
if (
  previousInfo?.['source_kind'] !== 'fixtures' &&
  previousInfo &&
  values.fixtures &&
  !values.force
) {
  console.error(
    `Тестовый каталог заменил бы полный (${outFile}).\n` +
      'Укажите другой файл (--out <файл>) или добавьте --force.',
  );
  process.exit(1);
}
if (previousInfo) {
  const backupDir = path.join(REPO_ROOT, 'storage', 'backups', 'catalog');
  const name = `catalog-v${previousInfo['catalog_version']}-${(previousInfo['content_hash'] ?? '').slice(0, 8)}.db`;
  if (!fs.existsSync(path.join(backupDir, name))) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(outFile, path.join(backupDir, name));
    console.log(`Копия прошлой сборки: ${path.join(backupDir, name)}`);
  }
}

const now = new Date();
console.log(`Кэш: ${cacheDir}`);
console.log(`Каталог: ${outFile}${fresh ? ' (с нуля)' : ''}`);

const result = buildCatalog({
  cacheDir,
  reviewedDir: DEFAULT_PATHS.reviewedSpells,
  outFile,
  previousFile: fresh ? null : outFile,
  sourceKind,
  now,
});

const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const report = writeBuildReport(result, DEFAULT_PATHS.reports, `catalog-build-${stamp}`);

for (const line of summaryLines(result)) {
  console.log(line);
}
for (const issue of result.issues.filter((item) => item.severity === 'error')) {
  console.log(`ОШИБКА ${issue.entityId ?? issue.dndsuId ?? ''} ${issue.field}: ${issue.message}`);
}
console.log(`Отчёт: ${report}`);

if (values.strict && result.issues.some((issue) => issue.severity === 'error')) {
  process.exitCode = 1;
}
