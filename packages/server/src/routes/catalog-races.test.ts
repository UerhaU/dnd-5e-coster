import type { CatalogConnection } from '@koster/db';
import {
  entityResponseSchema,
  raceFacetsResponseSchema,
  raceListResponseSchema,
  type RaceEntityResponse,
} from '@koster/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../app';
import { openTestCatalog } from '../test/test-catalog';

// Расы во временном каталоге из урезанных страниц data/fixtures/dndsu/races.

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
  const { status, body } = await get(`/api/catalog/race?${query}`);
  expect(status).toBe(200);
  return raceListResponseSchema.parse(body);
}

async function card(id: string): Promise<RaceEntityResponse> {
  const { status, body } = await get(`/api/catalog/entity/${id}`);
  expect(status).toBe(200);
  const parsed = entityResponseSchema.parse(body);
  if (parsed.category !== 'race') throw new Error(`${id} — не раса`);
  return parsed;
}

describe('GET /api/catalog/race — список', () => {
  it('раса, за ней её разновидности', async () => {
    const page = await list('pageSize=100');
    expect(page.total).toBe(15);
    const names = page.items.map((item) => item.id);
    const dwarf = names.indexOf('race:dwarf');
    expect(names.slice(dwarf, dwarf + 5)).toEqual([
      'race:dwarf',
      'race:mountain-dwarf',
      'race:mark-of-warding-dwarf',
      'race:duergar',
      'race:hill-dwarf',
    ]);
    expect(page.items.find((item) => item.id === 'race:hill-dwarf')).toMatchObject({
      kind: 'variant',
      variantOf: 'race:dwarf',
      variantOfName: 'Дварф',
    });
  });

  it('фильтры: разновидности расы, полёт, тёмное зрение, источник', async () => {
    const elves = await list('variantOf=race:elf');
    expect(elves.items.map((item) => item.nameRu).sort()).toEqual([
      'Высший эльф',
      'Морской эльф',
      'Тёмный эльф (дроу)',
    ]);
    const flying = await list('flying=true');
    expect(flying.items.map((item) => item.id).sort()).toEqual([
      'race:aarakocra',
      'race:aarakocra-mpmm',
    ]);
    const mpmm = await list('source=mpmm');
    expect(mpmm.items.map((item) => item.id)).toEqual(['race:aarakocra-mpmm']);
    const noDarkvision = await list('darkvision=false&kind=race');
    expect(noDarkvision.items.map((item) => item.id)).toContain('race:custom-lineage');
  });

  it('поиск: точное название — первым', async () => {
    const page = await list('q=дроу');
    expect(page.items[0]?.id).toBe('race:drow');
  });

  it('неверный фильтр — 400', async () => {
    const { status } = await get('/api/catalog/race?size=huge');
    expect(status).toBe(400);
  });
});

describe('GET /api/catalog/race/facets', () => {
  it('виды, размеры, источники и счётчики', async () => {
    const { status, body } = await get('/api/catalog/race/facets');
    expect(status).toBe(200);
    const facets = raceFacetsResponseSchema.parse(body);
    expect(facets.kind).toEqual([
      { value: 'race', label: 'Расы', count: 8 },
      { value: 'variant', label: 'Разновидности', count: 7 },
    ]);
    expect(facets.flying).toBe(2);
    expect(facets.source.map((source) => source.value)).toContain('mpmm');
  });
});

describe('GET /api/catalog/entity/:id — карточка расы', () => {
  it('механика и связь «разновидность» в обе стороны', async () => {
    const elf = await card('race:elf');
    expect(elf.rules.darkvisionFt).toBe(60);
    expect(elf.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'variant_of', direction: 'from', id: 'race:high-elf' }),
      ]),
    );
    const high = await card('race:high-elf');
    expect(high.data.variantOf).toBe('race:elf');
    expect(high.links).toEqual([
      expect.objectContaining({ kind: 'variant_of', direction: 'to', id: 'race:elf' }),
    ]);
  });
});
