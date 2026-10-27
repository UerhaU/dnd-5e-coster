import type { Category } from '@koster/shared';

// Иконок на этапе 1 нет (Р13): заглушка — буква категории.
const LETTERS: Record<Category, string> = { spell: 'З', item: 'П' };
const TITLES: Record<Category, string> = { spell: 'Заклинание', item: 'Предмет' };

export function CategoryIcon({ category, large = false }: { category: Category; large?: boolean }) {
  return (
    <span
      className={large ? 'category-icon category-icon--large' : 'category-icon'}
      title={TITLES[category]}
      aria-hidden="true"
    >
      {LETTERS[category]}
    </span>
  );
}
