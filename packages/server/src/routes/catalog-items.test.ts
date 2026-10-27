import type { CatalogConnection } from '@koster/db';
import {
  apiErrorSchema,
  entityResponseSchema,
  itemFacetsResponseSchema,
  itemListResponseSchema,
  type ItemEntityResponse,
} from '@koster/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../app';
import { openTestCatalog } from '../test/test-catalog';

// Снаряжение во временном каталоге из урезанных статей data/fixtures/dndsu/articles.

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

async function list(query: string) {
  const { status, body } = await get(`/api/catalog/item?${query}`);
  expect(status).toBe(200);
  return itemListResponseSchema.parse(body);
}

async function card(id: string): Promise<ItemEntityResponse> {
  const { status, body } = await get(`/api/catalog/entity/${id}`);
  expect(status).toBe(200);
  const parsed = entityResponseSchema.parse(body);
  if (parsed.category !== 'item') throw new Error(`${id} — не предмет`);
  return parsed;
}

describe('GET /api/catalog/item — список', () => {
  it('страницы и алфавитный порядок без запроса', async () => {
    const page = await list('pageSize=5');
    expect(page).toMatchObject({ total: 35, page: 1, pageSize: 5 });
    expect(page.items.map((item) => item.nameRu)).toEqual([
      'Абак',
      'Арбалет, лёгкий',
      'Батарея',
      'Бомба',
      'Бурдюк',
    ]);
  });

  it('фильтры: вид, группа, свойство, тип урона, вариант правил', async () => {
    const names = async (query: string) => (await list(query)).items.map((item) => item.nameRu);
    expect(await names('kind=armor')).toEqual(['Кольчуга', 'Стёганый', 'Чешуйчатый']);
    expect(await names('category=martial_ranged&optionalRule=false')).toEqual([
      'Духовая трубка',
      'Сеть',
    ]);
    expect(await names('property=versatile')).toEqual(['Длинный меч', 'Трезубец']);
    expect(await names('damageType=slashing')).toEqual(['Длинный меч']);
    expect(await names('kind=weapon&optionalRule=true')).toEqual([
      'Иклва',
      'Пистоль',
      'Револьвер',
      'Хупак',
    ]);
  });

  it('элемент списка: цена, вес, урон, КД — неизвестное остаётся null', async () => {
    const items = (await list('pageSize=100')).items;
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get('item:longsword')).toMatchObject({
      costCp: 1500,
      costText: '15 зм',
      weightLb: 3,
      damage: { dice: '1d8', type: 'slashing' },
      armorClass: null,
      sources: ['PH14'],
    });
    expect(byId.get('item:scale-mail')?.armorClass).toEqual({ base: 14, addDex: true, dexMax: 2 });
    expect(byId.get('item:shield')?.armorClassBonus).toBe(2);
    expect(byId.get('item:arrows')).toMatchObject({ kind: 'ammunition', quantity: 20 });
    expect(byId.get('item:revolver')).toMatchObject({ costCp: null, costText: '-' });
    expect(byId.get('item:explorers-pack')).toMatchObject({ weightLb: null, weightText: null });
  });

  it('сортировка по цене: неизвестная цена — в конце', async () => {
    const items = (await list('sort=cost&pageSize=100')).items;
    expect(items[0]?.costCp).toBe(5);
    expect(items.at(-1)?.costCp).toBeNull();
  });

  it('поиск: по русскому и английскому названию, точное совпадение первым', async () => {
    expect((await list('q=меч')).items.map((item) => item.nameRu)).toEqual(['Длинный меч']);
    expect((await list('q=longsword')).items.map((item) => item.id)).toEqual(['item:longsword']);
    expect((await list('q=щит')).items[0]?.id).toBe('item:shield');
  });
});

