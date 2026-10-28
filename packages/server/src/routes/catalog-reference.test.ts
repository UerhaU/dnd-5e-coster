import type { CatalogConnection } from '@koster/db';
import {
  entityResponseSchema,
  referenceFacetsResponseSchema,
  referenceListResponseSchema,
} from '@koster/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../app';
import { openTestCatalog } from '../test/test-catalog';

// Справочные категории этапа 3 во временном каталоге из data/fixtures/dndsu/character.

let catalog: CatalogConnection;
let dispose: () => void;
let server: FastifyInstance;

beforeAll(() => {
  ({ catalog, dispose } = openTestCatalog());
  server = createServer({
    appVersion: '2.0.0-alpha.0',
    sqliteVersion: '3.50.0',
    allowedOrigins: ['app://koster'],
    catalog,
  });
});

afterAll(async () => {
  await server.close();
  dispose();
});

async function get(url: string) {
  const response = await server.inject({ method: 'GET', url });
  return { status: response.statusCode, body: response.json() as unknown };
}

async function list(category: string, query = '') {
  const { status, body } = await get(`/api/catalog/${category}?${query}`);
  expect(status).toBe(200);
  return referenceListResponseSchema.parse(body);
}

describe('GET /api/catalog/{skill,language,condition,background,feat}', () => {
  it('навыки: все 18, характеристика в строке, фильтр по характеристике', async () => {
    const all = await list('skill', 'pageSize=100');
    expect(all.total).toBe(18);
    expect(all.items.find((item) => item.id === 'skill:athletics')?.detail).toBe('Сила');
    const dex = await list('skill', 'ability=dex');
    expect(dex.items.map((item) => item.id)).toEqual([
      'skill:acrobatics',
      'skill:sleight-of-hand',
      'skill:stealth',
    ]);
  });

  it('языки: вид и диалект в строке, фильтр по виду', async () => {
    const exotic = await list('language', 'kind=exotic&pageSize=100');
    expect(exotic.total).toBeGreaterThan(0);
    // Диалект показывает свой язык, а не вид.
    expect(
      exotic.items.every(
        (item) => item.detail === 'Экзотический' || item.detail?.startsWith('Диалект: '),
      ),
    ).toBe(true);
    const aquan = (await list('language', 'q=Акван')).items[0];
    expect(aquan?.detail).toMatch(/^Диалект: /);
  });

  it('состояния: поиск по названию', async () => {
    const result = await list('condition', 'q=ничком');
    expect(result.items.map((item) => item.id)).toContain('condition:prone');
  });

  it('предыстории: вид, навыки в строке', async () => {
    const adaptations = await list('background', 'kind=adaptation');
    expect(adaptations.total).toBe(1);
    expect(adaptations.items[0]?.detail).toBe('Адаптация предысторий');
    const entertainer = (await list('background', 'q=Артист')).items[0];
    expect(entertainer?.detail).toMatch(/Акробатика/);
  });

  it('черты: требование в строке, фильтры требований и увеличения', async () => {
    const all = await list('feat', 'pageSize=100');
    expect(all.total).toBe(8);
    expect(all.items.find((item) => item.id === 'feat:war-caster')?.detail).toBe(
      'Требование: Способность накладывать хотя бы одно заклинание',
    );
    const free = await list('feat', 'prerequisite=false');
    expect(free.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(['feat:athlete', 'feat:skilled']),
    );
    expect(free.items.every((item) => item.detail === null)).toBe(true);
    const race = await list('feat', 'raceRequired=true');
    expect(race.items.map((item) => item.id)).toEqual(['feat:squat-nimbleness']);
    const increase = await list('feat', 'abilityIncrease=true');
    expect(increase.items.map((item) => item.id)).toContain('feat:athlete');
  });

  it('фильтры и число объектов', async () => {
    const { status, body } = await get('/api/catalog/feat/facets');
    expect(status).toBe(200);
    const facets = referenceFacetsResponseSchema.parse(body);
    expect(facets.prerequisite).toBe(5);
    expect(facets.raceRequired).toBe(1);
    expect(facets.ability).toEqual([]);
    const skills = referenceFacetsResponseSchema.parse(
      (await get('/api/catalog/skill/facets')).body,
    );
    expect(skills.ability.map((entry) => entry.value)).toEqual(['str', 'dex', 'int', 'wis', 'cha']);
  });

  it('карточка черты проходит схему', async () => {
    const { status, body } = await get('/api/catalog/entity/feat:skilled');
    expect(status).toBe(200);
    const card = entityResponseSchema.parse(body);
    expect(card.category).toBe('feat');
    if (card.category !== 'feat') return;
    expect(card.rules.mixed[0]?.count).toBe(3);
  });
});

describe('GET /api/catalog/{class,subclass}', () => {
  it('классы: кость хитов и заклинания в строке, фильтр «заклинатель»', async () => {
    const all = await list('class');
    expect(all.items.map((item) => item.id)).toEqual([
      'class:barbarian',
      'class:fighter',
      'class:cleric',
      'class:warlock',
      'class:monk',
    ]);
    expect(all.items.find((item) => item.id === 'class:cleric')?.detail).toBe(
      'Кость хитов к8 · заклинания: Мудрость',
    );
    const casters = await list('class', 'spellcaster=true');
    expect(casters.items.map((item) => item.id).sort()).toEqual(['class:cleric', 'class:warlock']);
  });

  it('подклассы: класс и уровень в строке, фильтр по классу', async () => {
    const barbarian = await list('subclass', 'classId=class:barbarian&pageSize=100');
    expect(barbarian.total).toBe(9);
    expect(barbarian.items.find((item) => item.id === 'subclass:barbarian-berserker')?.detail).toBe(
      'Варвар · с 3-го уровня',
    );
    const facets = referenceFacetsResponseSchema.parse(
      (await get('/api/catalog/subclass/facets')).body,
    );
    expect(facets.classId.find((entry) => entry.value === 'class:cleric')?.count).toBe(14);
    expect(facets.spellcaster).toBeGreaterThan(0);
  });

  it('карточки класса и подкласса проходят схему, подкласс связан с классом', async () => {
    const card = entityResponseSchema.parse((await get('/api/catalog/entity/class:monk')).body);
    expect(card.category).toBe('class');
    if (card.category !== 'class') return;
    expect(card.rules.table).toHaveLength(20);
    expect(
      card.links.filter((link) => link.kind === 'subclass_of' && link.direction === 'from'),
    ).toHaveLength(10);
    const sub = entityResponseSchema.parse(
      (await get('/api/catalog/entity/subclass:fighter-eldritch-knight')).body,
    );
    expect(sub.category).toBe('subclass');
    expect(sub.links).toContainEqual(
      expect.objectContaining({ id: 'class:fighter', kind: 'subclass_of', direction: 'to' }),
    );
  });
});
