import { describe, expect, it } from 'vitest';
import type { CatalogEntity } from '../build/catalog-entity.ts';
import { collectRaces } from '../build/collect-races.ts';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import { loadReviewedRaces } from '../reviewed/reviewed-races.ts';
import { parseAbilityScores } from './parse-race-rules.ts';

// Тесты разбора рас на урезанных страницах data/fixtures/dndsu/races (Р47).

type RaceEntity = Extract<CatalogEntity, { category: 'race' }>;

function collect() {
  const issues: ImportIssue[] = [];
  const result = collectRaces(
    openArticleCache(DEFAULT_PATHS.raceFixtures),
    loadReviewedRaces(DEFAULT_PATHS.reviewedRaces),
    issues,
    { knownSources: [], reportUnusedReviewed: false },
  );
  const entities = result.entities.filter(
    (entity): entity is RaceEntity => entity.category === 'race',
  );
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const get = (id: string) => {
    const entity = byId.get(id);
    if (!entity) throw new Error(`нет ${id}`);
    return entity;
  };
  return { stats: result.stats, issues, byId, get };
}

describe('увеличение характеристик', () => {
  it('фиксированное, «на выбор, кроме» и варианты MPMM', () => {
    expect(
      parseAbilityScores(
        'Значение вашего Телосложения увеличивается на 2, а значение вашей Мудрости увеличивается на 1.',
      ),
    ).toEqual([
      {
        fixed: [
          { ability: 'con', amount: 2 },
          { ability: 'wis', amount: 1 },
        ],
        choices: [],
      },
    ]);
    expect(
      parseAbilityScores(
        'Значение вашей Харизмы увеличивается на 2, а значения двух других характеристик на ваш выбор увеличиваются на 1.',
      ),
    ).toEqual([
      {
        fixed: [{ ability: 'cha', amount: 2 }],
        choices: [{ count: 2, amount: 1, from: null, except: ['cha'] }],
      },
    ]);
    expect(
      parseAbilityScores(
        'Либо значение одной характеристики по вашему выбору увеличивается на 2, а другой — на 1, либо значение трёх различных характеристик по вашему выбору увеличивается на 1.',
      ),
    ).toEqual([
      {
        fixed: [],
        choices: [
          { count: 1, amount: 2, from: null, except: [] },
          { count: 1, amount: 1, from: null, except: [] },
        ],
      },
      { fixed: [], choices: [{ count: 3, amount: 1, from: null, except: [] }] },
    ]);
  });
});

describe('расы и разновидности', () => {
  it('число объектов, без ошибок; UA и дубль MPMM на странице дварфа — пропуски', () => {
    const { stats, issues } = collect();
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(stats).toMatchObject({ pages: 6, races: 8, variants: 7, failed: 0 });
    const skipped = issues
      .filter((issue) => issue.severity === 'skip')
      .map((issue) => issue.message);
    expect(skipped).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Авариэль'),
        expect.stringContaining('своя страница 287'),
      ]),
    );
  });

  it('эльф: общее у расы, своё у разновидности; связь variant_of', () => {
    const { get } = collect();
    const elf = get('race:elf');
    expect(elf.data.kind).toBe('race');
    expect(elf.rules).toMatchObject({
      abilityScores: [{ fixed: [{ ability: 'dex', amount: 2 }], choices: [] }],
      size: ['medium'],
      speed: { walk: 30, fly: null },
      darkvisionFt: 60,
      skills: { fixed: ['perception'], choices: [] },
      languages: { fixed: ['common', 'elvish'], choose: 0 },
    });
    expect(elf.rules.textOnly).toEqual(expect.arrayContaining(['Наследие фей', 'Транс']));

    const high = get('race:high-elf');
    expect(high.data).toMatchObject({ kind: 'variant', variantOf: 'race:elf' });
    expect(high.links).toContainEqual({ toId: 'race:elf', kind: 'variant_of' });
    expect(high.links).toContainEqual({ toId: 'item:longsword', kind: 'weapon_proficiency' });
    expect(high.rules.weapons).toEqual(
      expect.arrayContaining([
        'item:longsword',
        'item:shortsword',
        'item:shortbow',
        'item:longbow',
      ]),
    );
    expect(high.rules.languages).toEqual({ fixed: [], choose: 1 });
    // Своё «Превосходное тёмное зрение» заменяет расовое.
    expect(get('race:drow').rules.darkvisionFt).toBe(120);
    const sea = get('race:sea-elf');
    expect(sea.sources[0]?.source.code).toBe('MTF');
    expect(sea.rules.speed.swim).toBe(30);
  });

  it('дварф: вкладки без дублей — общее вычислено, у горного только своё', () => {
    const { get } = collect();
    const dwarf = get('race:dwarf');
    expect(dwarf.rules.abilityScores).toEqual([
      { fixed: [{ ability: 'con', amount: 2 }], choices: [] },
    ]);
    expect(dwarf.rules.speed.walk).toBe(25);
    expect(dwarf.rules.resistances).toEqual(['poison']);
    expect(dwarf.data.features.map((feature) => feature.name)).toContain(
      'Дварфийская устойчивость',
    );

    const mountain = get('race:mountain-dwarf');
    expect(mountain.nameRu).toBe('Горный дварф');
    expect(mountain.rules.abilityScores).toEqual([
      { fixed: [{ ability: 'str', amount: 2 }], choices: [] },
    ]);
    expect(mountain.rules.armor).toEqual(['light', 'medium']);
    expect(mountain.data.features.map((feature) => feature.name)).not.toContain(
      'Дварфийская устойчивость',
    );
    const duergar = get('race:duergar');
    expect(duergar.rules.languages.fixed).toEqual(['undercommon']);
    expect(duergar.rules.darkvisionFt).toBe(120);
    expect(get('race:mark-of-warding-dwarf').nameRu).toBe('Дварф с меткой опеки');
  });

  it('повтор расы в MPMM — отдельный объект с суффиксом книги (Р67)', () => {
    const { get } = collect();
    expect(get('race:aarakocra').rules.speed).toMatchObject({ walk: 25, fly: 50 });
    const mpmm = get('race:aarakocra-mpmm');
    expect(mpmm.sources[0]?.source.code).toBe('MPMM');
    expect(mpmm.rules).toMatchObject({
      creatureType: 'humanoid',
      speed: { walk: 30, fly: 'walk' },
      languages: { fixed: ['common'], choose: 1 },
    });
    expect(mpmm.rules.abilityScores).toHaveLength(2);
  });

  it('та же раса из другой книги: книга — из заголовка раздела выше', () => {
    const { get } = collect();
    const rlw = get('race:goblin-rlw');
    expect(rlw.data.kind).toBe('race');
    expect(rlw.nameRu).toBe('Гоблин');
    expect(rlw.links).toEqual([]);
    expect(get('race:goblin-ggr').sources[0]?.source.code).toBe('GGR');
  });

  it('особенности без заголовка, размер на выбор', () => {
    const { get } = collect();
    expect(get('race:custom-lineage').rules).toMatchObject({
      size: ['small', 'medium'],
      creatureType: 'humanoid',
      abilityScores: [{ fixed: [], choices: [{ count: 1, amount: 2, from: null, except: [] }] }],
    });
  });
});
