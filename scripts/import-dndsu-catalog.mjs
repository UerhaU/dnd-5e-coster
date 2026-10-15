import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_URL = 'https://dnd.su';
const OUTPUT_DIR = path.join(ROOT, 'storage', 'imports');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'dndsu-5e2014-catalog.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'dndsu-5e2014-parse-catalog.md');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sourceAliases = new Map([
  ['PH14', "Player's Handbook"],
  ['PHB', "Player's Handbook"],
  ['DMG', "Dungeon Master's Guide"],
  ['MM', 'Monster Manual'],
  ['SCAG', "Sword Coast Adventurer's Guide"],
  ['SAS', 'Spelljammer: Adventures in Space'],
  ['TCE', "Tasha's Cauldron of Everything"],
  ['XGE', "Xanathar's Guide to Everything"],
  ['VGM', "Volo's Guide to Monsters"],
  ['MTF', "Mordenkainen's Tome of Foes"],
  ['RLW', 'Eberron: Rising from the Last War'],
  ['EGW', "Explorer's Guide to Wildemount"],
  ['FTD', "Fizban's Treasury of Dragons"],
  ['SCC', 'Strixhaven: A Curriculum of Chaos',
  ],
  ['VRGR', "Van Richten's Guide to Ravenloft"],
  ['TDOMT', 'The Book of Many Things'],
  ['BPGG', 'Bigby Presents: Glory of the Giants'],
  ['PS:A', 'Plane Shift: Amonkhet'],
  ['PS:In', 'Plane Shift: Innistrad'],
  ['AI', 'Acquisition Incorporated'],
  ['GGR', "Guildmasters' Guide to Ravnica"],
  ['MOT', 'Mythic Odysseys of Theros'],
  ['MPMM', 'Mordenkainen Presents: Monsters of the Multiverse'],
  ['SDQ', 'Dragonlance: Shadow of the Dragon Queen'],
  ['POA', 'Princes of the Apocalypse'],
  ['WBW', 'The Wild Beyond The Witchlight: A Feywild Adventure'],
  ['LR', 'Locathah Rising'],
  ['OGA', 'One Grung Above'],
  ['TP', 'The Tortle Package'],
  ['UA', 'Unearthed Arcana'],
  ['HB', 'Homebrew'],
]);

const siteSourceProfiles = [
  {
    sourceTitle: "Player's Handbook",
    editionCompatibility: '5e_2014',
    sourceType: 'core_rules',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Dungeon Master's Guide",
    editionCompatibility: '5e_2014',
    sourceType: 'core_rules',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'Monster Manual',
    editionCompatibility: '5e_2014',
    sourceType: 'core_rules',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Sword Coast Adventurer's Guide",
    editionCompatibility: '5e_2014',
    sourceType: 'setting',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Tasha's Cauldron of Everything",
    editionCompatibility: '5e_2014',
    sourceType: 'rules_expansion',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Xanathar's Guide to Everything",
    editionCompatibility: '5e_2014',
    sourceType: 'rules_expansion',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Volo's Guide to Monsters",
    editionCompatibility: '5e_2014',
    sourceType: 'bestiary_expansion',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Mordenkainen's Tome of Foes",
    editionCompatibility: '5e_2014',
    sourceType: 'bestiary_expansion',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Fizban's Treasury of Dragons",
    editionCompatibility: '5e_2014',
    sourceType: 'rules_expansion',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'Eberron: Rising from the Last War',
    editionCompatibility: '5e_2014',
    sourceType: 'setting',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Explorer's Guide to Wildemount",
    editionCompatibility: '5e_2014',
    sourceType: 'setting',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'Strixhaven: A Curriculum of Chaos',
    editionCompatibility: '5e_2014',
    sourceType: 'setting',
    defaultEnabled: true,
  },
  {
    sourceTitle: "Van Richten's Guide to Ravenloft",
    editionCompatibility: '5e_2014',
    sourceType: 'setting',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'Spelljammer: Adventures in Space',
    editionCompatibility: '5e_2014',
    sourceType: 'setting',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'Spelljammer: Adventures in Space',
    editionCompatibility: '5e_2014',
    sourceType: 'bestiary_expansion',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'Planescape: Adventures in the Multiverse',
    editionCompatibility: '5e_2014',
    sourceType: 'setting',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'Planescape: Adventures in the Multiverse',
    editionCompatibility: '5e_2014',
    sourceType: 'bestiary_expansion',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'Bigby Presents: Glory of the Giants',
    editionCompatibility: '5e_2014',
    sourceType: 'rules_expansion',
    defaultEnabled: true,
  },
  {
    sourceTitle: 'The Book of Many Things',
    editionCompatibility: 'unknown',
    sourceType: 'mixed',
    defaultEnabled: false,
    quality: 'low_quality_photo',
    reviewStatus: 'needs_quality_warning',
  },
  {
    sourceTitle: "Krenko's Way",
    editionCompatibility: '5e_2014',
    sourceType: 'adventure',
    defaultEnabled: false,
    reviewStatus: 'needs_review',
  },
];

