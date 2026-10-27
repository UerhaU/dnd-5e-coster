import type { CatalogConnection } from '@koster/db';
import {
  apiErrorSchema,
  categoriesResponseSchema,
  healthResponseSchema,
  spellEntityResponseSchema,
  spellFacetsResponseSchema,
  spellListResponseSchema,
} from '@koster/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../app';
import { openTestCatalog } from '../test/test-catalog';

// Каталог из 22 тестовых страниц data/fixtures (сборка во временную папку).

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

async function names(query: string): Promise<string[]> {
  const { status, body } = await get(`/api/catalog/spell?${query}`);
  expect(status).toBe(200);
  return spellListResponseSchema.parse(body).items.map((item) => item.nameRu);
}

describe('GET /api/health', () => {
  it('добавляет версию каталога', async () => {
    const health = healthResponseSchema.parse((await get('/api/health')).body);
    expect(health.catalog).toMatchObject({ version: 1, sourceKind: 'fixtures' });
  });
});

describe('GET /api/catalog/categories', () => {
  it('категории и число объектов', async () => {
    const body = categoriesResponseSchema.parse((await get('/api/catalog/categories')).body);
    expect(body.categories).toEqual([{ id: 'spell', nameRu: 'Заклинания', count: 22 }]);
  });
});

