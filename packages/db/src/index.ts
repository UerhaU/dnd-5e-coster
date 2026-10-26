// Заготовка пакета. Схемы и миграции появятся на этапе 1.

/** Два файла базы (Р21): каталог из релиза и данные пользователя в `data/`. */
export const DATABASE_FILES = {
  catalog: 'catalog.db',
  user: 'user.db',
} as const;