const canonicalSourceTitleByLower = new Map(
  [...sourceAliases.values(), ...siteSourceProfiles.map((profile) => profile.sourceTitle)].map((title) => [
    title.toLowerCase(),
    title,
  ]),
);

const siteSourceProfilesByTitle = new Map(siteSourceProfiles.map((profile) => [profile.sourceTitle, profile]));

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-');
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё]+/giu, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSourceTitle(source) {
  if (!source) {
    return null;
  }
  const trimmed = source.trim();
  const aliased = sourceAliases.get(trimmed) ?? trimmed;
  return canonicalSourceTitleByLower.get(aliased.toLowerCase()) ?? aliased;
}

function splitRuEn(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^(.+?)\s+([A-Za-z][A-Za-z0-9'’:/&,.\- ()]+)$/u);
  if (!match) {
    return { russianName: normalized, englishName: null };
  }
  return {
    russianName: match[1].trim(),
    englishName: match[2].trim(),
  };
}

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'dnd-5e-companion-dndsu-catalog/0.1 metadata-only',
          accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
      });
      if (!response.ok) {
        throw new Error(`Fetch failed ${response.status}: ${url}`);
      }
      return response.text();
    } catch (error) {
      lastError = error;
      await sleep(400 * attempt);
    }
  }
  throw lastError;
}

function makeEntity({ category, russianName, englishName, sourceTitle, url, sourceIds = [], extra = {} }) {
  const canonicalSeed = [category, sourceTitle ?? 'unknown', englishName ?? russianName].join(':');
  return {
    canonicalId: slugify(canonicalSeed),
    category,
    russianName,
    englishName,
    sourceTitle: sourceTitle ?? 'unknown',
    sourceIds,
    url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
    sourcePriority: 'site',
    editionCompatibility: sourceTitle && sourceTitle !== 'The Book of Many Things' ? '5e_2014' : 'unknown',
    reviewStatus: sourceTitle ? 'site_catalog' : 'needs_source_review',
    ...extra,
  };
}

function extractTextLinks(html, hrefPrefix) {
  const links = [];
  const regex = /<a\s+[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(regex)) {
    const href = decodeHtml(match[2]);
    if (!href.startsWith(hrefPrefix) || href === hrefPrefix) {
      continue;
    }
    links.push({
      href,
      text: decodeHtml(match[3]),
    });
  }
  return links;
}

function parseEmbeddedSourceText(text, sourceCandidates) {
  const source = sourceCandidates.find((candidate) => text.endsWith(` ${candidate}`));
  if (!source) {
    return { namesText: text, sourceTitle: null };
  }
  return {
    namesText: text.slice(0, -source.length).trim(),
    sourceTitle: normalizeSourceTitle(source),
  };
}

