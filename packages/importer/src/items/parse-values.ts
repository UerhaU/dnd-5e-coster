import type {
  ArmorRules,
  DamageTypeId,
  EquipTime,
  WeaponProperty,
  WeaponPropertyId,
} from '@koster/shared';

// Значения ячеек таблиц снаряжения DnD.su → числа и коды.
// Каждая функция возвращает `null`, если текст не разобран: решать, ошибка ли это,
// будет вызывающий (раздел 9: неизвестное не подменяется нулём).

const normalize = (value: string) => value.toLowerCase().replaceAll('ё', 'е').trim();

/** «—», «-» и пустая ячейка: значение не указано. */
export function isDash(value: string): boolean {
  return /^[—–-]*$/.test(value.trim());
}

/** Число с пробелами-разделителями и дробями: «1 500», «1,5», «¼», «1/2». */
export function parseNumber(value: string): number | null {
  const text = value.replace(/\s+/g, '').replace(',', '.');
  const fractions: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
  if (text in fractions) {
    return fractions[text] ?? null;
  }
  const ratio = /^(\d+)\/(\d+)$/.exec(text);
  if (ratio) {
    return Number(ratio[1]) / Number(ratio[2]);
  }
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}

const COIN_IN_CP: Record<string, number> = { мм: 1, см: 10, эм: 50, зм: 100, пм: 1000 };

/** «1 500 зм» → 150000 мм. `null` — цены нет («—») или текст не разобран. */
export function parseCostCp(value: string): number | null {
  const match = /^([\d\s,]+)\s*(мм|см|эм|зм|пм)\.?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const amount = parseNumber(match[1] ?? '');
  const coin = COIN_IN_CP[match[2] ?? ''];
  return amount === null || coin === undefined ? null : Math.round(amount * coin);
}

/** «¼ фнт.», «5 фнт. (полн.)», «5 унц.» → фунты. */
export function parseWeightLb(value: string): number | null {
  const match = /^([\d\s,¼½¾/]+)\s*(фнт|унц)\.?/.exec(value.trim());
  if (!match) {
    return null;
  }
  const amount = parseNumber(match[1] ?? '');
  if (amount === null) {
    return null;
  }
  return match[2] === 'унц' ? amount / 16 : amount;
}

const DAMAGE_TYPE_STEMS: [string, DamageTypeId][] = [
  ['дробящ', 'bludgeoning'],
  ['колющ', 'piercing'],
  ['рубящ', 'slashing'],
  ['излучен', 'radiant'],
  ['некротическ', 'necrotic'],
  ['огн', 'fire'],
  ['холод', 'cold'],
  ['кислот', 'acid'],
  ['электричеств', 'lightning'],
  ['звук', 'thunder'],
  ['яд', 'poison'],
  ['психическ', 'psychic'],
  ['силов', 'force'],
];

/** Кость: «1к8» → `1d8`, «1» → `1`. */
export function parseDice(value: string): string | null {
  const match = /^(\d+)(?:\s*к\s*(\d+))?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return match[2] ? `${match[1]}d${match[2]}` : (match[1] ?? null);
}

/** «1к8 рубящий», «1к6 колющего урона», «6к8 некротическая энергия». */
export function parseDamage(value: string): { dice: string; type: DamageTypeId } | null {
  const match = /^(\d+(?:\s*к\s*\d+)?)\s+(.+)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const dice = parseDice(match[1] ?? '');
  const words = normalize(match[2] ?? '');
  const type = DAMAGE_TYPE_STEMS.find(([stem]) => words.startsWith(stem))?.[1];
  return dice && type ? { dice, type } : null;
}

const PROPERTY_NAMES: [string, WeaponPropertyId][] = [
  ['боеприпас', 'ammunition'],
  ['боекомплект', 'reload'],
  ['фехтовальное', 'finesse'],
  ['тяжелое', 'heavy'],
  ['легкое', 'light'],
  ['перезарядка', 'loading'],
  ['досягаемость', 'reach'],
  ['особое', 'special'],
  ['метательное', 'thrown'],
  ['двуручное', 'two_handed'],
  ['универсальное', 'versatile'],
  ['очередь', 'burst_fire'],
];

/** Части через запятую, но не внутри скобок: «Метательное (дис. 20/60), лёгкое». */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part);
}

/**
 * Свойства оружия: «Боеприпас (дис. 80/320), двуручное, перезарядка».
 * `null` — хотя бы одно свойство не распознано.
 */
export function parseWeaponProperties(value: string): WeaponProperty[] | null {
  if (isDash(value)) {
    return [];
  }
  const properties: WeaponProperty[] = [];
  for (const part of splitTopLevel(value)) {
    const match = /^([^(]+?)\s*(?:\((.*)\))?$/.exec(part);
    const name = normalize(match?.[1] ?? '');
    const argument = match?.[2]?.trim() ?? null;
    const id = PROPERTY_NAMES.find(([known]) => name === known)?.[1];
    if (!id) {
      return null;
    }
    const property: WeaponProperty = { id, range: null, dice: null, shots: null };
    if (id === 'ammunition' || id === 'thrown') {
      // «дис. 80/320», «дис.. 20/60», «40/160 фт.»
      const range = /(\d+)\s*\/\s*(\d+)/.exec(argument ?? '');
      if (!range) {
        return null;
      }
      property.range = { normalFt: Number(range[1]), longFt: Number(range[2]) };
    } else if (id === 'versatile') {
      property.dice = parseDice(argument ?? '');
      if (!property.dice) {
        return null;
      }
    } else if (id === 'reload') {
      const shots = /(\d+)/.exec(argument ?? '');
      if (!shots) {
        return null;
      }
      property.shots = Number(shots[1]);
    } else if (argument) {
      return null;
    }
    properties.push(property);
  }
  return properties;
}

/** «12 + модификатор Лов (макс. 2)», «18», «2» (щит). */
export function parseArmorClass(value: string): ArmorRules['armorClass'] | null {
  const match = /^(\d+)(\s*\+\s*модификатор\s+лов\S*(?:\s*\(макс\.?\s*(\d+)\))?)?$/.exec(
    normalize(value),
  );
  if (!match) {
    return null;
  }
  return {
    base: Number(match[1]),
    addDex: Boolean(match[2]),
    dexMax: match[3] ? Number(match[3]) : null,
  };
}

/** «Сил 13» → 13; «—» → `null` (требования нет). `undefined` — текст не разобран. */
export function parseStrength(value: string): number | null | undefined {
  if (isDash(value)) {
    return null;
  }
  const match = /^сил\S*\s*(\d+)$/.exec(normalize(value));
  return match ? Number(match[1]) : undefined;
}

/** «1 минута», «10 минут», «1 действие». */
export function parseEquipTime(value: string): EquipTime | null {
  const match = /^(\d+)\s+(минут\S*|действи\S*)$/.exec(normalize(value));
  if (!match) {
    return null;
  }
  return {
    amount: Number(match[1]),
    unit: match[2]?.startsWith('минут') ? 'minute' : 'action',
  };
}
