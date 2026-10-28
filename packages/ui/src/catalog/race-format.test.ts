import { describe, expect, it } from 'vitest';
import {
  abilityScoresText,
  ageText,
  heightText,
  languagesText,
  randomBodyText,
  raceSummary,
  skillsText,
  speedText,
  toolsText,
  weightText,
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

describe('рост, вес, возраст, инструменты (Р69)', () => {
  const body = {
    adultAge: 50,
    lifespan: 350,
    heightIn: { min: 48, max: 60 },
    weightLb: { min: 150, max: 150 },
    random: {
      baseHeightIn: 56,
      heightDice: { count: 2, sides: 8 },
      baseWeightLb: 100,
      weightDice: { count: 2, sides: 4 },
    },
  };

  it('возраст, рост и вес с метрическими значениями', () => {
    expect(ageText(body)).toBe('зрелость — 50 лет, жизнь — 350 лет');
    expect(ageText({ ...body, adultAge: 1, lifespan: null })).toBe('зрелость — 1 год');
    expect(heightText(body)).toBe('4 фт. – 5 фт. (122 – 152 см)');
    expect(heightText({ ...body, heightIn: { min: null, max: 78 } })).toBe(
      'до 6 фт. 6 дюйм. (до 198 см)',
    );
    expect(weightText(body)).toBe('около 150 фнт. (около 68 кг)');
    expect(randomBodyText(body)).toBe(
      'рост 4 фт. 8 дюйм. + 2к8 дюйм., вес 100 фнт. + (2к8 × 2к4) фнт.; 2к8 — один бросок для роста и веса',
    );
    expect(ageText({ ...body, adultAge: null, lifespan: null })).toBeNull();
  });

  it('инструменты: фиксированные, выбор из списка, из группы', () => {
    const names = new Map([
      ['item:tinkers-tools', 'Инструменты ремонтника'],
      ['item:smiths-tools', 'Инструменты кузнеца'],
    ]);
    expect(
      toolsText(
        {
          fixed: ['item:tinkers-tools'],
          choices: [
            { count: 1, from: ['item:smiths-tools', 'item:masons-tools'], group: null },
            { count: 1, from: null, group: 'musical_instrument' },
            { count: 2, from: null, group: null },
          ],
        },
        names,
      ),
    ).toBe(
      'Инструменты ремонтника; 1 на выбор из: Инструменты кузнеца, item:masons-tools; 1 на выбор (музыкальный инструмент); 2 на выбор (любые)',
    );
    expect(toolsText({ fixed: [], choices: [] }, names)).toBeNull();
  });
});