function htmlToMarkedLines(html) {
  let marked = html.replace(/<a\s+[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_all, _quote, href, inner) => {
    return `\n[[LINK|${decodeHtml(href)}|${decodeHtml(inner)}]]\n`;
  });
  marked = marked.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(h\d|p|div|li|section)>/gi, '\n');
  marked = decodeEntities(marked.replace(/<[^>]+>/g, ' '));
  return marked
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseGroupedPage(html, category, hrefPrefix, sourceTitles) {
  const lines = htmlToMarkedLines(html);
  const result = [];
  let currentSource = null;
  for (const line of lines) {
    if (sourceTitles.includes(line)) {
      currentSource = normalizeSourceTitle(line);
      continue;
    }
    const link = line.match(/^\[\[LINK\|([^|]+)\|(.+?)\]\]$/);
    if (!link) {
      continue;
    }
    const href = link[1];
    if (!href.includes(hrefPrefix) || href === hrefPrefix) {
      continue;
    }
    const names = splitRuEn(link[2]);
    result.push(
      makeEntity({
        category,
        russianName: names.russianName,
        englishName: names.englishName,
        sourceTitle: currentSource,
        url: href,
      }),
    );
  }
  return result;
}

function parseClassPage(html) {
  const sourceCandidates = [
    "Tasha's Cauldron of Everything",
    "Player's Handbook",
    'Valda\'s Spire of Secrets',
    'Steinhardt\'s Guide to the Eldritch Hunt',
    'Matt Mercer / Critical Role',
    'Dungeon Masters Guild',
    'Unearthed Arcana',
    'laserllama',
    'Homebrew',
  ];
  return extractTextLinks(html, '/class/')
    .filter((link) => link.text !== 'Классы')
    .map((link) => {
      const parsed = parseEmbeddedSourceText(link.text, sourceCandidates);
      const names = splitRuEn(parsed.namesText);
      return makeEntity({
        category: 'classes',
        russianName: names.russianName,
        englishName: names.englishName,
        sourceTitle: parsed.sourceTitle,
        url: link.href,
      });
    });
}

function parseRacePage(html) {
  const sourceCodes = Array.from(sourceAliases.keys()).sort((a, b) => b.length - a.length);
  return extractTextLinks(html, '/race/')
    .filter((link) => link.text !== 'Расы и происхождения')
    .map((link) => {
      const parsed = parseEmbeddedSourceText(link.text, sourceCodes);
      const names = splitRuEn(parsed.namesText);
      return makeEntity({
        category: 'races',
        russianName: names.russianName,
        englishName: names.englishName,
        sourceTitle: parsed.sourceTitle,
        url: link.href,
      });
    });
}

function flattenDataList(entries, output = new Map()) {
  if (!Array.isArray(entries)) {
    if (entries && typeof entries === 'object') {
      return flattenDataList(Object.values(entries), output);
    }
    return output;
  }
  for (const entry of entries) {
    if (entry && typeof entry === 'object') {
      if (entry.value !== undefined && entry.title) {
        output.set(String(entry.value), String(entry.title));
      }
      if (entry.list) {
        flattenDataList(Array.isArray(entry.list) ? entry.list : Object.values(entry.list), output);
      }
    }
  }
  return output;
}

