import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const ROOT = process.cwd();
const CATALOG_JSON = path.join(ROOT, 'storage', 'imports', 'dndsu-5e2014-catalog.json');
const OUTPUT_DIR = path.join(ROOT, 'storage', 'imports');
const SUMMARY_JSON = path.join(OUTPUT_DIR, 'dndsu-stage15-content-import-summary.json');
const CACHE_DIR = path.join(OUTPUT_DIR, 'cache', 'dndsu-pages');

const prisma = new PrismaClient();

const categoryLabels = {
  classes: 'Классы',
  races: 'Расы',
  backgrounds: 'Предыстории',
  feats: 'Черты',
  spells: 'Заклинания',
  magicItems: 'Магические предметы',
  monsters: 'Бестиарий',
};

function normalizeUrl(url) {
  if (!url) {
    return '';
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://dnd.su${url.startsWith('/') ? '' : '/'}${url}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё]+/giu, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&thinsp;|&#8201;|\u2009/g, '')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return decodeHtml(
    String(value ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function splitList(value) {
  return stripHtml(value)
    .split(/[,;]\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithCache(url) {
  const normalizedUrl = normalizeUrl(url);
  const cachePath = path.join(CACHE_DIR, `${slugify(normalizedUrl)}.html`);

  try {
    return await readFile(cachePath, 'utf8');
  } catch {
    // cache miss
  }

  const response = await fetch(normalizedUrl, {
    headers: {
      'user-agent': 'dnd-5e-companion-stage15/0.1 structured-import',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${normalizedUrl}`);
  }

  const html = await response.text();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath, html, 'utf8');
  await sleep(120);
  return html;
}

function normalizeComponents(value) {
  const normalized = String(value ?? '').replace(/\s+/g, '').replace(/\.+$/g, '');
  return {
    raw: value ?? null,
    verbal: /В/.test(normalized),
    somatic: /С/.test(normalized),
    material: /М/.test(normalized),
  };
}

function spellMechanics(entity) {
  const components = normalizeComponents(entity.components);

  return {
    level: Number.isFinite(Number(entity.level)) ? Number(entity.level) : null,
    school: entity.school ?? null,
    components,
    concentration: Boolean(entity.concentration),
    ritual: Boolean(entity.ritual),
  };
}

function extractMetaContent(html, propertyOrName) {
  const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  return decodeHtml(html.match(regex)?.[1] ?? '');
}

function extractSpellDetails(html) {
  const detail = {
    castingTime: null,
    range: null,
    duration: null,
    classes: [],
    subclasses: [],
    componentsText: null,
    materialText: null,
    descriptionText: null,
    higherLevelsText: null,
    imageUrl: extractMetaContent(html, 'og:image') || null,
    pageDescription: extractMetaContent(html, 'description') || null,
  };

  for (const match of html.matchAll(/<li><strong>([^<:]+):<\/strong>\s*([\s\S]*?)<\/li>/gi)) {
    const label = stripHtml(match[1]).toLocaleLowerCase('ru-RU');
    const valueHtml = match[2];
    const value = stripHtml(valueHtml);

    if (label === 'время накладывания') {
      detail.castingTime = value;
    } else if (label === 'дистанция') {
      detail.range = value;
    } else if (label === 'компоненты') {
      detail.componentsText = value;
      const materialMatch = value.match(/М\s*\((.*?)\)/i);
      detail.materialText = materialMatch?.[1]?.trim() ?? null;
    } else if (label === 'длительность') {
      detail.duration = value;
    } else if (label === 'классы') {
      detail.classes = splitList(value);
    } else if (label === 'подклассы') {
      detail.subclasses = splitList(value);
    }
  }

  const descHtml = html.match(/<li class="subsection desc"><div itemprop="description">([\s\S]*?)<\/div><\/li>/i)?.[1] ?? '';
  if (descHtml) {
    const paragraphs = [...descHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => stripHtml(match[1])).filter(Boolean);
    const higherIndex = paragraphs.findIndex((paragraph) => /На больших уровнях\./i.test(paragraph));
    if (higherIndex >= 0) {
      detail.descriptionText = paragraphs.slice(0, higherIndex).join('\n\n') || null;
      detail.higherLevelsText = paragraphs.slice(higherIndex).join('\n\n').replace(/^На больших уровнях\.\s*/i, '') || null;
    } else {
      detail.descriptionText = paragraphs.join('\n\n') || stripHtml(descHtml) || null;
    }
  }

  return detail;
}

function detailedSpellMechanics(entity, details) {
  const base = spellMechanics(entity);
  const components = details?.componentsText ? normalizeComponents(details.componentsText) : base.components;

  return {
    ...base,
    components,
    castingTime: details?.castingTime ?? null,
    range: details?.range ?? null,
    duration: details?.duration ?? null,
    classes: details?.classes ?? [],
    subclasses: details?.subclasses ?? [],
    materialText: details?.materialText ?? null,
    hasDescription: Boolean(details?.descriptionText),
    hasHigherLevels: Boolean(details?.higherLevelsText),
  };
}

function extractMagicItemDetails(html) {
  const typeLineHtml =
    html.match(/<li[^>]+class=["'][^"']*size-type-alignment[^"']*["'][^>]*>([\s\S]*?)<\/li>/i)?.[1] ?? '';
  const priceHtml = html.match(/<li[^>]+class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/li>/i)?.[1] ?? '';
  const descHtml = html.match(/<li class="subsection desc"><div itemprop="description">([\s\S]*?)<\/div><\/li>/i)?.[1] ?? '';
  const descriptionText = descHtml
    ? [...descHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => stripHtml(match[1])).filter(Boolean).join('\n\n') ||
      stripHtml(descHtml) ||
      null
    : null;
  const typeLine = stripHtml(typeLineHtml) || null;
  const priceText = stripHtml(priceHtml).replace(/^Рекомендованная стоимость:\s*/i, '') || null;
  const priceNumbers = priceText ? [...priceText.matchAll(/\d+/g)].map((match) => Number(match[0])) : [];

  return {
    typeLine,
    priceText,
    priceMinGp: priceNumbers[0] ?? null,
    priceMaxGp: priceNumbers[1] ?? priceNumbers[0] ?? null,
    requiresAttunementText: typeLine ? /требуется настройка/i.test(typeLine) : null,
    descriptionText,
    imageUrl: extractMetaContent(html, 'og:image') || null,
    pageDescription: extractMetaContent(html, 'description') || null,
  };
}

function magicItemMechanics(entity, details = null) {
  return {
    itemTypeIds: entity.itemTypeIds ?? [],
    rarityIds: entity.rarityIds ?? [],
    attunementIds: entity.attunementIds ?? [],
    requiresAttunement: Boolean(entity.flags?.requiresAttunement),
    typeLine: details?.typeLine ?? null,
    priceText: details?.priceText ?? null,
    priceMinGp: details?.priceMinGp ?? null,
    priceMaxGp: details?.priceMaxGp ?? null,
    hasDescription: Boolean(details?.descriptionText),
  };
}

function monsterMechanics(entity) {
  return {
    challenge: entity.challenge ?? null,
    npc: Boolean(entity.npc),
    hasClassicVariant: Boolean(entity.hasClassicVariant),
    sizeIds: entity.sizeIds ?? [],
    typeIds: entity.typeIds ?? [],
    alignmentIds: entity.alignmentIds ?? [],
  };
}

function payloadFor(entity, details = null) {
  return {
    sourceIds: entity.sourceIds ?? [],
    sourceTitles: entity.sourceTitles ?? (entity.sourceTitle ? [entity.sourceTitle] : []),
    details: details
      ? {
          descriptionText: details.descriptionText,
          higherLevelsText: details.higherLevelsText,
          imageUrl: details.imageUrl,
          pageDescription: details.pageDescription,
          typeLine: details.typeLine,
          priceText: details.priceText,
        }
      : null,
    originalCatalogEntity: entity,
  };
}

function mechanicsFor(category, entity, details = null) {
  if (category === 'spells') {
    return details ? detailedSpellMechanics(entity, details) : spellMechanics(entity);
  }

  if (category === 'magicItems') {
    return magicItemMechanics(entity, details);
  }

  if (category === 'monsters') {
    return monsterMechanics(entity);
  }

  return {};
}

async function readDetails(category, entity, importDetails) {
  if (!importDetails || !['spells', 'magicItems'].includes(category)) {
    return null;
  }

  const html = await fetchWithCache(entity.url);
  if (category === 'spells') {
    return extractSpellDetails(html);
  }
  if (category === 'magicItems') {
    return extractMagicItemDetails(html);
  }
  return null;
}

async function importCategory(category, options = {}) {
  const catalog = JSON.parse(await readFile(CATALOG_JSON, 'utf8'));
  const allEntities = catalog.categories?.[category];

  if (!Array.isArray(allEntities)) {
    throw new Error(`Категория "${category}" не найдена в ${CATALOG_JSON}`);
  }

  const entities = options.limit ? allEntities.slice(0, options.limit) : allEntities;

  const sourceBooks = await prisma.sourceBook.findMany({
    where: { fileName: { startsWith: 'dndsu:' } },
    select: { id: true, titleOriginal: true, titleRu: true },
  });
  const sourceBookByTitle = new Map();
  for (const sourceBook of sourceBooks) {
    if (sourceBook.titleOriginal) {
      sourceBookByTitle.set(sourceBook.titleOriginal, sourceBook);
    }
    sourceBookByTitle.set(sourceBook.titleRu, sourceBook);
  }

  let created = 0;
  let updated = 0;
  let withoutSourceBook = 0;
  let detailsImported = 0;
  let detailErrors = 0;
  const reviewCounts = {};
  const editionCounts = {};

  for (const entity of entities) {
    const sourceBook = entity.sourceTitle ? sourceBookByTitle.get(entity.sourceTitle) : null;
    if (!sourceBook) {
      withoutSourceBook += 1;
    }

    const existing = await prisma.importedContent.findUnique({
      where: { canonicalId: entity.canonicalId },
      select: { id: true },
    });

    const reviewStatus = entity.reviewStatus ?? 'unchecked';
    const editionCompatibility = entity.editionCompatibility ?? 'unknown';
    reviewCounts[reviewStatus] = (reviewCounts[reviewStatus] ?? 0) + 1;
    editionCounts[editionCompatibility] = (editionCounts[editionCompatibility] ?? 0) + 1;

    let details = null;
    try {
      details = await readDetails(category, entity, options.details);
      if (details) {
        detailsImported += 1;
      }
    } catch (error) {
      detailErrors += 1;
      console.warn(`Detail import failed for ${entity.canonicalId}: ${error instanceof Error ? error.message : String(error)}`);
    }

    await prisma.importedContent.upsert({
      where: { canonicalId: entity.canonicalId },
      update: {
        category,
        siteId: entity.siteId ?? null,
        russianName: entity.russianName,
        englishName: entity.englishName ?? null,
        sourceTitle: entity.sourceTitle ?? null,
        sourceBookId: sourceBook?.id ?? null,
        sourceUrl: null,
        entityUrl: normalizeUrl(entity.url),
        sourcePriority: entity.sourcePriority ?? 'site',
        editionCompatibility,
        reviewStatus,
        mechanicsJson: JSON.stringify(mechanicsFor(category, entity, details)),
        payloadJson: JSON.stringify(payloadFor(entity, details)),
        importedAt: new Date(),
      },
      create: {
        canonicalId: entity.canonicalId,
        category,
        siteId: entity.siteId ?? null,
        russianName: entity.russianName,
        englishName: entity.englishName ?? null,
        sourceTitle: entity.sourceTitle ?? null,
        sourceBookId: sourceBook?.id ?? null,
        sourceUrl: null,
        entityUrl: normalizeUrl(entity.url),
        sourcePriority: entity.sourcePriority ?? 'site',
        editionCompatibility,
        reviewStatus,
        mechanicsJson: JSON.stringify(mechanicsFor(category, entity, details)),
        payloadJson: JSON.stringify(payloadFor(entity, details)),
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return {
    category,
    title: categoryLabels[category] ?? category,
    total: entities.length,
    catalogTotal: allEntities.length,
    created,
    updated,
    withoutSourceBook,
    detailsImported,
    detailErrors,
    reviewCounts,
    editionCounts,
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const requestedCategory = args.find((arg) => !arg.startsWith('--')) ?? 'spells';
  const details = args.includes('--details');
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 0;
  const supportedCategories = new Set(['classes', 'races', 'backgrounds', 'feats', 'spells', 'magicItems', 'monsters']);

  if (!supportedCategories.has(requestedCategory)) {
    throw new Error(`Stage 15 пока поддерживает только: ${[...supportedCategories].join(', ')}`);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    importMode: 'stage15_structured_content',
    sourcePolicy: 'dndsu_only_no_local_pdf',
    options: {
      details,
      limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    },
    result: await importCategory(requestedCategory, {
      details,
      limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    }),
  };

  await writeFile(SUMMARY_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
