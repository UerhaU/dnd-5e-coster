import { describe, expect, it } from 'vitest';
import type { CatalogEntity } from '../build/catalog-entity.ts';
import { collectRaces } from '../build/collect-races.ts';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import { loadReviewedRaces } from '../reviewed/reviewed-races.ts';
import { parseRaceBody } from './parse-race-body.ts';
import { parseAbilityScores, parseRaceRules } from './parse-race-rules.ts';

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
    expect(stats).toMatchObject({ pages: 8, races: 10, variants: 9, failed: 0 });
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

describe('рост, вес, возраст (Р69)', () => {
  it('числа из «Возраста» и «Размера»; метры в скобках и «в холке» не мешают', () => {
    expect(
      parseRaceBody(
        'Гоблины достигают зрелости к 8 годам, и живут до 60 лет.',
        'Рост гоблинов между 3 и 4 футами (90 сантиметров и 1,2 метра), а вес от 40 до 80 фунтов (от 18 до 36 килограмм). Ваш размер — Маленький.',
      ),
    ).toEqual({
      adultAge: 8,
      lifespan: 60,
      heightIn: { min: 36, max: 48 },
      weightLb: { min: 40, max: 80 },
      random: null,
    });
    // «за один год» — зрелость, «до 50 лет» — жизнь; «2½» и «около».
    expect(
      parseRaceBody(
        'Грунги достигают зрелости за один год, но известно, что живут они до 50 лет.',
        'Грунги от 2½ до 3½ футов (от 76 сантиметров до 1 метра) в высоту и весят в среднем около 30 фунтов.',
      ),
    ).toMatchObject({
      adultAge: 1,
      lifespan: 50,
      heightIn: { min: 30, max: 42 },
      weightLb: { min: 30, max: 30 },
    });
    // Слова вместо чисел; «достигают 5 … превосходящий 6» — диапазон.
    expect(
      parseRaceBody(
        'Люди становятся взрослыми в районе 20 лет, и живут менее столетия.',
        'Некоторые с трудом достигают 5 футов (152 сантиметров) ростом, тогда как другие имеют рост, превосходящий 6 футов (183 сантиметра).',
      ),
    ).toMatchObject({ adultAge: 20, lifespan: 100, heightIn: { min: 60, max: 72 } });
    // «как у людей» — чисел нет.
    expect(
      parseRaceBody(
        'Аасимары взрослеют как и люди, но они могут прожить до 160 лет.',
        'У аасимаров такие же рост и вес, как и у людей.',
      ),
    ).toEqual({ adultAge: null, lifespan: 160, heightIn: null, weightLb: null, random: null });
  });

  it('формула MOT абзацами после «Размера» и таблица гитов по разновидностям', () => {
    const { get } = collect();
    const centaur = get('race:centaur');
    expect(centaur.rules.body).toMatchObject({
      heightIn: { min: 72, max: 84 },
      random: {
        baseHeightIn: 72,
        heightDice: { count: 1, sides: 10 },
        baseWeightLb: 600,
        weightDice: { count: 2, sides: 12 },
      },
    });
    expect(centaur.data.features.map((feature) => feature.name)).not.toContain('Высота');
    expect(get('race:githzerai').rules.body.random).toEqual({
      baseHeightIn: 59,
      heightDice: { count: 2, sides: 12 },
      baseWeightLb: 90,
      weightDice: { count: 1, sides: 4 },
    });
    expect(get('race:githyanki').rules.body.random?.baseHeightIn).toBe(60);
    expect(get('race:gith').rules.textOnly).toEqual([]);
    expect(get('race:dwarf').rules.body).toMatchObject({ adultAge: 50, lifespan: 350 });
  });
});

