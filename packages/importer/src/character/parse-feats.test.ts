import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import { collectFeats } from './collect-feats.ts';
import { parsePrerequisites, type FeatLookup } from './normalize-feat.ts';

const folder = path.join(DEFAULT_PATHS.characterFixtures, 'feats');

const lookup: Omit<FeatLookup, 'feats'> = {
  race: (name) => ({ Дварф: 'race:dwarf', 'Эльф (дроу)': 'race:drow' })[name] ?? null,
  backgrounds: new Map([['великаний подкидыш', 'background:giant-foundling']]),
  spells: new Map([['invisibility', 'spell:invisibility']]),
};

function collect() {
  const issues: ImportIssue[] = [];
  const result = collectFeats(openArticleCache(folder), lookup, issues, { knownSources: [] });
  const get = (id: string) => {
    const entity = result.entities.find((candidate) => candidate.id === id);
    if (!entity) throw new Error(`нет ${id}`);
    return entity;
  };
  return { ...result, issues, get };
}

describe('черты (тестовые страницы)', () => {
  it('собирает все страницы без ошибок', () => {
    const { stats, issues } = collect();
    expect(stats.feats).toBe(8);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('требование «способность накладывать заклинание»', () => {
    const feat = collect().get('feat:war-caster');
    expect(feat.data.prerequisite).toBe('Способность накладывать хотя бы одно заклинание');
    expect(feat.rules.prerequisites).toEqual([[{ kind: 'spellcasting' }]]);
    expect(feat.automation).toBe('display_only');
  });

  it('«Силы или Ловкости на 1» — выбор из двух', () => {
    expect(collect().get('feat:athlete').rules.abilityIncrease).toEqual({
      fixed: [],
      choices: [{ count: 1, amount: 1, from: ['str', 'dex'], except: [] }],
    });
  });

  it('владение доспехами: требование и получаемое', () => {
    const { rules } = collect().get('feat:moderately-armored');
    expect(rules.prerequisites).toEqual([[{ kind: 'armor', armor: 'light' }]]);
    expect(rules.armor).toEqual(['medium', 'shield']);
  });

  it('«трёх навыков или инструментов» — смешанный выбор', () => {
    expect(collect().get('feat:skilled').rules.mixed).toEqual([
      {
        count: 3,
        from: [
          { kind: 'skill', id: null },
          { kind: 'tool', id: null },
        ],
      },
    ]);
  });

  it('«Дварф или Маленькая раса» — одна группа, навык на выбор из двух', () => {
    const feat = collect().get('feat:squat-nimbleness');
    expect(feat.rules.prerequisites).toEqual([
      [
        { kind: 'race', id: 'race:dwarf' },
        { kind: 'size', size: 'small' },
      ],
    ]);
    expect(feat.rules.skills.choices).toEqual([
      { count: 1, from: ['skill:acrobatics', 'skill:athletics'] },
    ]);
    expect(feat.links).toContainEqual({ toId: 'race:dwarf', kind: 'prerequisite' });
  });

  it('заклинание по названию — данными, заклинание на выбор — текстом', () => {
    const feat = collect().get('feat:shadow-touched');
    expect(feat.rules.spells).toEqual(['spell:invisibility']);
    expect(feat.rules.textOnly.length).toBeGreaterThan(0);
    expect(feat.links).toContainEqual({ toId: 'spell:invisibility', kind: 'feat_spell' });
  });

  it('уровень и черта с вариантом — две группы; кампания — своя группа', () => {
    const { get } = collect();
    expect(get('feat:agent-of-order').rules.prerequisites).toEqual([
      [{ kind: 'level', min: 4 }],
      [
        {
          kind: 'feat',
          id: 'feat:scion-of-the-outer-planes',
          option: 'законный внешний план',
        },
      ],
    ]);
    expect(get('feat:scion-of-the-outer-planes').rules.prerequisites).toEqual([
      [{ kind: 'campaign', setting: 'planescape' }],
    ]);
  });
});

describe('строка требования', () => {
  const full: FeatLookup = {
    ...lookup,
    feats: new Map([['посвящённый в высшее волшебство', 'feat:initiate-of-high-sorcery']]),
  };

  it('характеристики «или» и классы с предысторией', () => {
    expect(parsePrerequisites('Интеллект или Мудрость 13 или выше', full)).toEqual([
      [
        { kind: 'ability', ability: 'int', min: 13 },
        { kind: 'ability', ability: 'wis', min: 13 },
      ],
    ]);
    expect(
      parsePrerequisites('владение воинским оружием или предыстория «Великаний подкидыш»', full),
    ).toEqual([
      [
        { kind: 'weapon', category: 'martial' },
        { kind: 'background', id: 'background:giant-foundling' },
      ],
    ]);
  });

  it('умение «Использование заклинаний» или «Магия договора»; неразобранное — текстом', () => {
    expect(
      parsePrerequisites('умение «Использование заклинаний» или «Магия договора»', full),
    ).toEqual([
      [
        { kind: 'class_feature', feature: 'spellcasting' },
        { kind: 'class_feature', feature: 'pact_magic' },
      ],
    ]);
    expect(parsePrerequisites('Отсутствие другой Метки Дракона', full)).toEqual([
      [{ kind: 'text', text: 'Отсутствие другой Метки Дракона' }],
    ]);
    expect(parsePrerequisites('Чародей, Волшебник', full)).toEqual([
      [
        { kind: 'class', id: 'class:sorcerer' },
        { kind: 'class', id: 'class:wizard' },
      ],
    ]);
  });
});
