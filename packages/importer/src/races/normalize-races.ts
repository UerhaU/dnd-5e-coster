import {
  RACE_SCHEMA_VERSION,
  slugFromName,
  textBlocksToPlain,
  type AbilityOption,
  type RaceData,
  type RaceRules,
} from '@koster/shared';
import type { LinkKind } from '../build/catalog-entity.ts';
import { ItemSources } from '../items/sources.ts';
import type { ImportIssue } from '../report/issues.ts';
import { raceBlockKey, type ReviewedRaces } from '../reviewed/reviewed-races.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import type { RawFeature, RawRaceBlock, RawRacePage } from './parse-race-page.ts';
import { parseRaceRules } from './parse-race-rules.ts';

// Шаг normalize для рас: блоки особенностей страницы → раса и разновидности.
// Первый блок — сама раса; остальные — разновидности или та же раса из другой книги
// (по data/reviewed/races/names.json). На страницах со вкладками (дварф, гном) каждая
// вкладка содержит полный список особенностей: общее с расой вычисляется, а не копируется.

export interface NormalizedRace {
  id: string;
  nameRu: string;
  nameEn: string;
  source: NormalizedSource;
  data: RaceData;
  rules: RaceRules;
  links: { toId: string; kind: LinkKind }[];
  /** Ключ записи names.json; у расы страницы — `null`. */
  reviewedKey: string | null;
}

const sameFeature = (left: RawFeature, right: RawFeature) =>
  left.name === right.name && textBlocksToPlain(left.blocks) === textBlocksToPlain(right.blocks);

/** Увеличение вкладки без расового: «Тел +2, Сил +2» − «Тел +2» = «Сил +2». */
function subtractAbilities(
  own: AbilityOption[] | null,
  base: AbilityOption['fixed'],
): AbilityOption[] | null {
  if (!own) return null;
  return own.map((option) => ({
    choices: option.choices,
    fixed: option.fixed
      .map((entry) => {
        const common = base.find((item) => item.ability === entry.ability)?.amount ?? 0;
        return { ability: entry.ability, amount: entry.amount - common };
      })
      .filter((entry) => entry.amount > 0),
  }));
}

/** Общая часть фиксированных увеличений у всех вкладок PHB. */
function commonAbilities(options: (AbilityOption[] | null)[]): AbilityOption['fixed'] | null {
  if (options.some((option) => option?.length !== 1)) return null;
  const fixed = options.map((option) => option?.[0]?.fixed ?? []);
  const first = fixed[0] ?? [];
  return first
    .map((entry) => ({
      ability: entry.ability,
      amount: Math.min(
        ...fixed.map((list) => list.find((item) => item.ability === entry.ability)?.amount ?? 0),
      ),
    }))
    .filter((entry) => entry.amount > 0);
}

export class RaceNormalizer {
  private readonly page: RawRacePage;
  private readonly pageId: number;
  private readonly reviewed: ReviewedRaces;
  private readonly sources: ItemSources;
  private readonly issues: ImportIssue[];
  private readonly pageSource: NormalizedSource | null;

  constructor(
    page: RawRacePage,
    pageId: number,
    reviewed: ReviewedRaces,
    sources: ItemSources,
    issues: ImportIssue[],
  ) {
    this.page = page;
    this.pageId = pageId;
    this.reviewed = reviewed;
    this.sources = sources;
    this.issues = issues;
    this.pageSource = page.sourceTitle ? sources.fromTitle(page.sourceTitle) : null;
  }

  private issue(
    severity: ImportIssue['severity'],
    field: string,
    message: string,
    entityId: string | null = null,
  ) {
    this.issues.push({ severity, entityId, dndsuId: this.pageId, field, message });
  }

  normalize(): NormalizedRace[] {
    const { page } = this;
    if (!this.pageSource) {
      this.issue('error', 'source', `Книга страницы не известна: «${page.sourceTitle ?? 'нет'}»`);
      return [];
    }
    if (!page.nameEn) {
      this.issue('error', 'nameEn', `В заголовке «${page.nameRu}» нет английского названия`);
      return [];
    }
    if (page.blocks.length === 0) {
      this.issue('error', 'features', 'На странице не найдены особенности расы');
      return [];
    }
    return page.blocks[0]?.layout === 'tab' ? this.fromTabs() : this.fromSections();
  }

  private baseId(): string {
    return `race:${slugFromName(this.page.nameEn ?? '')}`;
  }

  private bookOf(block: RawRaceBlock, first: boolean): NormalizedSource | null {
    if (block.sourceTitle) {
      const source = this.sources.fromTitle(block.sourceTitle);
      if (!source) {
        this.issue(
          'warning',
          'source',
          `«${block.heading}»: книга не известна — «${block.sourceTitle}»`,
        );
      }
      return source;
    }
    const mark = block.mark ?? (!first && block.layout === 'h3' ? block.parent?.mark : null);
    return mark ? this.sources.fromMark(mark) : this.pageSource;
  }

