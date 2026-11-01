import type { ImportIssue } from '../report/issues.ts';
import type { CatalogEntity } from './catalog-entity.ts';

// Классы у заклинаний — связи (долг этапов 1–3, Р53): коды `class:…` из списков
// классов и подклассы фильтра DnD.su (`data.subclasses`: название + класс) ведут на
// объекты `class` и `subclass`. Данные заклинаний не меняются — ревизии те же.
// Подкласс ищется по классу и названию; название в фильтре DnD.su, которое расходится
// с заголовком на странице класса, — `spellListName` в data/reviewed/character/subclasses.json.

type SpellEntity = Extract<CatalogEntity, { category: 'spell' }>;
type SubclassEntity = Extract<CatalogEntity, { category: 'subclass' }>;

export interface SpellClassLinkStats {
  /** Связей `spell_class` (обычный список и доп. список TCE). */
  classLinks: number;
  /** Связей `spell_subclass`. */
  subclassLinks: number;
  /** Целей без объекта (в полном каталоге — ошибки). */
  missing: number;
  /** Тестовый каталог: класса нет в сборке — связь пропущена без строки отчёта. */
  notBuilt: number;
}

const nameKey = (classId: string, name: string) =>
  `${classId}|${name.toLowerCase().replace(/ё/g, 'е').trim()}`;

export function linkSpellClasses(
  spells: readonly SpellEntity[],
  classIds: ReadonlySet<string>,
  subclasses: readonly SubclassEntity[],
  /** Подкласс → название в фильтре заклинаний DnD.su, если оно другое. */
  spellListNames: ReadonlyMap<string, string>,
  issues: ImportIssue[],
  /**
   * `full` — полный каталог: цели нет — ошибка. В тестовом классов 5: связи с другими
   * классами только считаются, а подкласс собранного класса без объекта — предупреждение.
   */
  options: { full: boolean },
): SpellClassLinkStats {
  const stats: SpellClassLinkStats = {
    classLinks: 0,
    subclassLinks: 0,
    missing: 0,
    notBuilt: 0,
  };
  const byName = new Map<string, string>();
  for (const sub of subclasses) {
    byName.set(nameKey(sub.rules.subclassOf, sub.nameRu), sub.id);
    const alias = spellListNames.get(sub.id);
    if (alias) byName.set(nameKey(sub.rules.subclassOf, alias), sub.id);
  }
  const miss = (spell: SpellEntity, classId: string, message: string) => {
    if (!options.full && !classIds.has(classId)) {
      stats.notBuilt += 1;
      return;
    }
    stats.missing += 1;
    issues.push({
      severity: options.full ? 'error' : 'warning',
      entityId: spell.id,
      dndsuId: spell.sources[0]?.dndsuId ?? null,
      field: 'links',
      message,
    });
  };

  for (const spell of spells) {
    const { classes, optionalClasses, subclasses: spellSubclasses } = spell.data;
    for (const classId of new Set([...classes, ...optionalClasses])) {
      if (!classIds.has(classId)) {
        miss(spell, classId, `Класс ${classId} из списка заклинания: нет объекта класса`);
        continue;
      }
      spell.links.push({ toId: classId, kind: 'spell_class' });
      stats.classLinks += 1;
    }
    for (const { name, classId } of spellSubclasses) {
      const subclassId = byName.get(nameKey(classId, name));
      if (!subclassId) {
        miss(
          spell,
          classId,
          `Подкласс «${name}» (${classId}) из фильтра DnD.su: нет объекта подкласса` +
            ' (spellListName в data/reviewed/character/subclasses.json)',
        );
        continue;
      }
      spell.links.push({ toId: subclassId, kind: 'spell_subclass' });
      stats.subclassLinks += 1;
    }
  }
  return stats;
}
