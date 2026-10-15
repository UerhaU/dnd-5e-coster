import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'storage', 'imports');
const REPORT_JSON = path.join(OUTPUT_DIR, 'dndsu-stage15-review-report.json');
const REPORT_MD = path.join(ROOT, 'docs', 'stage-15-import-review-report.md');

const prisma = new PrismaClient();

function parseJson(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeName(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[^a-zа-яё0-9]+/giu, ' ')
    .trim();
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 16);
}

function sortedStrings(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).sort((a, b) => a.localeCompare(b)) : [];
}

function descriptionHash(payload) {
  const description = payload?.details?.descriptionText;
  return description ? hash(String(description).replace(/\s+/g, ' ').trim()) : null;
}

function mechanicsFingerprint(category, mechanics, payload, entry) {
  if (category === 'spells') {
    return {
      level: mechanics.level ?? null,
      school: mechanics.school ?? null,
      components: mechanics.components ?? null,
      concentration: Boolean(mechanics.concentration),
      ritual: Boolean(mechanics.ritual),
      castingTime: mechanics.castingTime ?? null,
      range: mechanics.range ?? null,
      duration: mechanics.duration ?? null,
      classes: sortedStrings(mechanics.classes),
      descriptionHash: descriptionHash(payload),
    };
  }

  if (category === 'magicItems') {
    return {
      itemTypeIds: sortedStrings(mechanics.itemTypeIds),
      rarityIds: sortedStrings(mechanics.rarityIds),
      attunementIds: sortedStrings(mechanics.attunementIds),
      requiresAttunement: Boolean(mechanics.requiresAttunement),
      typeLine: normalizeName(mechanics.typeLine),
      priceText: normalizeName(mechanics.priceText),
      descriptionHash: descriptionHash(payload),
    };
  }

  return {
    canonicalId: entry.canonicalId,
  };
}

function shortEntry(entry) {
  return {
    canonicalId: entry.canonicalId,
    category: entry.category,
    russianName: entry.russianName,
    englishName: entry.englishName,
    sourceTitle: entry.sourceTitle,
    entityUrl: entry.entityUrl,
    editionCompatibility: entry.editionCompatibility,
    reviewStatus: entry.reviewStatus,
  };
}

function pushGroup(map, key, entry) {
  if (!key) {
    return;
  }
  const group = map.get(key) ?? [];
  group.push(entry);
  map.set(key, group);
}

function groupCounts(entries, key) {
  const counts = {};
  for (const entry of entries) {
    const value = entry[key] ?? 'null';
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function formatCandidate(group) {
  return group.map(shortEntry);
}

function toMarkdown(report) {
  const lines = [
    '# Stage 15 Import Review Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total imported rows: ${report.totalImported}`,
    `- Missing matched SourceBook: ${report.missingSourceBook.count}`,
    `- Unknown edition rows: ${report.unknownEdition.count}`,
    `- English-name duplicate candidate groups: ${report.duplicates.byEnglishName.count}`,
    `- Mechanics duplicate candidate groups: ${report.duplicates.byMechanics.count}`,
    '',
    '## By Category',
    '',
    '| Category | Count |',
    '| --- | ---: |',
  ];

  for (const [category, count] of Object.entries(report.byCategory)) {
    lines.push(`| ${category} | ${count} |`);
  }

  lines.push('', '## Missing SourceBook Matches', '');
  for (const entry of report.missingSourceBook.samples) {
    lines.push(`- ${entry.category}: ${entry.russianName} (${entry.sourceTitle ?? 'no source'})`);
  }

  lines.push('', '## Duplicate Candidate Policy', '');
  lines.push(
    'Candidates are grouped by normalized English name and by stable mechanics fingerprints. Russian names alone are not used as the duplicate key.',
  );
  lines.push('These are review candidates, not automatic merges.');

  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const entries = await prisma.importedContent.findMany({
    orderBy: [{ category: 'asc' }, { russianName: 'asc' }],
  });

  const byEnglishName = new Map();
  const byMechanics = new Map();

  for (const entry of entries) {
    const englishKey = entry.englishName ? `${entry.category}:${normalizeName(entry.englishName)}` : '';
    pushGroup(byEnglishName, englishKey, entry);

    const mechanics = parseJson(entry.mechanicsJson);
    const payload = parseJson(entry.payloadJson);
    const mechanicsKey = `${entry.category}:${hash(mechanicsFingerprint(entry.category, mechanics, payload, entry))}`;
    pushGroup(byMechanics, mechanicsKey, entry);
  }

  const englishDuplicateGroups = [...byEnglishName.values()]
    .filter((group) => group.length > 1)
    .sort((a, b) => b.length - a.length || a[0].russianName.localeCompare(b[0].russianName));

  const mechanicsDuplicateGroups = [...byMechanics.values()]
    .filter((group) => {
      if (group.length < 2) {
        return false;
      }
      const names = new Set(group.flatMap((entry) => [normalizeName(entry.englishName), normalizeName(entry.russianName)]).filter(Boolean));
      return names.size > 1;
    })
    .sort((a, b) => b.length - a.length || a[0].russianName.localeCompare(b[0].russianName));

  const missingSourceBook = entries.filter((entry) => !entry.sourceBookId);
  const unknownEdition = entries.filter((entry) => entry.editionCompatibility === 'unknown');

  const report = {
    generatedAt: new Date().toISOString(),
    totalImported: entries.length,
    byCategory: groupCounts(entries, 'category'),
    byEdition: groupCounts(entries, 'editionCompatibility'),
    byReviewStatus: groupCounts(entries, 'reviewStatus'),
    missingSourceBook: {
      count: missingSourceBook.length,
      samples: missingSourceBook.slice(0, 50).map(shortEntry),
    },
    unknownEdition: {
      count: unknownEdition.length,
      samples: unknownEdition.slice(0, 50).map(shortEntry),
    },
    duplicates: {
      policy: 'Grouped by normalized English name and mechanics fingerprint; Russian names alone are not duplicate keys.',
      byEnglishName: {
        count: englishDuplicateGroups.length,
        samples: englishDuplicateGroups.slice(0, 50).map(formatCandidate),
      },
      byMechanics: {
        count: mechanicsDuplicateGroups.length,
        samples: mechanicsDuplicateGroups.slice(0, 50).map(formatCandidate),
      },
    },
  };

  await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(REPORT_MD, toMarkdown(report), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