describe('GET /api/catalog/spell — список', () => {
  it('страницы: total, page, pageSize; без запроса — по алфавиту', async () => {
    const first = spellListResponseSchema.parse((await get('/api/catalog/spell?pageSize=5')).body);
    const second = spellListResponseSchema.parse(
      (await get('/api/catalog/spell?pageSize=5&page=2')).body,
    );

    expect(first).toMatchObject({ total: 22, page: 1, pageSize: 5 });
    expect(first.items.map((item) => item.nameRu)).toEqual([
      'Адское возмездие',
      'Антипатия/симпатия',
      'Божественное слово',
      'Власть над огнём',
      'Власть над погодой',
    ]);
    expect(second.items[0]?.nameRu).toBe('Волшебная стрела Джима');
  });

  it('фильтры: уровень, школа, класс, источник, ритуал, концентрация', async () => {
    expect(await names('level=0')).toEqual([
      'Власть над огнём',
      'Иссушающий укол',
      'Кодировка мыслей',
    ]);
    expect(await names('level=3&school=evocation')).toEqual(['Леомундова хижина', 'Огненный шар']);
    expect(await names('ritual=true')).toEqual(['Леомундова хижина', 'Обнаружение магии']);
    expect(await names('concentration=true&level=8')).toEqual(['Власть над погодой']);
    expect(await names('source=ai')).toEqual([
      'Волшебная стрела Джима',
      'Подарок болтуна',
      'Сверкающая монета Джима',
    ]);
    expect(await names('class=class:wizard&level=3')).toContain('Огненный шар');
    expect(await names('class=class:paladin&level=3')).not.toContain('Огненный шар');
    // Через подкласс: Огненный шар — у жреца домена света, Иссушающий укол — у волшебника
    // (хронургия), хотя в списках классов их нет.
    expect(await names('class=class:cleric&level=3')).toContain('Огненный шар');
    expect(await names('class=class:wizard&level=0')).toContain('Иссушающий укол');
  });

  it('сортировка по уровню', async () => {
    const levels = spellListResponseSchema
      .parse((await get('/api/catalog/spell?sort=level&pageSize=100')).body)
      .items.map((item) => item.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('у элемента списка — уровень, школа и коды источников', async () => {
    const body = spellListResponseSchema.parse((await get('/api/catalog/spell?q=поглощение')).body);
    expect(body.items).toEqual([
      {
        id: 'spell:absorb-elements',
        nameRu: 'Поглощение стихий',
        nameEn: 'Absorb elements',
        level: 1,
        school: 'abjuration',
        ritual: false,
        concentration: false,
        sources: ['POA', 'XGE'],
        reviewStatus: 'rules_verified',
      },
    ]);
  });
});

describe('GET /api/catalog/spell?q= — поиск FTS5', () => {
  it('«огнен» находит Огненный шар и Огненные ладони, название важнее текста', async () => {
    const found = await names('q=огнен');
    expect(found.slice(0, 2).sort()).toEqual(['Огненные ладони', 'Огненный шар']);
  });

  it('«ё» = «е» в обе стороны, регистр не важен', async () => {
    expect(await names('q=огнем')).toContain('Власть над огнём');
    expect(await names('q=ОГНЁМ')).toContain('Власть над огнём');
    expect(await names('q=пёрышком')).toEqual(['Падение пёрышком']);
    expect(await names('q=перыш')).toEqual(['Падение пёрышком']);
  });

  it('точное совпадение названия — первым', async () => {
    expect((await names('q=огненный шар'))[0]).toBe('Огненный шар');
    expect((await names('q=  ЗНАК '))[0]).toBe('Знак');
  });

  it('по английскому названию и по нескольким словам', async () => {
    expect(await names('q=fireb')).toEqual(['Огненный шар']);
    expect(await names('q=монета джима')).toEqual(['Сверкающая монета Джима']);
  });

  it('по тексту описания', async () => {
    expect(await names('q=воспоминан')).toContain('Кодировка мыслей');
  });

  it('знаки FTS5 в запросе не ломают поиск', async () => {
    const { status } = await get(`/api/catalog/spell?q=${encodeURIComponent('"огн* OR (')}`);
    expect(status).toBe(200);
    expect(await names(`q=${encodeURIComponent('***')}`)).toHaveLength(22);
  });
});

describe('GET /api/catalog/spell/facets', () => {
  it('значения фильтров с подписями и числом заклинаний', async () => {
    const body = spellFacetsResponseSchema.parse((await get('/api/catalog/spell/facets')).body);
    expect(body.level[0]).toEqual({ value: 0, label: 'Заговор', count: 3 });
    expect(body.school).toContainEqual({ value: 'evocation', label: 'Воплощение', count: 6 });
    expect(body.class).toContainEqual(
      expect.objectContaining({ value: 'class:wizard', label: 'Волшебник' }),
    );
    expect(body.source).toContainEqual({
      value: 'ai',
      label: 'AI — Acquisition Incorporated',
      count: 3,
    });
    expect(body).toMatchObject({ ritual: 2 });
  });
});

describe('GET /api/catalog/entity/:id — карточка', () => {
  it('все поля spell/v1, источники со ссылкой на DnD.su, статус проверки', async () => {
    const { status, body } = await get('/api/catalog/entity/spell:fireball');
    expect(status).toBe(200);
    const card = spellEntityResponseSchema.parse(body);

    expect(card).toMatchObject({
      nameRu: 'Огненный шар',
      reviewStatus: 'rules_verified',
      revision: { revision: 1, current: true },
      revisions: [1],
    });
    expect(card.data).toMatchObject({ level: 3, school: 'evocation' });
    expect(card.sources[0]).toMatchObject({ code: 'PH14', dndsuId: 205 });
    expect(card.sources[0]?.url).toMatch(/dnd\.su\/spells\/205/);
    expect(card.rules?.effects[0]).toMatchObject({ dice: '8d6' });
  });

  it('компонент А — отдельно от М, с ценой', async () => {
    const card = spellEntityResponseSchema.parse(
      (await get('/api/catalog/entity/spell:gift-of-gab')).body,
    );
    expect(card.data.components).toMatchObject({
      material: null,
      royalty: { text: '2 зм', costCp: 200 },
    });
  });

  it('ревизия по номеру', async () => {
    const card = spellEntityResponseSchema.parse(
      (await get('/api/catalog/entity/spell:fireball/revisions/1')).body,
    );
    expect(card.revision).toMatchObject({ revision: 1, current: true });
  });
});

describe('ошибки — единый формат', () => {
  it.each([
    ['нет объекта', '/api/catalog/entity/spell:no-such-spell'],
    ['нет ревизии', '/api/catalog/entity/spell:fireball/revisions/99'],
    ['нет категории', '/api/catalog/monster'],
    ['нет адреса', '/api/nothing'],
  ])('404: %s', async (_name, url) => {
    const { status, body } = await get(url);
    expect(status).toBe(404);
    expect(apiErrorSchema.parse(body).error.code).toBe('not_found');
  });

  it.each([
    ['уровень не число', '/api/catalog/spell?level=три'],
    ['неизвестная школа', '/api/catalog/spell?school=chaos'],
    ['лишний параметр', '/api/catalog/spell?color=red'],
    ['кривой ID', '/api/catalog/entity/Fireball'],
  ])('400: %s', async (_name, url) => {
    const { status, body } = await get(url);
    expect(status).toBe(400);
    expect(apiErrorSchema.parse(body).error).toMatchObject({
      code: 'bad_request',
      message: 'Неверные параметры запроса',
    });
  });

  it('503 без каталога', async () => {
    const empty = createServer({
      appVersion: '2.0.0-alpha.0',
      sqliteVersion: '3.50.0',
      allowedOrigins: [],
      catalog: null,
    });
    const response = await empty.inject({ method: 'GET', url: '/api/catalog/spell' });
    await empty.close();
    expect(response.statusCode).toBe(503);
    expect(apiErrorSchema.parse(response.json()).error.code).toBe('catalog_unavailable');
  });
});
