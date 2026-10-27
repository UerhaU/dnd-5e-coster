// npm run catalog:compare-legacy — сверить catalog.db с каталогом v0.1.
// Каталог v0.1 читается из ветки legacy (database/spells/full-catalog.json).
//
//   npm run catalog:compare-legacy
//   npm run catalog:compare-legacy -- --catalog <файл> --legacy <full-catalog.json>

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { compareWithLegacy, type LegacyCatalog } from '../legacy/compare-legacy.ts';
import { DEFAULT_PATHS, REPO_ROOT } from '../paths.ts';

const { values } = parseArgs({
  options: { catalog: { type: 'string' }, legacy: { type: 'string' } },
});

const legacyJson = values.legacy
  ? fs.readFileSync(values.legacy, 'utf8')
  : execFileSync('git', ['show', 'refs/heads/legacy:database/spells/full-catalog.json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
const legacy = JSON.parse(legacyJson) as LegacyCatalog;
const result = compareWithLegacy(path.resolve(values.catalog ?? DEFAULT_PATHS.catalog), legacy);

const byField = new Map<string, { value: number; format: number; missing: number }>();
for (const difference of result.differences) {
  const counts = byField.get(difference.field) ?? { value: 0, format: 0, missing: 0 };
  counts[difference.kind] += 1;
  byField.set(difference.field, counts);
}

const lines = [
  '# Сверка каталога с v0.1',
  '',
  `- Заклинаний в v0.1: ${result.legacyCount}, в catalog.db: ${result.currentCount}`,
  `- Только в v0.1: ${result.onlyInLegacy.join(', ') || 'нет'}`,
  `- Только в catalog.db: ${result.onlyInCurrent.join(', ') || 'нет'}`,
  '',
  '| Поле | Другое значение | Только формат | Нет в v2 |',
  '| --- | --- | --- | --- |',
  ...[...byField].map(
    ([field, counts]) => `| ${field} | ${counts.value} | ${counts.format} | ${counts.missing} |`,
  ),
  '',
  '## Расхождения значений',
  '',
  '| DnD.su | ID | Название | Поле | v0.1 | v2 |',
  '| --- | --- | --- | --- | --- | --- |',
];
const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ⏎ ').slice(0, 300);
for (const difference of result.differences.filter((item) => item.kind !== 'format')) {
  lines.push(
    `| ${difference.dndsuId} | ${difference.entityId ?? '—'} | ${difference.nameRu} | ${difference.field} | ${cell(difference.legacy)} | ${cell(difference.current)} |`,
  );
}

fs.mkdirSync(DEFAULT_PATHS.reports, { recursive: true });
const base = path.join(DEFAULT_PATHS.reports, 'compare-legacy');
fs.writeFileSync(`${base}.json`, `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(`${base}.md`, `${lines.join('\n')}\n`);

console.log(lines.slice(2, lines.indexOf('## Расхождения значений')).join('\n'));
console.log(`Отчёт: ${base}.md`);
