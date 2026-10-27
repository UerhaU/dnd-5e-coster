import { describe, expect, it } from 'vitest';
import { entityIdSchema, slugFromName } from './entity.ts';
import { spellRulesSchema } from './spell-rules.ts';
import { textBlocksToPlain } from './text-blocks.ts';

describe('ID объекта (Р11)', () => {
  it.each([
    ['Fireball', 'fireball'],
    ["Tasha's Hideous Laughter", 'tashas-hideous-laughter'],
    ['Antipathy/sympathy', 'antipathy-sympathy'],
    ['Jim’s Glowing Coin', 'jims-glowing-coin'],
  ])('«%s» → %s', (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
    expect(entityIdSchema.safeParse(`spell:${slug}`).success).toBe(true);
  });

  it('отклоняет ID с пробелом или заглавными буквами', () => {
    expect(entityIdSchema.safeParse('spell:Fire ball').success).toBe(false);
  });
});

describe('spell-rules/v1', () => {
  it('принимает эффект урона со спасброском', () => {
    const rules = {
      schemaVersion: 'spell-rules/v1',
      effects: [
        {
          type: 'damage',
          dice: '8d6',
          damageType: 'fire',
          save: { ability: 'dex', onSuccess: 'half' },
        },
      ],
    };
    expect(spellRulesSchema.parse(rules)).toEqual(rules);
  });

  it('не пропускает неизвестное поле и русскую «к» в формуле', () => {
    const base = { schemaVersion: 'spell-rules/v1' };
    expect(
      spellRulesSchema.safeParse({ ...base, effects: [{ type: 'damage', foo: 1 }] }).success,
    ).toBe(false);
    expect(
      spellRulesSchema.safeParse({ ...base, effects: [{ type: 'damage', dice: '8к6' }] }).success,
    ).toBe(false);
  });
});

describe('textBlocksToPlain', () => {
  it('склеивает блоки в текст для поиска', () => {
    expect(
      textBlocksToPlain([
        { type: 'paragraph', text: 'Абзац.' },
        { type: 'list', ordered: false, items: ['один', 'два'] },
        { type: 'table', caption: null, header: ['А', 'Б'], rows: [['1', '2']] },
      ]),
    ).toBe('Абзац.\n\nодин\nдва\n\nА | Б\n1 | 2');
  });
});
