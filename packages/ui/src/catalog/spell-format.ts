import {
  CLASS_NAMES_RU,
  DAMAGE_TYPES,
  MAGIC_SCHOOLS,
  type Automation,
  type ClassId,
  type MagicSchoolId,
  type ReviewStatus,
  type SpellComponents,
  type SpellData,
} from '@koster/shared';

// Подписи для экранов каталога. Только функции без React: их проще проверить тестами.

export function schoolName(school: MagicSchoolId): string {
  return MAGIC_SCHOOLS.find((entry) => entry.id === school)?.nameRu ?? school;
}

export function className(classId: ClassId): string {
  return CLASS_NAMES_RU[classId];
}

export function damageTypeName(id: string): string {
  return DAMAGE_TYPES.find((entry) => entry.id === id)?.nameRu ?? id;
}

export function levelText(level: number): string {
  return level === 0 ? 'Заговор' : `${level} уровень`;
}

/** «3 уровень, воплощение» или «Заговор, преобразование»; с пометкой ритуала. */
export function levelAndSchool(level: number, school: MagicSchoolId, ritual: boolean): string {
  const text = `${levelText(level)}, ${schoolName(school).toLowerCase()}`;
  return ritual ? `${text} (ритуал)` : text;
}

/**
 * Компоненты как на DnD.su: «В, С, М (шарик из гуано), А (2 зм)».
 * А — авторские отчисления: отдельная буква со своей ценой, не часть М.
 */
export function componentsText(components: SpellComponents): string {
  const parts: string[] = [];
  if (components.verbal) parts.push('В');
  if (components.somatic) parts.push('С');
  if (components.material) parts.push(`М (${components.material.text})`);
  if (components.royalty) parts.push(`А (${components.royalty.text})`);
  return parts.length > 0 ? parts.join(', ') : 'нет';
}

/** Классы: обычные, затем дополнительные из TCE с пометкой. */
export function classesText(data: Pick<SpellData, 'classes' | 'optionalClasses'>): string {
  const standard = data.classes.map(className).sort((a, b) => a.localeCompare(b, 'ru'));
  const optional = data.optionalClasses
    .filter((id) => !data.classes.includes(id))
    .map((id) => `${className(id)} (TCE)`)
    .sort((a, b) => a.localeCompare(b, 'ru'));
  const all = [...standard, ...optional];
  return all.length > 0 ? all.join(', ') : '—';
}

export function subclassesText(data: Pick<SpellData, 'subclasses'>): string {
  return data.subclasses.length > 0
    ? data.subclasses
        .map((item) => `${item.name} (${className(item.classId).toLowerCase()})`)
        .join(', ')
    : '—';
}

export function targetsText(data: Pick<SpellData, 'targets'>): string | null {
  if (!data.targets) {
    return null;
  }
  const { maxCount, extraPerSlot } = data.targets;
  return extraPerSlot > 0
    ? `до ${maxCount}, +${extraPerSlot} за каждый уровень ячейки выше`
    : `до ${maxCount}`;
}

export const REVIEW_STATUS_TEXT: Record<ReviewStatus, string> = {
  raw: 'Сырые данные',
  parsed: 'Разобрано автоматически',
  reviewed: 'Проверено вручную',
  rules_verified: 'Механика проверена',
};

export const AUTOMATION_TEXT: Record<Automation, string> = {
  full: 'Применяется автоматически',
  assisted: 'С подсказками',
  display_only: 'Только описание',
};
