import {
  DAMAGE_TYPES,
  SPELL_SCHEMA_VERSION,
  slugFromName,
  type ClassId,
  type DamageTypeId,
  type Edition,
  type SpellData,
} from '@koster/shared';
import { flattenFilter, type SpellCard, type SpellList } from '../dndsu/spell-cache.ts';
import type { ImportIssue } from '../report/issues.ts';
import {
  classIdByName,
  parseCastingTime,
  parseComponents,
  parseDuration,
  parseLevelLine,
  parseRange,
  parseSubclassList,
} from './parse-fields.ts';
import type { RawSpellPage } from './parse-page.ts';

// Шаг normalize (раздел 6): сырые поля страницы + карточка списка → data_json spell/v1.

export interface NormalizedSource {
  /** Код в нижнем регистре: `ph14`. */
  id: string;
  code: string;
  nameEn: string;
  dndsuSourceId: number | null;
  edition: Edition | '5e_2024';
}

export interface NormalizedSpell {
  id: string;
  nameRu: string;
  nameEn: string;
  edition: Edition;
  dndsuId: number;
  url: string;
  sources: NormalizedSource[];
  data: SpellData;
}

/** Метка книги только для 5.5 (PH24 и т.п.): по Р12 такие записи не переносятся. */
function sourceEdition(code: string, title: string): NormalizedSource['edition'] {
  return /2024/.test(title) || /24$/.test(code) ? '5e_2024' : '5e_2014';
}

function sameText(a: string, b: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replaceAll('ё', 'е').trim();
  return normalize(a) === normalize(b);
}

export class SpellNormalizer {
  private readonly classIds: Map<number, string>;
  private readonly archetypes: ReturnType<typeof flattenFilter>;
  private readonly sourceIds: ReturnType<typeof flattenFilter>;
  private readonly damageTypes: Map<number, DamageTypeId | null>;

  constructor(list: SpellList) {
    this.classIds = new Map(flattenFilter(list.maps.class).map((e) => [e.value, e.title]));
    this.archetypes = flattenFilter(list.maps.archetype);
    this.sourceIds = flattenFilter(list.maps.source);
    this.damageTypes = new Map(
      flattenFilter(list.maps.damtype).map((entry) => [
        entry.value,
        DAMAGE_TYPES.find((type) => sameText(type.nameRu, entry.title))?.id ?? null,
      ]),
    );
  }

  normalize(page: RawSpellPage, card: SpellCard, issues: ImportIssue[]): NormalizedSpell | null {
    const id = `spell:${slugFromName(page.nameEn)}`;
    const issue = (field: string, message: string, severity: ImportIssue['severity'] = 'warning') =>
      issues.push({ severity, entityId: id, dndsuId: card.siteId, field, message });

    const levelLine = parseLevelLine(page.levelLine);
    if (!levelLine) {
      issue('level', `Не разобрана строка уровня: «${page.levelLine}»`, 'error');
      return null;
    }
    if (!page.castingTime || !page.range || !page.components || !page.duration) {
      issue('params', 'На странице нет времени, дистанции, компонентов или длительности', 'error');
      return null;
    }
    const components = parseComponents(page.components);
    if (!components) {
      issue('components', `Не разобраны компоненты: «${page.components}»`, 'error');
      return null;
    }
    if (page.description.length === 0) {
      issue('description', 'Пустое описание', 'error');
      return null;
    }

    const castingTime = parseCastingTime(page.castingTime);
    if (!castingTime.options) {
      issue('castingTime', `Не разобрано время накладывания: «${page.castingTime}»`);
    }
    const range = parseRange(page.range);
    if (!range.kind) {
      issue('range', `Не разобран вид дистанции: «${page.range}»`);
    }
    const { duration, concentration } = parseDuration(page.duration);
    if (!duration.options) {
      issue('duration', `Не разобрана длительность: «${page.duration}»`);
    }

    const sources = this.sources(page, issue);
    const editions = new Set(sources.map((source) => source.edition));
    if (!editions.has('5e_2014')) {
      issue('edition', 'Только источники 5.5 (2024): по Р12 не переносится', 'skip');
      return null;
    }

    const data: SpellData = {
      schemaVersion: SPELL_SCHEMA_VERSION,
      level: levelLine.level,
      school: levelLine.school,
      tags: levelLine.tags,
      ritual: levelLine.ritual,
      concentration,
      castingTime,
      range,
      components,
      duration,
      ...this.classes(page, issue),
      subclasses: this.subclasses(page, issue),
      damageTypes: this.damageTypesOf(card, issue),
      targets: null,
      description: page.description,
      higherLevels: page.higherLevels,
    };
    this.crossCheck(data, card, issue);

    return {
      id,
      nameRu: page.nameRu,
      nameEn: page.nameEn,
      edition: '5e_2014',
      dndsuId: card.siteId,
      url: card.url,
      sources: sources.filter((source) => source.edition === '5e_2014'),
      data,
    };
  }

