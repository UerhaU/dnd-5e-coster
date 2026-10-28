import {
  ITEM_SCHEMA_VERSION,
  materialLeaves,
  slugFromName,
  type ItemData,
  type MaterialItem,
} from '@koster/shared';
import { baseName } from '../items/describe.ts';
import type { ImportIssue } from '../report/issues.ts';
import { nameKey, type ReviewedItems } from '../reviewed/reviewed-items.ts';
import type { NormalizedSource } from '../spells/normalize-spell.ts';
import type { CatalogEntity } from './catalog-entity.ts';

// Связи заклинаний с предметами (долг этапа 1, Р60): лист состава материального
// компонента (data/reviewed/spells) получает `itemId`, заклинание — связь
// `material_component`. Чего нет в таблицах снаряжения, заводится предметом вида
// «компонент заклинания» по data/reviewed/items/spell-components.json — без страницы
// DnD.su, с книгами заклинаний, которые его требуют.

type SpellEntity = Extract<CatalogEntity, { category: 'spell' }>;
type ItemEntity = Extract<CatalogEntity, { category: 'item' }>;

export interface MaterialLinkStats {
  /** Листьев состава у всех заклинаний. */
  leaves: number;
  /** Из них связаны со снаряжением DnD.su. */
  toEquipment: number;
  /** Связаны с «компонентом заклинания». */
  toComponents: number;
  /** Не предмет («любое рукопашное оружие», монеты) — без связи. */
  notItems: number;
  /** Новых предметов «компонент заклинания». */
  components: number;
  /** Заклинаний хотя бы с одной связью `material_component`. */
  linkedSpells: number;
}

function componentData(): ItemData {
  return {
    schemaVersion: ITEM_SCHEMA_VERSION,
    kind: 'spell_component',
    category: null,
    cost: { text: null, cp: null },
    weight: { text: null, lb: null },
    quantity: 1,
    optionalRule: false,
    firearm: null,
    stats: [],
    contents: [],
    description: [
      {
        type: 'paragraph',
        text: 'Материальный компонент заклинаний. В таблицах снаряжения DnD.su его нет: предмет заведён по составу компонентов проверенных заклинаний (Р60). Цена и вес не указаны.',
      },
    ],
  };
}

export function linkSpellMaterials(
  spells: SpellEntity[],
  items: ItemEntity[],
  reviewed: ReviewedItems,
  issues: ImportIssue[],
  /** `full` — полный каталог: нет предмета — ошибка; в тестовом — предупреждение (его там может не быть). */
  options: { full: boolean },
): { components: ItemEntity[]; stats: MaterialLinkStats } {
  const stats: MaterialLinkStats = {
    leaves: 0,
    toEquipment: 0,
    toComponents: 0,
    notItems: 0,
    components: 0,
    linkedSpells: 0,
  };
  const equipment = new Map(items.map((item) => [item.id, item]));
  // «Соль (1 фунт)», «Масло (фляга)» — по названию без уточнения в скобках.
  const equipmentByName = new Map(items.map((item) => [nameKey(baseName(item.nameRu)), item.id]));
  const components = new Map<string, ItemEntity>();
  const usedKeys = new Set<string>();

  const missing: ImportIssue['severity'] = options.full ? 'error' : 'warning';
  const issue = (spell: SpellEntity, severity: ImportIssue['severity'], message: string) =>
    issues.push({
      severity,
      entityId: spell.id,
      dndsuId: spell.sources[0]?.dndsuId ?? null,
      field: 'materials',
      message,
    });

  /** ID предмета для листа; `null` — не предмет или ошибка (уже в отчёте). */
  const resolve = (spell: SpellEntity, leaf: MaterialItem): string | null => {
    const key = nameKey(leaf.name);
    const entry = reviewed.components.get(key);
    if (entry) usedKeys.add(key);
    if (!entry) {
      const id = equipmentByName.get(key);
      if (!id) {
        issue(spell, missing, `«${leaf.name}»: нет предмета и записи в spell-components.json`);
      }
      return id ?? null;
    }
    if ('skip' in entry) return null;
    if ('itemId' in entry) {
      // Ссылка на компонент из этого же файла проверяется после обхода всех заклинаний.
      return entry.itemId;
    }
    const id = `item:${slugFromName(entry.nameEn)}`;
    if (equipment.has(id)) {
      issue(spell, 'error', `«${leaf.name}»: ID ${id} уже у снаряжения — задайте itemId`);
      return null;
    }
    if (!components.has(id)) {
      components.set(id, {
        id,
        category: 'item',
        nameRu: entry.match,
        nameEn: entry.nameEn,
        aliases: [],
        edition: '5e_2014',
        reviewStatus: 'parsed',
        automation: 'display_only',
        schemaVersion: ITEM_SCHEMA_VERSION,
        data: componentData(),
        rules: null,
        sources: [],
        links: [],
        searchBody: '',
      });
    }
    return id;
  };

  const users = new Map<string, SpellEntity[]>();
  for (const spell of spells) {
    const recipe = spell.data.components.material?.recipe;
    if (!recipe) continue;
    for (const leaf of materialLeaves(recipe)) {
      stats.leaves += 1;
      const id = resolve(spell, leaf);
      if (!id) {
        const entry = reviewed.components.get(nameKey(leaf.name));
        if (entry && 'skip' in entry) stats.notItems += 1;
        continue;
      }
      leaf.itemId = id;
      users.set(id, [...(users.get(id) ?? []), spell]);
      if (!spell.links.some((link) => link.toId === id && link.kind === 'material_component')) {
        spell.links.push({ toId: id, kind: 'material_component' });
      }
    }
  }

  for (const [id, spellsOfItem] of users) {
    const component = components.get(id);
    if (!component) {
      if (equipment.has(id)) {
        stats.toEquipment += spellsOfItem.length;
        continue;
      }
      for (const spell of spellsOfItem) {
        issue(spell, missing, `spell-components.json: предмета ${id} нет в каталоге`);
        spell.links = spell.links.filter((link) => link.toId !== id);
        const recipe = spell.data.components.material?.recipe;
        for (const leaf of recipe ? materialLeaves(recipe) : []) {
          if (leaf.itemId === id) delete leaf.itemId;
        }
      }
      continue;
    }
    stats.toComponents += spellsOfItem.length;
    // Книги — те же, что у заклинаний: по ним работает фильтр источников кампании.
    const books = new Map<string, NormalizedSource>();
    for (const spell of spellsOfItem) {
      for (const { source } of spell.sources) books.set(source.id, source);
    }
    component.sources = [...books.values()].map((source) => ({ source, dndsuId: null, url: null }));
    const names = [...new Set(spellsOfItem.map((spell) => spell.nameRu))].sort();
    component.searchBody = `Компонент заклинаний: ${names.join(', ')}`;
  }
  stats.components = components.size;
  stats.linkedSpells = spells.filter((spell) =>
    spell.links.some((link) => link.kind === 'material_component'),
  ).length;

  if (options.full) {
    for (const [key, entry] of reviewed.components) {
      if (usedKeys.has(key)) continue;
      issues.push({
        severity: 'warning',
        entityId: null,
        dndsuId: null,
        field: 'reviewed',
        message: `spell-components.json: «${entry.match}» нет в составах заклинаний`,
      });
    }
  }

  return { components: [...components.values()], stats };
}
