import {
  ITEM_CATEGORIES,
  ITEM_RULES_SCHEMA_VERSION,
  ITEM_SCHEMA_VERSION,
  slugFromName,
  type EquipTime,
  type ItemCategoryId,
  type ItemData,
  type ItemKindId,
  type ItemRules,
  type TextBlock,
} from '@koster/shared';
import type { ImportIssue } from '../report/issues.ts';
import { nameKey, type ReviewedItems } from '../reviewed/reviewed-items.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import { ArticleDescriptions, baseName } from './describe.ts';
import type { RawArticle, RawRow, RawTable } from './parse-article.ts';
import {
  isDash,
  parseArmorClass,
  parseCostCp,
  parseDamage,
  parseEquipTime,
  parseStrength,
  parseWeaponProperties,
  parseWeightLb,
} from './parse-values.ts';
import type { ItemSources } from './sources.ts';

// Шаг normalize (раздел 6) для снаряжения: строки таблиц статьи → объекты item/v1
// и механика item-rules/v1. Строка без английского названия в data/reviewed/items/
// в каталог не попадает (ID строится по нему, Р11) и уходит в отчёт ошибкой.

export interface NormalizedItem {
  id: string;
  nameRu: string;
  nameEn: string;
  data: ItemData;
  rules: ItemRules | null;
  source: NormalizedSource;
  /** Связи: `contains` (состав набора), `uses_ammunition`. Цели проверяет сборка. */
  links: { toId: string; kind: 'contains' | 'uses_ammunition' }[];
}

type Era = NonNullable<ItemData['firearm']>;

/** Что означает строка-группа таблицы. */
interface GroupMeaning {
  kind?: ItemKindId;
  category?: ItemCategoryId;
  era?: Era;
}

const GROUP_MEANINGS = new Map<string, GroupMeaning>([
  ...ITEM_CATEGORIES.map((entry): [string, GroupMeaning] => [
    nameKey(entry.nameRu),
    { category: entry.id },
  ]),
  [nameKey('Музыкальные инструменты'), { category: 'musical_instrument' }],
  [nameKey('Боеприпасы'), { kind: 'ammunition' }],
  [nameKey('Щит'), { kind: 'shield' }],
  [nameKey('эпоха Возрождения'), { era: 'renaissance' }],
  [nameKey('Современное'), { era: 'modern' }],
  [nameKey('Футуристическое'), { era: 'futuristic' }],
]);

const ARMOR_CATEGORY = {
  light_armor: 'light',
  medium_armor: 'medium',
  heavy_armor: 'heavy',
} as const;

const WEAPON_CATEGORY = {
  simple_melee: ['simple', 'melee'],
  simple_ranged: ['simple', 'ranged'],
  martial_melee: ['martial', 'melee'],
  martial_ranged: ['martial', 'ranged'],
} as const;

type TableKind = 'armor' | 'weapon' | 'gear' | 'tool' | 'explosive' | 'equip_time' | 'trade';

function tableKind(table: RawTable): TableKind | null {
  const header = table.header.map(nameKey);
  const heading = nameKey(table.heading ?? '');
  if (header.some((label) => label.startsWith('класс доспеха'))) return 'armor';
  if (header.includes('урон')) return 'weapon';
  if (header.includes('надевание')) return 'equip_time';
  if (header.includes('товар')) return 'trade';
  if (header.length === 3 && header[2] === 'вес') {
    if (heading.startsWith('инструмент')) return 'tool';
    if (heading.startsWith('взрывчат')) return 'explosive';
    return 'gear';
  }
  return null;
}

const DEFAULT_KIND: Record<'armor' | 'weapon' | 'gear' | 'tool' | 'explosive', ItemKindId> = {
  armor: 'armor',
  weapon: 'weapon',
  gear: 'adventuring_gear',
  tool: 'tool',
  explosive: 'explosive',
};

export class ItemNormalizer {
  private readonly descriptions: ArticleDescriptions;
  private readonly pageSource: NormalizedSource | null;
  private readonly equipTimes = new Map<string, { don: EquipTime; doff: EquipTime }>();
  private readonly issues: ImportIssue[];
  private readonly articleId: number;
  private readonly article: RawArticle;
  private readonly reviewed: ReviewedItems;
  private readonly sources: ItemSources;