  private race(
    nameRu: string,
    nameEn: string,
    source: NormalizedSource,
    intro: RaceData['intro'],
    features: RawFeature[],
    variantOf: string | null,
    reviewedKey: string | null,
    rules = parseRaceRules(features),
  ): NormalizedRace {
    const id = variantOf || reviewedKey ? `race:${slugFromName(nameEn)}` : this.baseId();
    for (const name of rules.failed) {
      this.issue(
        'warning',
        'rules',
        `«${nameRu}», «${name}»: механика не разобрана, только текст`,
        id,
      );
    }
    return {
      id,
      nameRu,
      nameEn,
      source,
      data: {
        schemaVersion: RACE_SCHEMA_VERSION,
        kind: variantOf ? 'variant' : 'race',
        variantOf,
        intro,
        features: features.map((feature) => ({ name: feature.name, blocks: feature.blocks })),
      },
      rules: rules.rules,
      links: variantOf ? [{ toId: variantOf, kind: 'variant_of' }] : [],
      reviewedKey,
    };
  }

  /** Запись names.json для блока; `null` — блок не берётся (пропуск или ошибка уже в отчёте). */
  private reviewedFor(block: RawRaceBlock, source: NormalizedSource | null) {
    const key = raceBlockKey(this.pageId, block.heading, source?.code);
    const entry =
      this.reviewed.blocks.get(key) ??
      this.reviewed.blocks.get(raceBlockKey(this.pageId, block.heading));
    if (!entry) {
      this.issue(
        'error',
        'reviewed',
        `«${block.heading}» (${source?.code ?? '?'}): нет записи в data/reviewed/races/names.json`,
      );
      return null;
    }
    const usedKey = raceBlockKey(entry.page, entry.match, entry.book);
    if (entry.skip) {
      this.issue('skip', 'reviewed', `«${block.heading}»: ${entry.skip}`);
      return { entry, key: usedKey, skipped: true };
    }
    if (!source) return null;
    return { entry, key: usedKey, skipped: false, source };
  }

  private fromSections(): NormalizedRace[] {
    const [first, ...rest] = this.page.blocks;
    if (!first || !this.pageSource) return [];
    const base = this.race(
      this.page.nameRu,
      this.page.nameEn ?? '',
      this.bookOf(first, true) ?? this.pageSource,
      [...this.page.intro, ...first.lead],
      first.features,
      null,
      null,
    );
    const out = [base];
    for (const block of rest) {
      const found = this.reviewedFor(block, this.bookOf(block, false));
      if (!found || found.skipped || !found.source || !found.entry.nameEn) continue;
      const variant = found.entry.kind === 'variant';
      // Та же раса из другой книги называется как раса страницы: книгу показывает источник.
      const nameRu = found.entry.nameRu ?? (variant ? block.heading : this.page.nameRu);
      out.push(
        this.race(
          nameRu,
          found.entry.nameEn,
          found.source,
          block.lead,
          block.features,
          variant ? base.id : null,
          found.key,
        ),
      );
    }
    return out;
  }

  private fromTabs(): NormalizedRace[] {
    const tabs = this.page.blocks.filter((block) => block.layout === 'tab');
    const own = tabs.filter((tab) => !tab.sourceTitle);
    const [firstOwn] = own;
    if (!firstOwn || !this.pageSource) return [];
    const common = firstOwn.features.filter((feature) =>
      own.every((tab) => tab.features.some((other) => sameFeature(feature, other))),
    );
    const parsedTabs = own.map((tab) => parseRaceRules(tab.features).rules.abilityScores);
    const commonFixed = commonAbilities(parsedTabs);
    const baseRules = parseRaceRules(common);
    baseRules.rules.abilityScores = commonFixed ? [{ fixed: commonFixed, choices: [] }] : null;
    const base = this.race(
      this.page.nameRu,
      this.page.nameEn ?? '',
      this.pageSource,
      this.page.intro,
      common,
      null,
      null,
      baseRules,
    );

    const out = [base];
    for (const tab of tabs) {
      const found = this.reviewedFor(tab, this.bookOf(tab, false));
      if (!found || found.skipped || !found.source || !found.entry.nameEn) continue;
      const features = tab.features.filter(
        (feature) => !common.some((other) => sameFeature(feature, other)),
      );
      const parsed = parseRaceRules(features);
      const full = parseRaceRules(tab.features).rules.abilityScores;
      parsed.rules.abilityScores = subtractAbilities(full, commonFixed ?? []);
      // Особенность вкладки с тем же названием, но своим текстом («Языки» дуэргара)
      // повторяет расовое: в разновидности остаётся только новое.
      const { rules } = parsed;
      const without = <T>(list: T[], known: T[]) => list.filter((value) => !known.includes(value));
      rules.languages.fixed = without(rules.languages.fixed, baseRules.rules.languages.fixed);
      rules.skills.fixed = without(rules.skills.fixed, baseRules.rules.skills.fixed);
      rules.weapons = without(rules.weapons, baseRules.rules.weapons);
      rules.armor = without(rules.armor, baseRules.rules.armor);
      rules.resistances = without(rules.resistances, baseRules.rules.resistances);
      out.push(
        this.race(
          found.entry.nameRu ?? `${tab.heading} ${this.page.nameRu.toLowerCase()}`,
          found.entry.nameEn,
          found.source,
          tab.lead,
          features,
          base.id,
          found.key,
          parsed,
        ),
      );
    }
    return out;
  }
}
