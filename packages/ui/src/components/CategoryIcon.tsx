import type { Category } from '@koster/shared';

// Иконок на этапе 1 нет (Р13): заглушка — буква категории.
const LETTERS: Record<Category, string> = {
  spell: 'З',
  item: 'П',
  race: 'Р',
  skill: 'Н',
  language: 'Я',
  condition: 'С',
  background: 'Б',
};
const TITLES: Record<Category, string> = {
  spell: 'Заклинание',
  item: 'Предмет',
  race: 'Раса',
  skill: 'Навык',
  language: 'Язык',
  condition: 'Состояние',
  background: 'Предыстория',
};

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