describe('владение инструментами (Р69)', () => {
  const rulesOf = (name: string, text: string) =>
    parseRaceRules([{ name, blocks: [{ type: 'paragraph', text }] }]).rules;

  it('дварф: выбор из трёх — ссылками; связь tool_proficiency', () => {
    const dwarf = collect().get('race:dwarf');
    expect(dwarf.rules.tools).toEqual({
      fixed: [],
      choices: [
        {
          count: 1,
          from: ['item:brewers-supplies', 'item:masons-tools', 'item:smiths-tools'],
          group: null,
        },
      ],
    });
    expect(dwarf.links).toContainEqual({ toId: 'item:smiths-tools', kind: 'tool_proficiency' });
    expect(dwarf.rules.textOnly).not.toContain('Владение инструментами');
  });

  it('фиксированное, из группы, из любых; «навыком или инструментом» — текстом', () => {
    expect(
      rulesOf('Жестянщик', 'Вы владеете ремесленными инструментами (инструменты ремонтника).')
        .tools,
    ).toEqual({ fixed: ['item:tinkers-tools'], choices: [] });
    const satyr = rulesOf(
      'Гуляка',
      'Вы получаете владение навыками Выступление и Убеждение, а также одним музыкальным инструментом по вашему выбору.',
    );
    expect(satyr.skills).toEqual({ fixed: ['performance', 'persuasion'], choices: [] });
    expect(satyr.tools.choices).toEqual([{ count: 1, from: null, group: 'musical_instrument' }]);
    expect(
      rulesOf('Особая сборка', 'Вы получаете два владения инструментами по вашему выбору.').tools
        .choices,
    ).toEqual([{ count: 2, from: null, group: null }]);
    const mixed = rulesOf(
      'Декадентское мастерство',
      'Вы изучаете один язык по вашему выбору и получаете владение одним навыком или инструментом по вашему выбору.',
    );
    expect(mixed.skills.choices).toEqual([]);
    expect(mixed.tools.choices).toEqual([]);
    expect(mixed.textOnly).toEqual(['Декадентское мастерство']);
  });
});

describe('ручная проверка этапа 2 (Р73)', () => {
  const rulesOf = (name: string, text: string) =>
    parseRaceRules([{ name, blocks: [{ type: 'paragraph', text }] }]).rules;

  it('владение только в особых проверках — не постоянное, особенность текстом', () => {
    const stone = rulesOf(
      'Знание камня',
      'Если вы совершаете проверку Интеллекта (История) о работе по камню, вы считаетесь владеющим навыком История и удваиваете бонус мастерства.',
    );
    expect(stone.skills.fixed).toEqual([]);
    expect(stone.textOnly).toEqual(['Знание камня']);
  });

  it('«Расследование» и «Куори» распознаются', () => {
    expect(
      rulesOf(
        'Любопытство',
        'Вы владеете одним из следующих навыков на ваш выбор: Проницательность, Расследование или Скрытность.',
      ).skills.choices,
    ).toEqual([{ count: 1, from: ['insight', 'investigation', 'stealth'] }]);
    expect(
      rulesOf('Языки', 'Вы можете говорить, читать и писать на Общем и Куори.').languages,
    ).toEqual({ fixed: ['common', 'quori'], choose: 0 });
  });

  it('навыки постоянные, когда выбор — у инструмента («а также получаете владение»)', () => {
    const satyr = rulesOf(
      'Гуляка',
      'Вы получаете владение навыками Выступление и Убеждение, а также получаете владение одним музыкальным инструментом по вашему выбору.',
    );
    expect(satyr.skills).toEqual({ fixed: ['performance', 'persuasion'], choices: [] });
    expect(satyr.tools.choices).toEqual([{ count: 1, from: null, group: 'musical_instrument' }]);
  });

  it('«Вы — Фея» — вид существа; выбор варианта особенности — текстом', () => {
    const fey = rulesOf('Фея', 'Вы — Фея, а не Гуманоид.');
    expect(fey.creatureType).toBe('fey');
    expect(fey.textOnly).toEqual([]);
    expect(rulesOf('Фея', 'Вы Фея, а не Гуманоид.').creatureType).toBe('fey');
    const heritage = rulesOf(
      'Наследие',
      'Выберите одно из наследий ниже. Хитрость. Вы получаете владение одним из следующих навыков по вашему выбору: Магия или Медицина.',
    );
    expect(heritage.skills.choices).toEqual([]);
    expect(heritage.textOnly).toEqual(['Наследие']);
  });

  it('data/reviewed/races/rules.json читается без ошибок', () => {
    const reviewed = loadReviewedRaces(DEFAULT_PATHS.reviewedRaces);
    expect(reviewed.invalid).toEqual([]);
    expect(reviewed.fills.get('race:centaur-mot')?.walkFt).toBe(40);
    expect(reviewed.fills.get('race:aasimar')?.size).toEqual(['medium']);
  });
});
