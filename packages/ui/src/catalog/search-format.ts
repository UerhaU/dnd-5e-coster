import { CATEGORY_NAMES_RU, type SearchResultItem } from '@koster/shared';
import { categoryName, kindName } from './item-format';
import { levelAndSchool } from './spell-format';

// Подписи результатов поиска по всему каталогу (Р54).

/** Категория в единственном числе: пометка у результата. */
const CATEGORY_LABELS: Record<SearchResultItem['category'], string> = {
  spell: 'Заклинание',
  item: 'Снаряжение',
  race: 'Раса',
};

export function categoryLabel(category: SearchResultItem['category']): string {
  return CATEGORY_LABELS[category];
}

/** «Расы: 3» для счётчиков по категориям. */
export function categoryCountText(entry: { id: SearchResultItem['category']; count: number }) {
  return `${CATEGORY_NAMES_RU[entry.id]}: ${entry.count}`;
}

/** «Заклинание · 3 уровень, воплощение», «Разновидность расы · «Эльф»». */
export function searchResultSummary(item: SearchResultItem): string {
  const detail = item.spell
    ? levelAndSchool(item.spell.level, item.spell.school, false)
    : item.item
      ? item.item.category
        ? categoryName(item.item.category)
        : kindName(item.item.kind)
      : item.race?.variantOfName
        ? `«${item.race.variantOfName}»`
        : null;
  const label = item.race?.kind === 'variant' ? 'Разновидность расы' : categoryLabel(item.category);
  return [label, detail, item.sources.join(', ') || null]
    .filter((part) => part !== null)
    .join(' · ');
}