describe('GET /api/catalog/item/facets', () => {
  it('значения фильтров с подписями и числом предметов', async () => {
    const { status, body } = await get('/api/catalog/item/facets');
    expect(status).toBe(200);
    const facets = itemFacetsResponseSchema.parse(body);
    expect(facets.kind).toContainEqual({ value: 'armor', label: 'Доспех', count: 3 });
    expect(facets.property).toContainEqual({
      value: 'versatile',
      label: 'Универсальное',
      count: 2,
    });
    expect(facets.source.map((source) => source.value)).toEqual(
      expect.arrayContaining(['ph14', 'dmg14', 'toa', 'sdq', 'cos']),
    );
    expect(facets.optionalRule).toBe(8);
  });
});

describe('GET /api/catalog/entity/:id — карточка предмета', () => {
  it('оружие: урон, свойства с дистанцией, связь с боеприпасом', async () => {
    const crossbow = await card('item:light-crossbow');
    expect(crossbow.rules?.weapon).toEqual({
      category: 'simple',
      range: 'ranged',
      damage: { dice: '1d8', type: 'piercing' },
      properties: [
        { id: 'ammunition', range: { normalFt: 80, longFt: 320 }, dice: null, shots: null },
        { id: 'two_handed', range: null, dice: null, shots: null },
        { id: 'loading', range: null, dice: null, shots: null },
      ],
      // Болтов в тестовых статьях нет: ID есть в механике, а связь не записана.
      ammunitionItemId: 'item:crossbow-bolts',
    });
    expect(crossbow.links).toEqual([]);
  });

  it('доспех: формула КД, Сила, Скрытность, надевание и снятие', async () => {
    const chainMail = await card('item:chain-mail');
    expect(chainMail.rules?.armor).toEqual({
      category: 'heavy',
      armorClass: { base: 16, addDex: false, dexMax: null },
      strengthRequired: 13,
      stealthDisadvantage: true,
      don: { amount: 10, unit: 'minute' },
      doff: { amount: 5, unit: 'minute' },
    });
    expect(chainMail.data.description).not.toEqual([]);
  });

  it('набор: состав ссылками, обратная связь у предмета', async () => {
    const pack = await card('item:explorers-pack');
    expect(pack.data.contents).toContainEqual({
      itemId: 'item:rations',
      name: 'рационы',
      quantity: 10,
      note: 'на 10 дней',
    });
    expect(pack.links).toContainEqual({
      kind: 'contains',
      direction: 'to',
      id: 'item:backpack',
      category: 'item',
      nameRu: 'Рюкзак',
    });
    const backpack = await card('item:backpack');
    expect(backpack.links).toContainEqual(
      expect.objectContaining({ kind: 'contains', direction: 'from', id: 'item:explorers-pack' }),
    );
  });

  it('огнестрельное оружие DMG — вариант правил, эпоха и боекомплект', async () => {
    const revolver = await card('item:revolver');
    expect(revolver.data).toMatchObject({ optionalRule: true, firearm: 'modern' });
    expect(revolver.rules?.weapon?.properties[0]).toEqual({
      id: 'reload',
      range: null,
      dice: null,
      shots: 6,
    });
    expect(revolver.sources.map((source) => source.code)).toEqual(['DMG14']);
  });

  it('у заклинания и предмета с одинаковым названием разные ID', async () => {
    expect((await card('item:shield')).nameRu).toBe('Щит');
    const { status } = await get('/api/catalog/entity/spell:shield');
    expect(status).toBe(404); // «Щита» нет среди тестовых заклинаний
  });
});

describe('ошибки', () => {
  it('неизвестный фильтр и неверное значение — 400', async () => {
    for (const url of ['/api/catalog/item?level=3', '/api/catalog/item?kind=sword']) {
      const { status, body } = await get(url);
      expect(status).toBe(400);
      expect(apiErrorSchema.parse(body).error.code).toBe('bad_request');
    }
  });

  it('категория без списка — 404', async () => {
    const { status } = await get('/api/catalog/race');
    expect(status).toBe(404);
  });
});
