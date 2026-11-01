import { describe, expect, it } from 'vitest';
import type { ImportIssue } from '../report/issues.ts';
import type { CatalogEntity } from './catalog-entity.ts';
import { linkSpellClasses } from './link-spell-classes.ts';

type SpellEntity = Extract<CatalogEntity, { category: 'spell' }>;
type SubclassEntity = Extract<CatalogEntity, { category: 'subclass' }>;

// Только поля, которые читает linkSpellClasses.
const spell = (data: Partial<SpellEntity['data']>): SpellEntity =>
  ({
    id: 'spell:test',
    category: 'spell',
    sources: [{ dndsuId: 1 }],
    links: [],
    data: { classes: [], optionalClasses: [], subclasses: [], ...data },
  }) as unknown as SpellEntity;

const subclass = (id: string, nameRu: string, subclassOf: string): SubclassEntity =>
  ({ id, nameRu, category: 'subclass', rules: { subclassOf } }) as unknown as SubclassEntity;

const subclasses = [
  subclass('subclass:cleric-light', 'Домен света', 'class:cleric'),
  subclass('subclass:ranger-monster-slayer', 'Убийца чудовищ', 'class:ranger'),
];
const classIds = new Set(['class:cleric', 'class:wizard', 'class:ranger']);
const aliases = new Map([['subclass:ranger-monster-slayer', 'убийца монстров']]);

describe('linkSpellClasses', () => {
  it('классы — spell_class, подклассы по классу и названию (регистр, ё) — spell_subclass', () => {
    const fireball = spell({
      classes: ['class:wizard'],
      optionalClasses: ['class:wizard'],
      subclasses: [
        { name: 'домен света', classId: 'class:cleric', dndsuId: 1 },
        { name: 'убийца монстров', classId: 'class:ranger', dndsuId: 2 },
      ],
    });
    const issues: ImportIssue[] = [];
    const stats = linkSpellClasses([fireball], classIds, subclasses, aliases, issues, {
      full: true,
    });
    expect(fireball.links).toEqual([
      { toId: 'class:wizard', kind: 'spell_class' },
      { toId: 'subclass:cleric-light', kind: 'spell_subclass' },
      { toId: 'subclass:ranger-monster-slayer', kind: 'spell_subclass' },
    ]);
    expect(stats).toEqual({ classLinks: 1, subclassLinks: 2, missing: 0, notBuilt: 0 });
    expect(issues).toEqual([]);
  });

  it('полный каталог: класс или подкласс без объекта — ошибка сборки', () => {
    const issues: ImportIssue[] = [];
    const stats = linkSpellClasses(
      [
        spell({
          classes: ['class:bard'],
          subclasses: [{ name: 'домен тьмы', classId: 'class:cleric', dndsuId: null }],
        }),
      ],
      classIds,
      subclasses,
      aliases,
      issues,
      { full: true },
    );
    expect(stats.missing).toBe(2);
    expect(issues.map((issue) => issue.severity)).toEqual(['error', 'error']);
  });

  it('тестовый каталог: класса нет в сборке — только счёт; подкласс собранного — предупреждение', () => {
    const issues: ImportIssue[] = [];
    const stats = linkSpellClasses(
      [
        spell({
          classes: ['class:bard'],
          subclasses: [{ name: 'домен тьмы', classId: 'class:cleric', dndsuId: null }],
        }),
      ],
      classIds,
      subclasses,
      aliases,
      issues,
      { full: false },
    );
    expect(stats).toMatchObject({ missing: 1, notBuilt: 1 });
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning' })]);
  });
});