  private sources(page: RawSpellPage, issue: (field: string, message: string) => void) {
    if (page.sources.length === 0) {
      issue('sources', 'Нет метки источника');
    }
    return page.sources.map((source): NormalizedSource => {
      const entry = this.sourceIds.find((e) => sameText(e.title, source.title));
      if (!entry) {
        issue('sources', `Источник «${source.title}» не найден в фильтре DnD.su`);
      }
      return {
        id: source.code.toLowerCase(),
        code: source.code,
        nameEn: source.title,
        dndsuSourceId: entry?.value ?? null,
        edition: sourceEdition(source.code, source.title),
      };
    });
  }

  private classes(page: RawSpellPage, issue: (field: string, message: string) => void) {
    const classes: ClassId[] = [];
    const optionalClasses: ClassId[] = [];
    for (const entry of page.classes) {
      const classId = classIdByName(entry.name);
      if (!classId) {
        issue('classes', `Неизвестный класс «${entry.name}»`);
        continue;
      }
      (entry.optional ? optionalClasses : classes).push(classId);
    }
    return { classes, optionalClasses };
  }

  private subclasses(page: RawSpellPage, issue: (field: string, message: string) => void) {
    if (!page.subclasses) {
      return [];
    }
    const pairs = parseSubclassList(page.subclasses);
    if (!pairs) {
      issue('subclasses', `Не разобран список подклассов: «${page.subclasses}»`);
      return [];
    }
    return pairs.flatMap((pair) => {
      const classId = classIdByName(pair.className);
      if (!classId) {
        issue('subclasses', `Неизвестный класс подкласса «${pair.className}»`);
        return [];
      }
      const entry = this.archetypes.find(
        (e) => sameText(e.group, pair.className) && sameText(e.title, pair.name),
      );
      if (!entry) {
        issue(
          'subclasses',
          `Подкласс «${pair.name} (${pair.className})» не найден в фильтре DnD.su`,
        );
      }
      return [{ name: pair.name, classId, dndsuId: entry?.value ?? null }];
    });
  }

  private damageTypesOf(card: SpellCard, issue: (field: string, message: string) => void) {
    const types: DamageTypeId[] = [];
    for (const value of card.filter_damtype) {
      const type = this.damageTypes.get(value);
      if (type) {
        types.push(type);
      } else {
        issue('damageTypes', `Неизвестный тип урона с номером ${value}`);
      }
    }
    return types;
  }

  /** Сверка страницы с фильтрами списка: расхождение — предупреждение в отчёте. */
  private crossCheck(
    data: SpellData,
    card: SpellCard,
    issue: (field: string, message: string) => void,
  ) {
    const cardLevel = card.level === 'Заговор' ? 0 : Number(card.level);
    if (cardLevel !== data.level) {
      issue('level', `В списке уровень ${card.level}, на странице ${data.level}`);
    }
    if (card.filter_ritual.includes('2') !== data.ritual) {
      issue('ritual', 'Признак ритуала в списке и на странице расходится');
    }
    if (card.filter_concentration.includes('2') !== data.concentration) {
      issue('concentration', 'Признак концентрации в списке и на странице расходится');
    }
    const toCodes = (ids: number[]) =>
      ids.map((value) => classIdByName(this.classIds.get(value) ?? '') ?? `#${value}`).sort();
    const pageClasses = [...data.classes].sort();
    const listClasses = toCodes(card.filter_class);
    if (pageClasses.join() !== listClasses.join()) {
      issue(
        'classes',
        `Классы в списке: ${listClasses.join(', ')}; на странице: ${pageClasses.join(', ')}`,
      );
    }
    const pageOptional = [...data.optionalClasses].sort();
    const listOptional = toCodes(card.filter_class_tce);
    if (pageOptional.join() !== listOptional.join()) {
      issue(
        'optionalClasses',
        `Классы TCE в списке: ${listOptional.join(', ')}; на странице: ${pageOptional.join(', ')}`,
      );
    }
  }
}
