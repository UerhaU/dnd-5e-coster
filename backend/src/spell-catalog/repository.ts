import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { ClassAccess, IllustratedEntry, MaterialGroup, NamedEntry, SpellDetail, SpellEffect, SpellFilters, SpellList, SpellLookups, SpellSummary } from './types.js';
import { formatDuration, formatQuantity } from './format.js';

type Row = Record<string, unknown>;
const text = (value: unknown): string | null => value == null ? null : String(value);
const number = (value: unknown): number | null => value == null ? null : Number(value);
const fold = (value: string) => value.toLocaleLowerCase('ru').replaceAll('ё', 'е');
const componentSymbols: Record<string, string> = { V: 'В', S: 'С', M: 'М' };

export class SpellCatalog {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path, { readOnly: true, enableForeignKeyConstraints: true });
    if (Number(this.database.prepare('PRAGMA user_version').get()?.user_version) !== 102) {
      this.database.close();
      throw new Error('Неверная версия базы каталога заклинаний.');
    }
  }

  close() { this.database.close(); }

  private rows(sql: string, ...parameters: SQLInputValue[]): Row[] {
    return this.database.prepare(sql).all(...parameters);
  }

  private roll(formulaId: unknown): string | null {
    if (formulaId == null) return null;
    const terms = this.rows(`SELECT t.*, d.name_ru AS die_name, a.name_ru AS ability_name FROM roll_terms t
      LEFT JOIN dice d ON d.id=t.die_id LEFT JOIN abilities a ON a.id=t.ability_id WHERE t.formula_id=? ORDER BY t.ordinal`, Number(formulaId));
    if (!terms.length) return text(this.rows('SELECT source_expression FROM roll_formulas WHERE id=?', Number(formulaId))[0]?.source_expression);
    return terms.map((term, index) => {
      let coefficient = Number(term.coefficient);
      let label: string;
      if (term.kind === 'кубики') label = `${Math.abs(coefficient) * Number(term.dice_count)}${term.die_name}`;
      else if (term.kind === 'константа') {
        coefficient *= Number(term.constant_value);
        label = String(Math.abs(coefficient));
      } else {
        const base = term.kind === 'мастерство' ? 'бонус мастерства' : term.use_spellcasting_ability ? 'модификатор заклинателя' : `модификатор (${term.ability_name})`;
        label = Math.abs(coefficient) === 1 ? base : `${Math.abs(coefficient)} × ${base}`;
      }
      return `${index === 0 ? coefficient < 0 ? '-' : '' : coefficient < 0 ? ' - ' : ' + '}${label}`;
    }).join('');
  }

  private summary(row: Row): SpellSummary {
    return {
      id: Number(row.id), name: String(row.name_ru), originalName: text(row.name_original),
      iconUrl: text(row.icon_url), level: Number(row.level),
      school: { id: Number(row.school_id), name: String(row.school_name) },
      ritual: Boolean(row.is_ritual), concentration: Boolean(row.requires_concentration),
      classes: this.rows(`SELECT DISTINCT c.id, c.name_ru AS name FROM classes c
        JOIN spell_classes sc ON sc.class_id=c.id WHERE sc.spell_id=?`, Number(row.id)) as unknown as NamedEntry[],
    };
  }

  list(filters: SpellFilters = {}): SpellList {
    const all = this.rows(`SELECT s.*, m.name_ru AS school_name FROM spells s
      JOIN magic_schools m ON m.id=s.school_id ORDER BY s.level, s.name_ru`);
    const query = fold(filters.q?.trim() ?? '');
    const spells = all.filter((row) => {
      if (query && !fold([row.name_ru, row.name_original, row.aliases].filter(Boolean).join(' ')).includes(query)) return false;
      if (filters.level !== undefined && Number(row.level) !== filters.level) return false;
      if (filters.school !== undefined && Number(row.school_id) !== filters.school) return false;
      if (filters.ritual !== undefined && Boolean(row.is_ritual) !== filters.ritual) return false;
      if (filters.concentration !== undefined && Boolean(row.requires_concentration) !== filters.concentration) return false;
      if (filters.class !== undefined) {
        const accessible = this.rows(`SELECT id FROM spell_classes WHERE spell_id=? AND class_id=?
          UNION ALL SELECT ss.id FROM spell_subclasses ss JOIN subclasses sc ON sc.id=ss.subclass_id
          WHERE ss.spell_id=? AND sc.class_id=?`, Number(row.id), filters.class, Number(row.id), filters.class);
        if (!accessible.length) return false;
      }
      return true;
    }).map((row) => this.summary(row)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'ru'));
    return { spells, total: all.length };
  }

  lookups(): SpellLookups {
    const named = (table: string) => this.rows(`SELECT id, name_ru AS name FROM ${table}`)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru')) as unknown as NamedEntry[];
    const illustrated = (table: string) => this.rows(`SELECT id, name_ru AS name, icon_url AS iconUrl FROM ${table}`)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru')) as unknown as IllustratedEntry[];
    return { schools: named('magic_schools'), classes: named('classes'), damageTypes: illustrated('damage_types'), items: illustrated('items') };
  }

  detail(id: number): SpellDetail | null {
    const row = this.rows(`SELECT s.*, m.name_ru AS school_name, e.name_ru AS edition_name,
      r.code AS range_code, r.name_ru AS range_name, dt.code AS duration_code, dt.name_ru AS duration_name,
      tu.code AS duration_unit_code, tu.name_ru AS duration_unit_name
      FROM spells s JOIN magic_schools m ON m.id=s.school_id JOIN editions e ON e.id=s.edition_id
      JOIN range_types r ON r.id=s.range_type_id JOIN duration_types dt ON dt.id=s.duration_type_id
      LEFT JOIN time_units tu ON tu.id=s.duration_unit_id WHERE s.id=?`, id)[0];
    if (!row) return null;
    const classAccess = this.rows(`SELECT c.id, c.name_ru AS name, b.name_ru AS source, x.access_rule AS rule
      FROM spell_classes x JOIN classes c ON c.id=x.class_id JOIN sources b ON b.id=x.rule_source_id WHERE x.spell_id=?`, id) as unknown as ClassAccess[];
    const subclasses = this.rows(`SELECT sc.id, sc.name_ru AS name, c.name_ru AS className, b.name_ru AS source, x.access_rule AS rule
      FROM spell_subclasses x JOIN subclasses sc ON sc.id=x.subclass_id JOIN classes c ON c.id=sc.class_id
      JOIN sources b ON b.id=x.rule_source_id WHERE x.spell_id=?`, id) as unknown as SpellDetail['subclasses'];
    const materials: MaterialGroup[] = this.rows('SELECT * FROM spell_material_groups WHERE spell_id=? ORDER BY ordinal', id).map((group) => ({
      id: Number(group.id), selection: String(group.selection_mode), minimumValueCp: number(group.minimum_group_value_cp), description: text(group.description),
      requirements: this.rows(`SELECT r.*, i.name_ru AS item_name, i.icon_url AS item_icon, u.name_ru AS unit_name, u.code AS unit_code, c.name_ru AS consumption
        FROM spell_material_requirements r JOIN items i ON i.id=r.item_id LEFT JOIN quantity_units u ON u.id=r.unit_id
        JOIN consumption_modes c ON c.id=r.consumption_mode_id WHERE r.group_id=? ORDER BY r.ordinal`, Number(group.id)).map((material) => ({
        id: Number(material.id),
        item: { id: Number(material.item_id), name: String(material.item_name), iconUrl: text(material.item_icon) },
        quantity: number(material.quantity), unit: text(material.unit_name), minimumValueCp: number(material.minimum_item_value_cp),
        quantityLabel: material.quantity == null ? null : formatQuantity(Number(material.quantity), text(material.unit_code), text(material.unit_name)),
        consumedQuantityLabel: material.consumed_quantity == null ? null : formatQuantity(Number(material.consumed_quantity), text(material.unit_code), text(material.unit_name)),
        consumption: String(material.consumption), consumedQuantity: number(material.consumed_quantity),
        consumptionCondition: text(material.consumption_condition), specialRequirements: text(material.special_requirements),
      })),
    }));
    const effects: SpellEffect[] = this.rows(`SELECT x.*, e.id AS effect_id, e.name_ru AS effect_name, e.description AS effect_description,
      k.name_ru AS kind, e.roll_formula_id AS formula_id, d.id AS damage_id, d.name_ru AS damage_name, d.icon_url AS damage_icon,
      a.name_ru AS save_ability, o.name_ru AS option_name FROM spell_effects x JOIN effects e ON e.id=x.effect_id
      JOIN effect_types k ON k.id=e.effect_type_id
      LEFT JOIN damage_types d ON d.id=e.damage_type_id LEFT JOIN abilities a ON a.id=x.save_ability_id
      LEFT JOIN spell_effect_options o ON o.id=x.option_id WHERE x.spell_id=? ORDER BY x.ordinal`, id).map((effect) => ({
      id: Number(effect.id), name: String(effect.effect_name), kind: String(effect.kind), roll: this.roll(effect.formula_id),
      damageType: effect.damage_id == null ? null : { id: Number(effect.damage_id), name: String(effect.damage_name), iconUrl: text(effect.damage_icon) },
      damageChoices: this.rows(`SELECT d.id, d.name_ru AS name, d.icon_url AS iconUrl FROM effect_damage_choices c
        JOIN damage_types d ON d.id=c.damage_type_id WHERE c.effect_id=?`, Number(effect.effect_id)) as unknown as IllustratedEntry[],
      description: text(effect.effect_description), resolution: String(effect.resolution_type), saveAbility: text(effect.save_ability),
      onSuccess: text(effect.on_success), condition: text(effect.application_condition), target: text(effect.target_description), option: text(effect.option_name),
      scaling: this.rows('SELECT * FROM spell_scaling WHERE spell_effect_id=? ORDER BY ordinal', Number(effect.id)).map((scaling) => {
        const roll = this.roll(scaling.roll_formula_id);
        const description = scaling.operation === 'другой результат' || !roll ? text(scaling.description)
          : `${scaling.operation === 'добавить формулу' ? 'Добавить' : 'Заменить бросок на'} ${roll}${scaling.threshold == null ? '' : `, начиная с уровня ${scaling.threshold}`}${scaling.step == null ? '' : `, шаг ${scaling.step}`}.`;
        return { basis: String(scaling.basis), description, roll };
      }),
    }));
    return {
      ...this.summary(row), edition: String(row.edition_name),
      castingTimes: this.rows(`SELECT x.*, a.code AS action_code, a.name_ru AS action_name, u.code AS unit_code, u.name_ru AS unit_name
        FROM spell_casting_times x LEFT JOIN action_types a ON a.id=x.action_type_id
        LEFT JOIN time_units u ON u.id=x.time_unit_id WHERE x.spell_id=? ORDER BY x.ordinal`, id).map((entry) => {
        const base = entry.action_type_id != null && entry.action_count != null && entry.action_code !== 'special'
          ? formatQuantity(Number(entry.action_count), text(entry.action_code), text(entry.action_name))
          : entry.time_value != null && entry.time_unit_id != null ? formatQuantity(Number(entry.time_value), text(entry.unit_code), text(entry.unit_name)) : text(entry.source_text) ?? 'Не указано';
        return entry.reaction_trigger ? `${base}: ${entry.reaction_trigger}` : base;
      }),
      range: row.range_code === 'distance' ? row.range_ft == null ? null : formatQuantity(Number(row.range_ft), 'foot', 'Фут')
        : row.range_code === 'special' ? text(row.range_text) : String(row.range_name),
      duration: row.duration_code === 'timed' && row.duration_value != null && row.duration_unit_id != null
        ? formatDuration(Number(row.duration_value), text(row.duration_unit_code), text(row.duration_unit_name), Boolean(row.requires_concentration))
        : ['special', 'trigger'].includes(String(row.duration_code)) ? text(row.duration_text) : String(row.duration_name),
      components: this.rows(`SELECT c.code FROM spell_components x JOIN component_types c ON c.id=x.component_type_id
        WHERE x.spell_id=? ORDER BY CASE c.code WHEN 'V' THEN 1 WHEN 'S' THEN 2 ELSE 3 END`, id)
        .map((component) => componentSymbols[String(component.code)] ?? String(component.code)).join(', ') || null,
      targets: text(row.targets_text), description: text(row.description),
      higherLevels: effects.flatMap((effect) => effect.scaling.map((scaling) => scaling.description).filter(Boolean)).join('\n') || text(row.higher_levels_text),
      sourceUrl: text(row.source_url),
      classAccess, subclasses, materials, effects,
      areas: this.rows(`SELECT a.name_ru AS shape, x.radius_ft AS radiusFt, x.length_ft AS lengthFt, x.width_ft AS widthFt,
        x.height_ft AS heightFt, x.description FROM spell_areas x JOIN area_shapes a ON a.id=x.shape_id WHERE x.spell_id=? ORDER BY x.ordinal`, id) as unknown as SpellDetail['areas'],
      sources: this.rows(`SELECT b.name_ru AS name, x.page_reference AS page, COALESCE(x.url,b.url) AS url
        FROM spell_sources x JOIN sources b ON b.id=x.source_id WHERE x.spell_id=?`, id) as unknown as SpellDetail['sources'],
    };
  }
}
