import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import {
  backgroundLookup,
  collectBackgrounds,
  loadEquipmentPhrases,
} from './collect-backgrounds.ts';
import { collectReference, loadReferenceNames } from './collect-reference.ts';
import { coinsIn, parseTools } from './normalize-background.ts';

const folder = DEFAULT_PATHS.characterFixtures;
const names = loadReferenceNames(DEFAULT_PATHS.reviewedCharacter);

function collect() {
  const issues: ImportIssue[] = [];
  const reference = collectReference(
    openArticleCache(path.join(folder, 'reference')),
    names,
    issues,
    {
      knownSources: [],
    },
  );
  const result = collectBackgrounds(
    openArticleCache(path.join(folder, 'backgrounds')),
    backgroundLookup(reference.entities, loadEquipmentPhrases(DEFAULT_PATHS.reviewedCharacter)),
    names.backgrounds,
    issues,
    { knownSources: [] },
  );
  const get = (id: string) => {
    const entity = result.entities.find((candidate) => candidate.id === id);
    if (!entity) throw new Error(`нет ${id}`);
    return entity;
  };
  return { ...result, issues, get };
}

describe('предыстории', () => {
  it('без ошибок; адаптация — отдельный вид, название из names.json', () => {
    const { issues, stats, get } = collect();
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(stats).toMatchObject({ pages: 9, backgrounds: 8, adaptations: 1 });
    expect(get('background:ravenloft-background-adaptations').data.kind).toBe('adaptation');
  });

  it('артист: навыки и инструменты — ID, группа «музыкальный инструмент», разновидность', () => {
    const entertainer = collect().get('background:entertainer');
    expect(entertainer.rules.skills.fixed).toEqual(['skill:acrobatics', 'skill:performance']);
    expect(entertainer.rules.tools).toEqual({
      fixed: ['item:disguise-kit'],
      choices: [{ count: 1, from: null, group: 'musical_instrument' }],
    });
    expect(entertainer.data.feature?.name).toBe('По многочисленным просьбам');
    expect(entertainer.data.variants.map((variant) => variant.name)).toEqual(['Гладиатор']);
    expect(entertainer.data.personality.traits?.die).toBe('к8');
    expect(entertainer.links).toContainEqual({
      toId: 'skill:acrobatics',
      kind: 'skill_proficiency',
    });
  });

  it('народный герой: транспорт — вид; следователь: «Выберите два навыка»', () => {
    const { get } = collect();
    expect(get('background:folk-hero').rules.vehicles).toEqual(['land']);
    expect(get('background:investigator').rules.skills).toEqual({
      fixed: [],
      choices: [{ count: 2, from: expect.arrayContaining(['skill:perception']) as unknown }],
    });
  });

  it('утгардт: строки владений внутри раздела', () => {
    const uthgardt = collect().get('background:uthgardt-tribe-member');
    expect(uthgardt.rules.skills.fixed).toEqual(['skill:athletics', 'skill:survival']);
    expect(uthgardt.rules.languages.choices).toEqual([{ count: 1, from: null }]);
    // «Музыкальные инструменты или инструменты ремесленника одного типа» — смешанный выбор.
    expect(uthgardt.rules.mixed).toEqual([
      {
        count: 1,
        from: [
          { kind: 'tool_group', group: 'artisans_tools' },
          { kind: 'tool_group', group: 'musical_instrument' },
        ],
      },
    ]);
  });
});

describe('ручная проверка этапа 3', () => {
  const texts = (id: string) =>
    collect()
      .get(id)
      .rules.equipment.items.map((item) => item.text);

  it('деньги — только кошель: «украшение стоимостью 10 зм» не прибавляется (Дальний путешественник)', () => {
    const traveler = collect().get('background:far-traveler');
    expect(traveler.rules.equipment.coinsCp).toBe(500);
  });

  it('части снаряжения не режутся по запятой придаточного', () => {
    expect(texts('background:far-traveler')).toEqual([
      'Комплект дорожной одежды',
      'любой музыкальный инструмент или игровой набор, которым вы владеете',
      'схематичная карта с вашей родины, на которой отмечено ваше местонахождение на Фаэруне',
      'небольшое ювелирное украшение стоимостью 10 зм, украшенное в стиле вашей родины',
      'кошель с 5 зм',
    ]);
    expect(texts('background:giant-foundling')).toContain(
      'маленький камень или ветка, напоминающие вам о доме',
    );
    expect(texts('background:city-watch')).toContain('рожок, которым можно позвать на помощь');
  });

  it('синоним «наручники» → «Кандалы»; кошель — предмет по началу части', () => {
    const watch = collect().get('background:city-watch');
    expect(watch.rules.equipment.items).toContainEqual({
      text: 'наручники',
      itemId: 'item:manacles',
      quantity: 1,
    });
    expect(watch.rules.equipment.items).toHaveLength(4);
  });

  it('обрывки строки инструментов не попадают в «только текстом»', () => {
    const traveler = collect().get('background:far-traveler');
    expect(traveler.rules.mixed).toHaveLength(1);
    expect(
      traveler.rules.textOnly.filter((line) => line.startsWith('Владение инструментами')),
    ).toEqual([]);
  });

  it('«два языка, один из которых должен быть …» — 1 из 8 и 1 любой (Преследуемый)', () => {
    const haunted = collect().get('background:haunted-one');
    expect(haunted.rules.languages.choices).toEqual([
      {
        count: 1,
        from: [
          'language:abyssal',
          'language:celestial',
          'language:deep-speech',
          'language:draconic',
          'language:infernal',
          'language:primordial',
          'language:sylvan',
          'language:undercommon',
        ],
      },
      { count: 1, from: null },
    ]);
    expect(haunted.rules.equipment.coinsCp).toBe(10);
  });
});

describe('владение инструментами', () => {
  it('число — вне скобок: «один игровой набор (… ставка трёх драконов)» — один (Награждённый)', () => {
    const rules = { tools: { fixed: [], choices: [] }, mixed: [], vehicles: [] };
    parseTools(
      {
        label: 'Владение инструментами',
        text: 'один игровой набор на ваш выбор (например, игральные карты или ставка трёх драконов)',
        tooltips: [],
        links: [],
      },
      rules as unknown as Parameters<typeof parseTools>[1],
    );
    expect(rules.tools.choices).toEqual([{ count: 1, from: null, group: 'gaming_set' }]);
  });
});

describe('деньги части снаряжения', () => {
  it('кошель и монеты прописью — деньги, «стоимостью …» — цена предмета', () => {
    expect(coinsIn('кошель с 5 зм')).toBe(500);
    expect(coinsIn('небольшое ювелирное украшение стоимостью 10 зм')).toBeNull();
    // Клановый ремесленник.
    expect(coinsIn('мешочек с 5 золотыми монетами и самоцветом стоимостью 10 золотых монет')).toBe(
      500,
    );
    expect(coinsIn('и 1 см')).toBe(10);
  });
});
