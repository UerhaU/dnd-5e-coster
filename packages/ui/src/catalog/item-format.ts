import {
  ITEM_CATEGORIES,
  ITEM_KINDS,
  WEAPON_PROPERTIES,
  type ArmorRules,
  type EquipTime,
  type ItemCategoryId,
  type ItemKindId,
  type ItemListItem,
  type UseRules,
  type WeaponProperty,
} from '@koster/shared';
import { damageTypeName } from './spell-format';

// Подписи для экранов снаряжения. Только функции без React: их проще проверить тестами.

export function kindName(kind: ItemKindId): string {
  return ITEM_KINDS.find((entry) => entry.id === kind)?.nameRu ?? kind;
}

export function categoryName(category: ItemCategoryId): string {
  return ITEM_CATEGORIES.find((entry) => entry.id === category)?.nameRu ?? category;
}

/** Кость как на DnD.su: `1d8` → «1к8». */
export function diceText(dice: string): string {
  return dice.replace(/d/g, 'к');
}

/** «1к8 рубящий» → «1к8 (рубящий)». Без урона — `null`. */
export function damageText(damage: { dice: string; type: string } | null): string | null {
  return damage ? `${diceText(damage.dice)} ${damageTypeName(damage.type).toLowerCase()}` : null;
}

/** «12 + Лов (макс. 2)», «18». */
export function armorClassText(armorClass: ArmorRules['armorClass']): string {
  if (!armorClass.addDex) {
    return String(armorClass.base);
  }
  const cap = armorClass.dexMax === null ? '' : ` (макс. ${armorClass.dexMax})`;
  return `${armorClass.base} + модификатор Ловкости${cap}`;
}

/** «Метательное (дис. 20/60)», «Универсальное (1к10)», «Боекомплект (6 выстрелов)». */
export function propertyText(property: WeaponProperty): string {
  const name = WEAPON_PROPERTIES.find((entry) => entry.id === property.id)?.nameRu ?? property.id;
  if (property.range) {
    return `${name} (дис. ${property.range.normalFt}/${property.range.longFt})`;
  }
  if (property.dice) {
    return `${name} (${diceText(property.dice)})`;
  }
  if (property.shots) {
    return `${name} (${property.shots} ${plural(property.shots, 'выстрел', 'выстрела', 'выстрелов')})`;
  }
  return name;
}

export function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100;
  const units = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}

/** «1 минута», «5 минут», «1 действие». */
export function equipTimeText(time: EquipTime): string {
  return time.unit === 'minute'
    ? `${time.amount} ${plural(time.amount, 'минута', 'минуты', 'минут')}`
    : `${time.amount} ${plural(time.amount, 'действие', 'действия', 'действий')}`;
}

/**
 * Цена в монетах: 150000 → «1 500 зм», 5 → «5 мм». Неизвестная цена — «—»:
 * это не бесплатно (раздел 9).
 */
export function costText(cp: number | null): string {
  if (cp === null) return '—';
  const coins: [number, string][] = [
    [100, 'зм'],
    [10, 'см'],
    [1, 'мм'],
  ];
  const [size, name] = coins.find(([value]) => cp % value === 0) ?? [1, 'мм'];
  return `${(cp / size).toLocaleString('ru-RU')} ${name}`;
}

/** Вес: 0.25 → «0,25 фнт.»; неизвестный — «—». */
export function weightText(lb: number | null): string {
  return lb === null ? '—' : `${lb.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} фнт.`;
}

/** Эффект расходуемого предмета: «Восстанавливает 2к4 + 2 хита» (как на DnD.su). */
export function consumableEffectText(effect: UseRules['effects'][number]): string {
  const [dice, bonus] = effect.dice.split('+');
  const amount = bonus ? `${diceText(dice ?? '')} + ${bonus}` : diceText(dice ?? '');
  return `Восстанавливает ${amount} хита`;
}

/** «Действие, предмет расходуется». */
export function consumableActivationText(use: UseRules): string {
  const activation = use.activation === 'bonus_action' ? 'Бонусное действие' : 'Действие';
  return use.consumed ? `${activation}, предмет расходуется` : activation;
}

/** Краткая строка для списка: вид и главное число предмета. */
export function itemSummary(item: ItemListItem): string {
  const parts = [item.category ? categoryName(item.category) : kindName(item.kind)];
  const damage = damageText(item.damage);
  if (damage) parts.push(damage);
  if (item.armorClass) parts.push(`КД ${armorClassText(item.armorClass)}`);
  if (item.armorClassBonus !== null) parts.push(`КД +${item.armorClassBonus}`);
  if (item.quantity > 1) parts.push(`${item.quantity} шт.`);
  parts.push(item.costText ?? costText(item.costCp));
  return parts.join(' · ');
}