  // Без свойств в параметрах конструктора: Node запускает .ts без tsx (Р48).
  constructor(
    article: RawArticle,
    articleId: number,
    reviewed: ReviewedItems,
    sources: ItemSources,
    issues: ImportIssue[],
  ) {
    this.article = article;
    this.articleId = articleId;
    this.reviewed = reviewed;
    this.sources = sources;
    this.issues = issues;
    this.descriptions = new ArticleDescriptions(article);
    this.pageSource = article.sourceTitle ? sources.fromTitle(article.sourceTitle) : null;
    if (!this.pageSource) {
      this.issue(null, 'sources', `Книга статьи не распознана: «${article.sourceTitle ?? '—'}»`);
    }
  }

  private issue(
    entityId: string | null,
    field: string,
    message: string,
    severity: ImportIssue['severity'] = 'warning',
  ) {
    this.issues.push({ severity, entityId, dndsuId: this.articleId, field, message });
  }

  normalize(): NormalizedItem[] {
    const items: NormalizedItem[] = [];
    const tables = this.article.tables.map((table) => ({ table, kind: tableKind(table) }));
    for (const { table } of tables.filter((entry) => entry.kind === 'equip_time')) {
      this.readEquipTimes(table);
    }
    for (const { table, kind } of tables) {
      if (kind === 'trade') {
        items.push(...this.tradeGoods(table));
      } else if (kind && kind !== 'equip_time') {
        for (const row of table.rows) {
          const item = this.row(row, table, kind);
          if (item) items.push(item);
        }
      }
    }
    items.push(...this.packs());
    for (const { term, source } of this.descriptions.unused()) {
      this.issue(
        null,
        'description',
        `Описание «${term}»${source ? ` (${source})` : ''} без строки в таблицах: предмет не создан`,
        'skip',
      );
    }
    return items;
  }

  private readEquipTimes(table: RawTable) {
    for (const row of table.rows) {
      const don = parseEquipTime(row.cells[0] ?? '');
      const doff = parseEquipTime(row.cells[1] ?? '');
      if (don && doff) {
        this.equipTimes.set(nameKey(row.name), { don, doff });
      } else {
        this.issue(null, 'equipTime', `Время надевания не разобрано: «${row.name}»`);
      }
    }
  }

  private cell(row: RawRow, table: RawTable, ...labels: string[]): string | null {
    const index = table.header.findIndex((label) => labels.includes(nameKey(label)));
    return index > 0 ? (row.cells[index - 1] ?? null) : null;
  }

  private row(row: RawRow, table: RawTable, kind: Exclude<TableKind, 'equip_time' | 'trade'>) {
    // «Зелье лечения [Potion of Healing]»: английское название в скобках убирается.
    const withoutEnglish = row.name.replace(/\s*\[[^\]]+\]\s*$/, '');
    const quantityMatch = /^(.*?)\s*\((\d+)\)$/.exec(withoutEnglish);
    const nameRu = quantityMatch?.[1] ?? withoutEnglish;
    const quantity = quantityMatch ? Number(quantityMatch[2]) : 1;

    const review = this.reviewed.names.get(nameKey(nameRu));
    if (!review) {
      this.issue(
        null,
        'name',
        `«${nameRu}»: нет английского названия в data/reviewed/items/names.json`,
        'error',
      );
      return null;
    }
    const id = `item:${slugFromName(review.nameEn)}`;

    const meaning: GroupMeaning = {};
    for (const label of row.groups) {
      const known = GROUP_MEANINGS.get(nameKey(label));
      if (known?.era) meaning.era = known.era;
    }
    const lastGroup = row.groups.at(-1);
    if (row.inGroup && lastGroup) {
      const known = GROUP_MEANINGS.get(nameKey(lastGroup));
      if (!known) {
        this.issue(id, 'group', `Неизвестная группа таблицы «${lastGroup}»`);
      }
      if (known?.kind) meaning.kind = known.kind;
      if (known?.category) meaning.category = known.category;
    }
    const itemKind = meaning.kind ?? DEFAULT_KIND[kind];
    const category = review.category ?? meaning.category ?? null;
    const source = row.source ? this.sources.fromMark(row.source) : this.pageSource;
    if (!source) {
      return null;
    }

    const costText = this.cell(row, table, 'стоимость', 'цена');
    const weightText = this.cell(row, table, 'вес');
    const cost = this.cost(id, costText);
    const weight = this.weight(id, weightText);

