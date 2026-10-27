import {
  MAGIC_SCHOOLS,
  slugFromName,
  spellDataSchema,
  textBlocksToPlain,
  type SpellData,
} from '@koster/shared';
import { catalogSchema, openCatalogReadOnly } from '@koster/db';
import { CLASS_BY_NAME, classIdByName } from '../spells/parse-fields.ts';

// Сверка catalog.db с каталогом v0.1 (ветка legacy, database/spells/full-catalog.json).

export interface LegacySpell {
  siteId: number;
  name: string;
  originalName: string;
  level: number;
  school: string;
  ritual: boolean;
  concentration: boolean;
  sourceIds: number[];
  classIds: number[];
  optionalClassIds: number[];
  subclassIds: number[];
  componentCodes: string[];
  casting: string;
  range: string;
  duration: string;
  material: string | null;
  description: string;
  higherLevels: string | null;
  royaltyCp?: number | null;
}

export interface LegacyCatalog {
  classes: { id: number; name: string }[];
  subclasses: { id: number; name: string; className: string }[];
  spells: LegacySpell[];
}

export interface FieldDifference {
  dndsuId: number;
  entityId: string | null;
  nameRu: string;
  field: string;
  /** `format` — отличается только пробелами, переносами и разметкой таблиц. */
  kind: 'value' | 'format' | 'missing';
  legacy: string;
  current: string;
}

export interface CompareResult {
  legacyCount: number;
  currentCount: number;
  onlyInLegacy: number[];
  onlyInCurrent: number[];
  differences: FieldDifference[];
}

/** Пробелы схлопнуты, пробел перед знаком препинания убран. */
function spaced(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:!?)»])/g, '$1')
    .trim();
}

/** Только буквы и цифры: для проверки, что текст тот же, а отличается лишь формат. */
function lettersOnly(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

const list = (values: readonly (string | number)[]) => [...values].map(String).sort().join(', ');

export function compareWithLegacy(catalogFile: string, legacy: LegacyCatalog): CompareResult {
  const catalog = openCatalogReadOnly(catalogFile);
  const { contentEntities, contentRevisions, entitySources, sources } = catalogSchema;

  const entities = catalog.db.select().from(contentEntities).all();
  const revisions = new Map(
    catalog.db
      .select()
      .from(contentRevisions)
      .all()
      .map((row) => [row.id, row]),
  );
  const links = catalog.db.select().from(entitySources).all();
  const sourceRows = new Map(
    catalog.db
      .select()
      .from(sources)
      .all()
      .map((row) => [row.id, row]),
  );
  catalog.close();

  const bySiteId = new Map<number, { entity: (typeof entities)[number]; data: SpellData }>();
  for (const entity of entities.filter((row) => !row.withdrawn)) {
    const siteId = links.find((link) => link.entityId === entity.id)?.dndsuId;
    const revision = revisions.get(entity.currentRevisionId);
    if (siteId && revision) {
      bySiteId.set(siteId, {
        entity,
        data: spellDataSchema.parse(JSON.parse(revision.dataJson)),
      });
    }
  }

  const classCode = (id: number) =>
    classIdByName(legacy.classes.find((entry) => entry.id === id)?.name ?? '') ?? `#${id}`;
  const subclassKey = (id: number) => {
    const entry = legacy.subclasses.find((item) => item.id === id);
    return entry
      ? `${entry.name.trim().toLowerCase()} (${entry.className.toLowerCase()})`
      : `#${id}`;
  };

  const result: CompareResult = {
    legacyCount: legacy.spells.length,
    currentCount: bySiteId.size,
    onlyInLegacy: [],
    onlyInCurrent: [...bySiteId.keys()].filter(
      (siteId) => !legacy.spells.some((spell) => spell.siteId === siteId),
    ),
    differences: [],
  };

  for (const spell of legacy.spells) {
    const current = bySiteId.get(spell.siteId);
    if (!current) {
      result.onlyInLegacy.push(spell.siteId);
      continue;
    }
    const { entity, data } = current;
    const push = (
      field: string,
      kind: FieldDifference['kind'],
      legacyValue: string,
      value: string,
    ) =>
      result.differences.push({
        dndsuId: spell.siteId,
        entityId: entity.id,
        nameRu: entity.nameRu,
        field,
        kind,
        legacy: legacyValue,
        current: value,
      });
    const same = (field: string, legacyValue: string, value: string) => {
      if (legacyValue !== value) {
        push(field, 'value', legacyValue, value);
      }
    };
    const sameText = (field: string, legacyValue: string | null, value: string | null) => {
      const a = legacyValue ?? '';
      const b = value ?? '';
      if (spaced(a) === spaced(b)) {
        return;
      }
      push(
        field,
        lettersOnly(a) === lettersOnly(b) ? 'format' : a && !b ? 'missing' : 'value',
        a,
        b,
      );
    };

    same('nameRu', spell.name, entity.nameRu);
    same('nameEn', spell.originalName, entity.nameEn);
    same('id', `spell:${slugFromName(spell.originalName)}`, entity.id);
    same('level', String(spell.level), String(data.level));
    same(
      'school',
      MAGIC_SCHOOLS.find((school) => school.nameRu === spell.school)?.id ?? spell.school,
      data.school,
    );
    same('ritual', String(spell.ritual), String(data.ritual));
    same('concentration', String(spell.concentration), String(data.concentration));

    const currentSources = links
      .filter((link) => link.entityId === entity.id)
      .map((link) => sourceRows.get(link.sourceId)?.dndsuSourceId ?? link.sourceId);
    same('sources', list(spell.sourceIds), list(currentSources));
    same('classes', list(spell.classIds.map(classCode)), list(data.classes));
    same(
      'optionalClasses',
      list(spell.optionalClassIds.map(classCode)),
      list(data.optionalClasses),
    );
    same(
      'subclasses',
      list(spell.subclassIds.map(subclassKey)),
      list(
        data.subclasses.map((subclass) => {
          const className = Object.entries(CLASS_BY_NAME).find(
            ([, classId]) => classId === subclass.classId,
          )?.[0];
          return `${subclass.name.toLowerCase()} (${className ?? subclass.classId})`;
        }),
      ),
    );

    const codes = [
      data.components.verbal ? 'V' : null,
      data.components.somatic ? 'S' : null,
      data.components.material ? 'M' : null,
      data.components.royalty ? 'R' : null,
    ].filter((code) => code !== null);
    same('components', list(spell.componentCodes), list(codes));
    sameText('material', spell.material, data.components.material?.text ?? null);
    same(
      'royaltyCp',
      String(spell.royaltyCp ?? null),
      String(data.components.royalty?.costCp ?? null),
    );

    sameText('castingTime', spell.casting, data.castingTime.text);
    sameText('range', spell.range, data.range.text);
    sameText('duration', spell.duration, data.duration.text);
    sameText('description', spell.description, textBlocksToPlain(data.description));
    sameText('higherLevels', spell.higherLevels, textBlocksToPlain(data.higherLevels) || null);
  }
  return result;
}
