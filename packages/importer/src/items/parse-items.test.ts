import { describe, expect, it } from 'vitest';
import type { CatalogEntity } from '../build/catalog-entity.ts';
import { collectItems } from '../build/collect-items.ts';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import { loadReviewedItems } from '../reviewed/reviewed-items.ts';
import { parseArticlePage, splitSourceMark } from './parse-article.ts';
import {
  parseArmorClass,
  parseCostCp,
  parseDamage,
  parseEquipTime,
  parseStrength,
  parseWeaponProperties,
  parseWeightLb,
} from './parse-values.ts';

// Тесты парсера снаряжения на урезанных статьях data/fixtures/dndsu/articles (Р47).

const cache = openArticleCache(DEFAULT_PATHS.itemFixtures);
const reviewed = loadReviewedItems(DEFAULT_PATHS.reviewedItems);

function collect() {
  const issues: ImportIssue[] = [];
  const result = collectItems(cache, reviewed, issues, {
    knownSources: [],
    reportUnusedReviewed: false,
  });
  const entities = result.entities.filter(
    (entity): entity is Extract<CatalogEntity, { category: 'item' }> => entity.category === 'item',
  );
  return { stats: result.stats, entities, issues, byId: new Map(entities.map((e) => [e.id, e])) };
}

describe('значения ячеек', () => {
  it.each([
    ['5 мм', 5],
    ['2 см', 20],
    ['15 зм', 1500],
    ['1 500 зм', 150000],
    ['—', null],
    ['-', null],
  ])('цена «%s» → %s мм', (text, cp) => {
    expect(parseCostCp(text)).toBe(cp);
  });

  it.each([
    ['¼ фнт.', 0.25],
    ['1,5 фнт.', 1.5],
    ['1/2 фнт.', 0.5],
    ['5 фнт. (полн.)', 5],
    ['5 унц.', 0.3125],
    ['—', null],
  ])('вес «%s» → %s фнт.', (text, lb) => {
    expect(parseWeightLb(text)).toBe(lb);
  });

  it('урон: кость и тип, фиксированный урон, «колющего урона»', () => {
    expect(parseDamage('1к8 рубящий')).toEqual({ dice: '1d8', type: 'slashing' });
    expect(parseDamage('1 колющий')).toEqual({ dice: '1', type: 'piercing' });
    expect(parseDamage('1к6 колющего урона')).toEqual({ dice: '1d6', type: 'piercing' });
    expect(parseDamage('6к8 некротическая энергия')).toEqual({ dice: '6d8', type: 'necrotic' });
    expect(parseDamage('много')).toBeNull();
  });

  it('свойства: дистанция, универсальное, боекомплект, опечатки сайта', () => {
    expect(parseWeaponProperties('Метательное (дис.. 20/60), универсальное (1к8)')).toEqual([
      { id: 'thrown', range: { normalFt: 20, longFt: 60 }, dice: null, shots: null },
      { id: 'versatile', range: null, dice: '1d8', shots: null },
    ]);
    expect(parseWeaponProperties('Боеприпас (40/160 фт.), фехтовальное')?.[0]?.range).toEqual({
      normalFt: 40,
      longFt: 160,
    });
    expect(parseWeaponProperties('Боекомплект (6 выстрелов), очередь')).toEqual([
      { id: 'reload', range: null, dice: null, shots: 6 },
      { id: 'burst_fire', range: null, dice: null, shots: null },
    ]);
    expect(parseWeaponProperties('—')).toEqual([]);
    expect(parseWeaponProperties('Магическое')).toBeNull();
  });

  it('КД, Сила, время надевания', () => {
    expect(parseArmorClass('12 + модификатор Лов (макс. 2)')).toEqual({
      base: 12,
      addDex: true,
      dexMax: 2,
    });
    expect(parseArmorClass('11 + модификатор Лов')).toEqual({
      base: 11,
      addDex: true,
      dexMax: null,
    });
    expect(parseArmorClass('18')).toEqual({ base: 18, addDex: false, dexMax: null });
    expect(parseStrength('Сил 15')).toBe(15);
    expect(parseStrength('—')).toBeNull();
    expect(parseStrength('много')).toBeUndefined();
    expect(parseEquipTime('10 минут')).toEqual({ amount: 10, unit: 'minute' });
    expect(parseEquipTime('1 действие')).toEqual({ amount: 1, unit: 'action' });
  });

  it('метка книги: «(ToA)», «(СOS)» кириллицей; скобки с текстом остаются', () => {
    // Регистр метки — как на сайте; код источника (TOA) делает ItemSources.
    expect(splitSourceMark('Иклва (ToA)')).toEqual({
      name: 'Иклва',
      source: { code: 'ToA', title: null },
    });
    expect(splitSourceMark('Набор (СOS)').source?.code).toBe('COS');
    expect(splitSourceMark('Масло (фляга)')).toEqual({ name: 'Масло (фляга)', source: null });
  });
});

