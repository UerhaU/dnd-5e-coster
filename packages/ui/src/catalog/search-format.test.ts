import { describe, expect, it } from 'vitest';
import { searchResultSummary } from './search-format';

describe('подписи поиска по каталогу', () => {
  const base = { nameRu: '', nameEn: '', spell: null, item: null, race: null };

  it('категория и короткое описание своей категории', () => {
    expect(
      searchResultSummary({
        ...base,
        id: 'spell:shield',
        category: 'spell',
        sources: ['PH14'],
        spell: { level: 1, school: 'abjuration' },
      }),
    ).toBe('Заклинание · 1 уровень, ограждение · PH14');
    expect(
      searchResultSummary({
        ...base,
        id: 'item:shield',
        category: 'item',
        sources: ['PH14'],
        item: { kind: 'shield', category: null },
      }),
    ).toBe('Снаряжение · Щит · PH14');
    expect(
      searchResultSummary({
        ...base,
        id: 'race:high-elf',
        category: 'race',
        sources: [],
        race: { kind: 'variant', variantOfName: 'Эльф' },
      }),
    ).toBe('Разновидность расы · «Эльф»');
  });
});
