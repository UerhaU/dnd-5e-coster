import { describe, expect, it } from 'vitest';
import {
  abilityScoresText,
  languagesText,
  raceSummary,
  skillsText,
  speedText,
} from './race-format';

describe('подписи рас', () => {
  it('увеличение характеристик: фиксированное, на выбор, варианты', () => {
    expect(
      abilityScoresText([
        {
          fixed: [{ ability: 'cha', amount: 2 }],
          choices: [{ count: 2, amount: 1, from: null, except: ['cha'] }],
        },
      ]),
    ).toBe('Хар +2, +1 к 2 характеристикам на выбор (кроме Хар)');
    expect(
      abilityScoresText([
        { fixed: [], choices: [{ count: 1, amount: 2, from: null, except: [] }] },
        { fixed: [], choices: [{ count: 3, amount: 1, from: null, except: [] }] },
      ]),
    ).toBe('+2 к одной на выбор; или +1 к 3 характеристикам на выбор');
    expect(abilityScoresText([])).toBeNull();
    expect(abilityScoresText(null)).toBe('не разобрано, см. текст');
  });

  it('скорость, навыки, языки', () => {
    expect(speedText({ walk: 30, fly: 'walk', swim: 30, climb: null, burrow: null })).toBe(
      '30 фт., полёт как ходьба, плавание 30 фт.',
    );
    expect(speedText({ walk: null, fly: null, swim: null, climb: null, burrow: null })).toBeNull();
    expect(skillsText({ fixed: ['perception'], choices: [{ count: 2, from: null }] })).toBe(
      'Восприятие; 2 на выбор',
    );
    expect(languagesText({ fixed: ['common', 'elvish'], choose: 1 })).toBe(
      'Общий, Эльфийский, ещё 1 на выбор',
    );
  });

  it('строка списка разновидности', () => {
    expect(
      raceSummary({
        id: 'race:drow',
        nameRu: 'Тёмный эльф (дроу)',
        nameEn: 'Drow',
        kind: 'variant',
        variantOf: 'race:elf',
        variantOfName: 'Эльф',
        size: null,
        speedWalkFt: null,
        flying: false,
        darkvisionFt: 120,
        sources: ['PH14'],
        reviewStatus: 'parsed',
      }),
    ).toBe('разновидность: Эльф · тёмное зрение 120 фт.');
  });
});