function extractSourceMapFromPage(html) {
  const input = html.match(/<input(?=[^>]*name=["']source["'])(?=[^>]*data-list=["']([^"']+)["'])[^>]*>/i);
  if (!input) {
    return new Map();
  }
  try {
    const parsed = JSON.parse(decodeHtml(input[1]));
    return flattenDataList(parsed);
  } catch {
    return new Map();
  }
}

function extractWindowList(pieceHtml) {
  const match = pieceHtml.match(/window\.LIST\s*=\s*({[\s\S]*?});\s*<\/script>/i);
  if (!match) {
    return null;
  }
  return JSON.parse(match[1]);
}

function extractAssignedJsonObject(script, assignmentName) {
  const start = script.indexOf(assignmentName);
  if (start === -1) {
    return null;
  }
  const objectStart = script.indexOf('{', start);
  if (objectStart === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = objectStart; index < script.length; index += 1) {
    const char = script[index];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(script.slice(objectStart, index + 1));
      }
    }
  }

  return null;
}

function extractWindowFilterItems(pieceHtml) {
  return extractAssignedJsonObject(pieceHtml, 'window.filterItems') ?? {};
}

function parseHtmlListItems(pieceHtml, category, sourceMap, filterItems, extraReader) {
  const result = [];
  const regex = /<div class='col [^']*for_filter'[^>]*data-search='([^']*)'[^>]*data-id='([^']*)'[\s\S]*?<a href='([^']+)'[\s\S]*?<div class='list-item-title'>\s*([\s\S]*?)\s*<\/div>([\s\S]*?)<\/a>/gi;
  for (const match of pieceHtml.matchAll(regex)) {
    const dataSearch = decodeHtml(match[1]);
    const id = match[2];
    const href = decodeHtml(match[3]);
    const russianName = decodeHtml(match[4]);
    const englishName = dataSearch
      .split(',')
      .map((part) => part.trim())
      .find((part) => /[A-Za-z]/.test(part) && part !== russianName) ?? null;
    const sourceIds = filterItems[id]?.source ?? [];
    const sourceTitle = sourceIds.length === 1 ? normalizeSourceTitle(sourceMap.get(String(sourceIds[0]))) : null;
    const sourceTitles = sourceIds.map((sourceId) => normalizeSourceTitle(sourceMap.get(String(sourceId))) ?? String(sourceId));
    result.push(
      makeEntity({
        category,
        russianName,
        englishName,
        sourceTitle,
        sourceIds,
        url: href,
        extra: {
          sourceTitles,
          siteId: id,
          ...extraReader(match[5], filterItems[id] ?? {}),
        },
      }),
    );
  }
  return result;
}

function collectSources(categories) {
  const sourceMap = new Map();
  for (const profile of siteSourceProfiles) {
    const source = sourceMap.get(profile.sourceTitle) ?? {
      title: profile.sourceTitle,
      sourceType: profile.sourceType,
      editionCompatibility: profile.editionCompatibility,
      defaultEnabled: profile.defaultEnabled,
      quality: profile.quality ?? 'verified',
      reviewStatus: profile.reviewStatus ?? 'site_catalog',
      parsedCounts: {},
    };
    sourceMap.set(profile.sourceTitle, source);
  }

  for (const [category, entities] of Object.entries(categories)) {
    for (const entity of entities) {
      const titles = entity.sourceTitles?.length ? entity.sourceTitles : [entity.sourceTitle];
      for (const sourceTitle of titles) {
        if (!sourceTitle || sourceTitle === 'unknown') {
          continue;
        }
        const profile = siteSourceProfilesByTitle.get(sourceTitle);
        const source = sourceMap.get(sourceTitle) ?? {
          title: sourceTitle,
          sourceType: profile?.sourceType ?? 'unknown',
          editionCompatibility: profile?.editionCompatibility ?? 'unknown',
          defaultEnabled: profile?.defaultEnabled ?? false,
          quality: profile?.quality ?? 'site',
          reviewStatus: profile?.reviewStatus ?? 'site_catalog',
          parsedCounts: {},
        };
        source.parsedCounts[category] = (source.parsedCounts[category] ?? 0) + 1;
        sourceMap.set(sourceTitle, source);
      }
    }
  }
  return Array.from(sourceMap.values()).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

function renderMarkdown(catalog, sourceUrls) {
  const lines = [];
  lines.push('# Каталог парсинга DnD.su 5e14');
  lines.push('');
  lines.push(`Дата генерации: ${catalog.generatedAt}`);
  lines.push('');
  lines.push('## Режим импорта');
  lines.push('');
  lines.push('- Собран только каталог метаданных: названия, английские имена, URL, источники, уровни/редкости/CR.');
  lines.push('- Полные тексты правил и описаний не сохранялись в проект.');
  lines.push('- Активный фильтр проекта: только сайт `dnd.su`; локальные PDF-книги не используются и не сверяются.');
  lines.push('');
  lines.push('## Использованные страницы');
  lines.push('');
  for (const url of sourceUrls) {
    lines.push(`- ${url}`);
  }
  lines.push('');
  lines.push('## Статистика');
  lines.push('');
  lines.push('| Категория | Всего в каталоге сайта |');
  lines.push('| --- | ---: |');
  for (const row of catalog.stats.categoryRows) {
    lines.push(`| ${row.title} | ${row.total} |`);
  }
  lines.push('');
  lines.push('## Источники сайта и объем каталога');
  lines.push('');
  lines.push('| Источник | Классы | Расы | Предыстории | Черты | Заклинания | Предметы | Бестиарий |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const source of catalog.sources) {
    lines.push(
      `| ${source.title} | ${source.parsedCounts.classes ?? 0} | ${source.parsedCounts.races ?? 0} | ${source.parsedCounts.backgrounds ?? 0} | ${source.parsedCounts.feats ?? 0} | ${source.parsedCounts.spells ?? 0} | ${source.parsedCounts.magicItems ?? 0} | ${source.parsedCounts.monsters ?? 0} |`,
    );
  }
  lines.push('');
  lines.push('## Что важно для этапа 4');
  lines.push('');
  lines.push('- Для базового листа персонажа уже есть каталог классов, рас, предысторий и черт из доступных источников.');
  lines.push('- Расчеты этапа 4 нужно делать по 5e 2014, а не по 5e24: сайт открыт в ветке 5e14, а `next.dnd.su` оставлен вне импорта.');
  lines.push('- Полный импорт описаний, заклинаний, предметов и бестиария остается отдельным этапом, но теперь есть список сущностей и источников с сайта.');
  lines.push('');
  lines.push(`Полный JSON-каталог: \`${path.relative(ROOT, OUTPUT_JSON).replace(/\\/g, '/')}\`.`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const urls = {
    classes: `${BASE_URL}/class/`,
    races: `${BASE_URL}/race/`,
    backgrounds: `${BASE_URL}/backgrounds/`,
    feats: `${BASE_URL}/feats/`,
    spells: `${BASE_URL}/spells/`,
    spellPiece: `${BASE_URL}/piece/spells/index-list/`,
    items: `${BASE_URL}/items/`,
    itemPiece: `${BASE_URL}/piece/items/index-list/`,
    bestiary: `${BASE_URL}/bestiary/`,
    bestiaryPiece: `${BASE_URL}/piece/bestiary/index-list/?content=multiverse`,
  };

  const [
    classHtml,
    raceHtml,
    backgroundHtml,
    featHtml,
    spellPageHtml,
    spellPieceHtml,
    itemPageHtml,
    itemPieceHtml,
    bestiaryPageHtml,
    bestiaryPieceHtml,
  ] = await Promise.all([
    fetchText(urls.classes),
    fetchText(urls.races),
    fetchText(urls.backgrounds),
    fetchText(urls.feats),
    fetchText(urls.spells),
    fetchText(urls.spellPiece),
    fetchText(urls.items),
    fetchText(urls.itemPiece),
    fetchText(urls.bestiary),
    fetchText(urls.bestiaryPiece),
  ]);

  const groupedSourceTitles = [
    ...siteSourceProfiles.map((profile) => profile.sourceTitle),
    'Acquisition Incorporated',
    "Baldur's Gate: Descent Into Avernus",
    'Bigby Presents: Glory of the Giants',
    'Dragonlance: Shadow of the Dragon Queen',
    'Ghosts of Saltmarsh',
    "Guildmasters' guide to Ravnica",
    "Guildmasters' Guide to Ravnica",
    'Hoard of the Dragon Queen',
    'Mythic Odysseys of Theros',
    'Out of the Abyss',
    'Planescape: Adventures in the Multiverse',
    'Princes of the Apocalypse',
    'Spelljammer: Adventures in Space',
    'The Wild Beyond The Witchlight: A Feywild Adventure',
    'Tomb of Annihilation',
  ];

  const spellSourceMap = extractSourceMapFromPage(spellPageHtml);
  const itemSourceMap = extractSourceMapFromPage(itemPageHtml);
  const bestiarySourceMap = extractSourceMapFromPage(bestiaryPageHtml);
  const spellList = extractWindowList(spellPieceHtml);
  const itemFilters = extractWindowFilterItems(itemPieceHtml);
  const bestiaryFilters = extractWindowFilterItems(bestiaryPieceHtml);

  const allCategories = {
    classes: parseClassPage(classHtml),
    races: parseRacePage(raceHtml),
    backgrounds: parseGroupedPage(backgroundHtml, 'backgrounds', '/backgrounds/', groupedSourceTitles),
    feats: parseGroupedPage(featHtml, 'feats', '/feats/', groupedSourceTitles),
    spells: (spellList?.cards ?? []).map((card) => {
      const sourceIds = card.filter_source?.map(String) ?? [];
      const sourceTitles = sourceIds.map((sourceId) => normalizeSourceTitle(spellSourceMap.get(sourceId)) ?? sourceId);
      return makeEntity({
        category: 'spells',
        russianName: card.title,
        englishName: card.title_en ?? null,
        sourceTitle: sourceTitles.length === 1 ? sourceTitles[0] : null,
        sourceIds,
        url: card.link,
        extra: {
          sourceTitles,
          level: card.item_prefix ?? card.level,
          school: card.school ?? null,
          components: card.item_suffix ?? null,
          concentration: Boolean(card.item_tags?.concentration),
          ritual: Boolean(card.item_tags?.ritual),
        },
      });
    }),
    magicItems: parseHtmlListItems(itemPieceHtml, 'magicItems', itemSourceMap, itemFilters, (itemHtml, filters) => ({
      itemTypeIds: filters.type ?? [],
      rarityIds: filters.quality ?? [],
      attunementIds: filters.attunement ?? [],
      flags: {
        requiresAttunement: /Требуется настройка/.test(itemHtml),
      },
    })),
    monsters: parseHtmlListItems(bestiaryPieceHtml, 'monsters', bestiarySourceMap, bestiaryFilters, (itemHtml, filters) => ({
      challenge: decodeHtml(itemHtml.match(/list-mark__danger'>\s*\[<span>(.*?)<\/span>\]/)?.[1] ?? ''),
      npc: /Именной НИП/.test(itemHtml),
      hasClassicVariant: /Есть вариант из «Классики»/.test(itemHtml),
      sizeIds: filters.size ?? [],
      typeIds: filters.type ?? [],
      alignmentIds: filters.alignment ?? [],
    })),
  };

  const siteCategories = allCategories;
  const sources = collectSources(siteCategories);

  const categoryTitles = {
    classes: 'Классы',
    races: 'Расы и происхождения',
    backgrounds: 'Предыстории',
    feats: 'Черты',
    spells: 'Заклинания',
    magicItems: 'Магические предметы',
    monsters: 'Бестиарий',
  };

  const catalog = {
    generatedAt: new Date().toISOString(),
    sourceSite: BASE_URL,
    editionScope: '5e_2014',
    importMode: 'metadata_only',
    sourcePolicy: 'dndsu_only',
    stats: {
      categoryRows: Object.keys(allCategories).map((category) => ({
        category,
        title: categoryTitles[category],
        total: allCategories[category].length,
      })),
    },
    sources,
    categories: siteCategories,
  };

  await writeFile(OUTPUT_JSON, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, renderMarkdown(catalog, Object.values(urls)), 'utf8');

  console.log(JSON.stringify({
    outputJson: OUTPUT_JSON,
    outputMarkdown: OUTPUT_MD,
    stats: catalog.stats.categoryRows,
    sources: catalog.sources.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