describe('статья-таблица', () => {
  it('таблица инструментов из двух половин читается как две таблицы', () => {
    const article = parseArticlePage(cache.readPage(147) ?? '');
    const tools = article.tables.filter((table) => table.heading === 'Инструменты');
    expect(tools).toHaveLength(2);
    expect(tools[1]?.rows[0]).toMatchObject({
      name: 'Инструменты алхимика',
      inGroup: true,
      groups: ['Инструменты ремесленников'],
    });
    expect(article.sourceTitle).toBe("Player's Handbook");
  });
});

describe('нормализация снаряжения', () => {
  it('все тестовые строки попали в каталог без ошибок', () => {
    const { stats, issues } = collect();
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(stats).toMatchObject({ pages: 3, failedPages: 0, failed: 0, collected: 35 });
    // Описание без строки таблицы — в отчёт, предмет не создаётся.
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: 'skip', message: expect.stringContaining('Безаварий') }),
    );
  });

  it('у каждого оружия и доспеха есть механика', () => {
    const { entities } = collect();
    const armed = entities.filter((e) => ['weapon', 'armor', 'shield'].includes(e.data.kind));
    expect(armed.filter((entity) => entity.rules === null)).toEqual([]);
  });

  it('ID по английскому названию, группа таблицы — вид предмета', () => {
    const { byId } = collect();
    expect(byId.get('item:padded-armor')).toMatchObject({
      nameRu: 'Стёганый',
      nameEn: 'Padded armor',
      data: { kind: 'armor', category: 'light_armor' },
    });
    expect(byId.get('item:arrows')?.data).toMatchObject({ kind: 'ammunition', quantity: 20 });
    expect(byId.get('item:wand')?.data.category).toBe('arcane_focus');
    expect(byId.get('item:lute')?.data.category).toBe('musical_instrument');
    expect(byId.get('item:potion-of-healing')?.nameRu).toBe('Зелье лечения');
  });

  it('неизвестные цена и вес — null с исходным текстом, а не 0', () => {
    const { byId } = collect();
    expect(byId.get('item:revolver')?.data.cost).toEqual({ text: '-', cp: null });
    expect(byId.get('item:explorers-pack')?.data.weight).toEqual({ text: null, lb: null });
    expect(byId.get('item:energy-cell')?.data.weight).toEqual({ text: '5 унц.', lb: 0.3125 });
  });

  it('описания: «Чешуйчатый доспех», общий термин «Верёвка», группа, раздел h3', () => {
    const { byId } = collect();
    for (const id of [
      'item:scale-mail',
      'item:hempen-rope',
      'item:wand',
      'item:lute',
      'item:yklwa',
      'item:grenade-launcher',
      'item:shield',
      'item:net',
    ]) {
      expect(byId.get(id)?.data.description, id).not.toEqual([]);
    }
  });

  it('дополнительное и огнестрельное оружие — вариант правил со своим источником', () => {
    const { byId } = collect();
    const yklwa = byId.get('item:yklwa');
    expect(yklwa?.data.optionalRule).toBe(true);
    expect(yklwa?.sources[0]?.source).toMatchObject({
      code: 'TOA',
      nameEn: 'Tomb of Annihilation',
    });
    expect(byId.get('item:pistol')?.data).toMatchObject({
      optionalRule: true,
      firearm: 'renaissance',
    });
    expect(byId.get('item:bomb')?.data.optionalRule).toBe(true);
    expect(byId.get('item:dagger')?.data.optionalRule).toBe(false);
  });

  it('набор: цена из заголовка, состав и связи `contains`, источник из метки', () => {
    const { byId } = collect();
    const pack = byId.get('item:monster-hunters-pack');
    expect(pack?.data.cost).toEqual({ text: '33 зм', cp: 3300 });
    expect(pack?.sources[0]?.source.code).toBe('COS');
    expect(pack?.links).toContainEqual({ toId: 'item:holy-water', kind: 'contains' });
    expect(pack?.data.contents).toContainEqual({
      itemId: null,
      name: 'деревянный кол',
      quantity: 3,
      note: null,
    });
  });

  it('оружие с боеприпасом — связь `uses_ammunition`', () => {
    const { byId } = collect();
    expect(byId.get('item:pistol')?.links).toEqual([
      { toId: 'item:bullets', kind: 'uses_ammunition' },
    ]);
  });
});
