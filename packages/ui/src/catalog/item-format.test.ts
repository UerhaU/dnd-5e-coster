import type { ItemListItem } from '@koster/shared';
import { describe, expect, it } from 'vitest';
import {
  armorClassText,
  costText,
  damageText,
  equipTimeText,
  itemSummary,
  propertyText,
  consumableActivationText,
  consumableEffectText,
  weightText,
} from './item-format';
import { itemParamsFromSearch } from './list-params';

describe('подписи снаряжения', () => {
  it('урон и КД как на DnD.su', () => {
    expect(damageText({ dice: '1d8', type: 'slashing' })).toBe('1к8 рубящий');
    expect(damageText(null)).toBeNull();
    expect(armorClassText({ base: 12, addDex: true, dexMax: 2 })).toBe(
      '12 + модификатор Ловкости (макс. 2)',
    );
    expect(armorClassText({ base: 18, addDex: false, dexMax: null })).toBe('18');
  });

  it('свойства с дистанцией, костью и числом выстрелов', () => {
    const base = { range: null, dice: null, shots: null };
    expect(propertyText({ ...base, id: 'thrown', range: { normalFt: 20, longFt: 60 } })).toBe(
      'Метательное (дис. 20/60)',
    );
    expect(propertyText({ ...base, id: 'versatile', dice: '1d10' })).toBe('Универсальное (1к10)');
    expect(propertyText({ ...base, id: 'reload', shots: 2 })).toBe('Боекомплект (2 выстрела)');
    expect(propertyText({ ...base, id: 'reload', shots: 15 })).toBe('Боекомплект (15 выстрелов)');
    expect(propertyText({ ...base, id: 'finesse' })).toBe('Фехтовальное');
  });

  it('эффект зелья лечения (Р64)', () => {
    const use = {
      activation: 'action' as const,
      consumed: true,
      effects: [{ type: 'healing' as const, dice: '2d4+2' }],
    };
    expect(use.effects.map(consumableEffectText)).toEqual(['Восстанавливает 2к4 + 2 хита']);
    expect(consumableActivationText(use)).toBe('Действие, предмет расходуется');
  });

  it('время, цена и вес; неизвестное — «—», а не 0', () => {
    expect(equipTimeText({ amount: 5, unit: 'minute' })).toBe('5 минут');
    expect(equipTimeText({ amount: 1, unit: 'action' })).toBe('1 действие');
    expect(costText(150000)).toMatch(/^1\s500 зм$/);
    expect(costText(20)).toBe('2 см');
    expect(costText(5)).toBe('5 мм');
    expect(costText(null)).toBe('—');
    expect(weightText(0.25)).toBe('0,25 фнт.');
    expect(weightText(null)).toBe('—');
  });

  it('строка списка: группа, урон или КД, количество, цена с сайта', () => {
    const item: ItemListItem = {
      id: 'item:arrows',
      nameRu: 'Стрелы',
      nameEn: 'Arrows',
      kind: 'ammunition',
      category: null,
      costText: '1 зм',
      costCp: 100,
      weightText: '1 фнт.',
      weightLb: 1,
      quantity: 20,
      optionalRule: false,
      damage: null,
      armorClass: null,
      armorClassBonus: null,
      sources: ['PH14'],
      reviewStatus: 'parsed',
    };
    expect(itemSummary(item)).toBe('Боеприпасы · 20 шт. · 1 зм');
    expect(
      itemSummary({
        ...item,
        kind: 'weapon',
        category: 'martial_melee',
        quantity: 1,
        damage: { dice: '1d8', type: 'slashing' },
        costText: '15 зм',
      }),
    ).toBe('Воинское рукопашное оружие · 1к8 рубящий · 15 зм');
  });
});

describe('фильтры снаряжения в адресе', () => {
  it('верные значения применяются, неверные — нет', () => {
    const search = new URLSearchParams('kind=weapon&property=finesse&optionalRule=false&kind2=x');
    expect(itemParamsFromSearch(search)).toEqual({
      kind: 'weapon',
      property: 'finesse',
      optionalRule: false,
    });
    expect(itemParamsFromSearch(new URLSearchParams('kind=sword&sort=cost'))).toEqual({
      sort: 'cost',
    });
  });
});