    const candidates = [
      nameRu,
      baseName(nameRu),
      `${nameRu} доспех`,
      ...(review.descriptionTerms ?? []),
    ];
    const categoryName = ITEM_CATEGORIES.find((entry) => entry.id === category)?.nameRu;
    // Общее описание группы: «Магическая фокусировка», «Музыкальные инструменты».
    // У оружия и доспехов группа — целый раздел правил, а не описание предмета.
    if (itemKind !== 'weapon' && itemKind !== 'armor') {
      if (categoryName) candidates.push(categoryName);
      if (row.inGroup && lastGroup) candidates.push(lastGroup);
    }

    const data: ItemData = {
      schemaVersion: ITEM_SCHEMA_VERSION,
      kind: itemKind,
      category,
      cost,
      weight,
      quantity,
      // Дополнительное оружие из приключений и всё огнестрельное DMG — вариант правил.
      optionalRule: meaning.era !== undefined || (itemKind === 'weapon' && row.source !== null),
      firearm: meaning.era ?? null,
      stats: table.header
        .slice(1)
        .map((label, index) => ({ label, value: row.cells[index] ?? '' }))
        .filter((stat) => stat.label && stat.value),
      contents: [],
      description: this.descriptions.find(candidates),
    };

    const rules = this.rules(id, data, row, table, review.ammunition ?? null);
    const links: NormalizedItem['links'] = [];
    if (rules?.weapon?.ammunitionItemId) {
      links.push({ toId: rules.weapon.ammunitionItemId, kind: 'uses_ammunition' });
    }
    return { id, nameRu, nameEn: review.nameEn, data, rules, source, links };
  }

  private cost(id: string, text: string | null): ItemData['cost'] {
    if (text === null || isDash(text)) {
      return { text, cp: null };
    }
    const cp = parseCostCp(text);
    if (cp === null) this.issue(id, 'cost', `Цена не разобрана: «${text}»`);
    return { text, cp };
  }

  private weight(id: string, text: string | null): ItemData['weight'] {
    if (text === null || isDash(text)) {
      return { text, lb: null };
    }
    const lb = parseWeightLb(text);
    if (lb === null) this.issue(id, 'weight', `Вес не разобран: «${text}»`);
    return { text, lb };
  }

  private rules(
    id: string,
    data: ItemData,
    row: RawRow,
    table: RawTable,
    ammunition: string | null,
  ): ItemRules | null {
    const fail = (message: string) => {
      this.issue(id, 'rules', `${message}: механика не записана`);
      return null;
    };
    const base = {
      schemaVersion: ITEM_RULES_SCHEMA_VERSION as typeof ITEM_RULES_SCHEMA_VERSION,
      weapon: null,
      armor: null,
      shield: null,
    };

    if (data.kind === 'weapon') {
      const kind =
        data.category && data.category in WEAPON_CATEGORY
          ? WEAPON_CATEGORY[data.category as keyof typeof WEAPON_CATEGORY]
          : null;
      if (!kind) return fail('Вид оружия не известен');
      const damageText = this.cell(row, table, 'урон') ?? '';
      const damage = isDash(damageText) ? null : parseDamage(damageText);
      if (!isDash(damageText) && !damage) return fail(`Урон не разобран: «${damageText}»`);
      const propertiesText = this.cell(row, table, 'свойства') ?? '';
      const properties = parseWeaponProperties(propertiesText);
      if (!properties) return fail(`Свойства не разобраны: «${propertiesText}»`);
      const usesAmmunition = properties.some((property) => property.id === 'ammunition');
      if (usesAmmunition && !ammunition) {
        this.issue(id, 'ammunition', 'Свойство «боеприпас», но боеприпас не задан в names.json');
      }
      return {
        ...base,
        weapon: {
          category: kind[0],
          range: kind[1],
          damage,
          properties,
          ammunitionItemId: usesAmmunition ? ammunition : null,
        },
      };
    }

    if (data.kind === 'armor' || data.kind === 'shield') {
      const acText = this.cell(row, table, 'класс доспеха (кд)') ?? '';
      const armorClass = parseArmorClass(acText);
      if (!armorClass) return fail(`КД не разобран: «${acText}»`);
      const timesKey =
        data.kind === 'shield'
          ? 'щит'
          : nameKey(ITEM_CATEGORIES.find((entry) => entry.id === data.category)?.nameRu ?? '');
      const times = this.equipTimes.get(timesKey);
      if (!times) return fail('Нет времени надевания и снятия');
      if (data.kind === 'shield') {
        return { ...base, shield: { armorClassBonus: armorClass.base, ...times } };
      }
      const category =
        data.category && data.category in ARMOR_CATEGORY
          ? ARMOR_CATEGORY[data.category as keyof typeof ARMOR_CATEGORY]
          : null;
      if (!category) return fail('Вид доспеха не известен');
      const strengthText = this.cell(row, table, 'сила') ?? '';
      const strengthRequired = parseStrength(strengthText);
      if (strengthRequired === undefined)
        return fail(`Требование Силы не разобрано: «${strengthText}»`);
      const stealthText = nameKey(this.cell(row, table, 'скрытность') ?? '');
      if (stealthText !== 'помеха' && !isDash(stealthText)) {
        return fail(`Скрытность не разобрана: «${stealthText}»`);
      }
      return {
        ...base,
        armor: {
          category,
          armorClass,
          strengthRequired,
          stealthDisadvantage: stealthText === 'помеха',
          ...times,
        },
      };
    }
    return null;
  }

  private tradeGoods(table: RawTable): NormalizedItem[] {
    const items: NormalizedItem[] = [];
    for (const row of table.rows) {
      const costText = row.name;
      const goodsText = row.cells[0] ?? '';
      let unit = '1 фунт';
      for (const part of goodsText.split(/\s+или\s+/)) {
        // «1 фунт корицы или перца»: у «перца» единица из предыдущей части.
        const own = /^(1|один)\s+(фунт|кв\.м)\s+/.exec(part);
        if (own) unit = `${own[1]} ${own[2]}`;
        const fragment = /^(1|один)\s/.test(part) ? part : `${unit} ${part}`;
        const review = this.reviewed.tradeGoods.get(nameKey(fragment));
        if (!review) {
          this.issue(null, 'name', `Товар «${fragment}»: нет названия в names.json`, 'error');
          continue;
        }
        if (!this.pageSource) continue;
        const id = `item:${slugFromName(review.nameEn)}`;
        items.push({
          id,
          nameRu: review.nameRu,
          nameEn: review.nameEn,
          source: this.pageSource,
          links: [],
          rules: null,
          data: {
            schemaVersion: ITEM_SCHEMA_VERSION,
            kind: 'trade_good',
            category: null,
            cost: this.cost(id, costText),
            weight: { text: null, lb: null },
            quantity: 1,
            optionalRule: false,
            firearm: null,
            stats: [{ label: table.header[1] ?? 'Товар', value: goodsText }],
            contents: [],
            description: [],
          },
        });
      }
    }
    return items;
  }

  private packs(): NormalizedItem[] {
    const items: NormalizedItem[] = [];
    for (const term of this.article.terms) {
      const match = /^(Набор .+?)\s*\(([^)]*\d[^)]*)\)$/.exec(term.term);
      if (!match || nameKey(term.section ?? '') !== nameKey('Наборы снаряжения')) {
        continue;
      }
      const nameRu = match[1] ?? term.term;
      const review = this.reviewed.packs.get(nameKey(nameRu));
      if (!review) {
        this.issue(
          null,
          'name',
          `«${nameRu}»: нет состава в data/reviewed/items/packs.json`,
          'error',
        );
        continue;
      }
      const source = term.source ? this.sources.fromMark(term.source) : this.pageSource;
      if (!source) continue;
      const id = `item:${slugFromName(review.nameEn)}`;
      const contents = review.contents.map((entry) => ({
        itemId: entry.item,
        name: entry.name,
        quantity: entry.quantity,
        note: entry.note ?? null,
      }));
      const description: TextBlock[] = term.blocks;
      items.push({
        id,
        nameRu,
        nameEn: review.nameEn,
        source,
        rules: null,
        links: contents
          .filter((entry) => entry.itemId !== null)
          .map((entry) => ({ toId: entry.itemId as string, kind: 'contains' as const })),
        data: {
          schemaVersion: ITEM_SCHEMA_VERSION,
          kind: 'pack',
          category: null,
          cost: this.cost(id, match[2] ?? null),
          weight: { text: null, lb: null },
          quantity: 1,
          optionalRule: false,
          firearm: null,
          stats: [],
          contents,
          description,
        },
      });
    }
    return items;
  }
}
