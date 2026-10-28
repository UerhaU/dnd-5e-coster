import { catalogSchema, type CatalogConnection } from '@koster/db';
import type { CatalogEntity } from './catalog-entity.ts';

// Поля для фильтров списка (раздел 5.2): у каждой категории своя таблица.

const { itemIndex, itemIndexProperties, raceIndex, spellIndex, spellIndexClasses } = catalogSchema;

type Transaction = Parameters<Parameters<CatalogConnection['db']['transaction']>[0]>[0];
type SpellEntity = Extract<CatalogEntity, { category: 'spell' }>;
type ItemEntity = Extract<CatalogEntity, { category: 'item' }>;
type RaceEntity = Extract<CatalogEntity, { category: 'race' }>;

export function writeSpellIndex(tx: Transaction, entity: SpellEntity): void {
  tx.insert(spellIndex)
    .values({
      entityId: entity.id,
      level: entity.data.level,
      schoolId: entity.data.school,
      ritual: entity.data.ritual,
      concentration: entity.data.concentration,
    })
    .run();
  // Один класс — одна строка: обычный список важнее TCE, TCE важнее подкласса.
  const access = new Map<string, 'standard' | 'optional' | 'subclass'>();
  for (const classId of entity.data.classes) access.set(classId, 'standard');
  for (const classId of entity.data.optionalClasses) {
    if (!access.has(classId)) access.set(classId, 'optional');
  }
  for (const { classId } of entity.data.subclasses) {
    if (!access.has(classId)) access.set(classId, 'subclass');
  }
  for (const [classId, kind] of access) {
    tx.insert(spellIndexClasses).values({ entityId: entity.id, classId, access: kind }).run();
  }
}

export function writeItemIndex(tx: Transaction, entity: ItemEntity): void {
  const weapon = entity.rules?.weapon ?? null;
  tx.insert(itemIndex)
    .values({
      entityId: entity.id,
      kindId: entity.data.kind,
      categoryId: entity.data.category,
      costCp: entity.data.cost.cp,
      weightLb: entity.data.weight.lb,
      optionalRule: entity.data.optionalRule,
      damageTypeId: weapon?.damage?.type ?? null,
    })
    .run();
  for (const propertyId of new Set(weapon?.properties.map((property) => property.id) ?? [])) {
    tx.insert(itemIndexProperties).values({ entityId: entity.id, propertyId }).run();
  }
}

export function writeRaceIndex(tx: Transaction, entity: RaceEntity): void {
  const { speed } = entity.rules;
  tx.insert(raceIndex)
    .values({
      entityId: entity.id,
      kind: entity.data.kind,
      variantOf: entity.data.variantOf,
      sizeId: entity.rules.size?.[0] ?? null,
      speedWalkFt: speed.walk,
      flying: speed.fly !== null,
      darkvisionFt: entity.rules.darkvisionFt,
    })
    .run();
}
