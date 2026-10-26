import { describe, expect, it } from 'vitest';
import { DATABASE_FILES } from './index';

describe('@koster/db', () => {
  it('разделяет каталог и данные пользователя по разным файлам', () => {
    expect(DATABASE_FILES.catalog).not.toBe(DATABASE_FILES.user);
  });
});
