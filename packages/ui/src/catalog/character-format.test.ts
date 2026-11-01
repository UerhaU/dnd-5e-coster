import { describe, expect, it } from 'vitest';
import { coinsText, mixedText, prerequisitesText, proficienciesText } from './character-format';

const names = new Map([
  ['skill:athletics', 'Атлетика'],
  ['feat:strike-of-the-giants', 'Удар великанов'],
  ['race:dwarf', 'Дварф'],
]);

describe('подписи механики предысторий и черт', () => {
  it('требования: группы через «;», в группе — «или»', () => {
    expect(
      prerequisitesText(
        [
          [{ kind: 'level', min: 4 }],
          [{ kind: 'feat', id: 'feat:strike-of-the-giants', option: 'Огненный удар' }],
        ],
        names,
      ),
    ).toBe('4 уровень; Удар великанов (Огненный удар)');
    expect(
      prerequisitesText(
        [
          [
            { kind: 'race', id: 'race:dwarf' },
            { kind: 'size', size: 'small' },
          ],
        ],
        names,
      ),
    ).toBe('Дварф или размер маленький');
    expect(prerequisitesText([], names)).toBeNull();
  });

  it('владения и смешанный выбор', () => {
    expect(
      proficienciesText({ fixed: ['skill:athletics'], choices: [{ count: 1, from: null }] }, names),
    ).toBe('Атлетика; 1 на выбор (любые)');
    expect(
      mixedText(
        [
          {
            count: 3,
            from: [
              { kind: 'skill', id: null },
              { kind: 'tool', id: null },
            ],
          },
        ],
        names,
      ),
    ).toBe('3 на выбор в любой комбинации: любой навык, любой инструмент');
  });

  it('деньги — самой крупной монетой без остатка', () => {
    expect(coinsText(1500)).toBe('15 зм');
    expect(coinsText(5)).toBe('5 мм');
    expect(coinsText(null)).toBeNull();
  });
});
