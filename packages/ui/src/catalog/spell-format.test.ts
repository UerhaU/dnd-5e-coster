import { describe, expect, it } from 'vitest';
import {
  classAccessText,
  classesText,
  componentsText,
  levelAndSchool,
  subclassesText,
  targetsText,
} from './spell-format';

describe('componentsText', () => {
  it('В, С, М с текстом материала', () => {
    expect(
      componentsText({
        verbal: true,
        somatic: true,
        material: { text: 'крошечный шарик из гуано летучей мыши и серы', recipe: null },
        royalty: null,
      }),
    ).toBe('В, С, М (крошечный шарик из гуано летучей мыши и серы)');
  });

  it('А — отдельной буквой с ценой, рядом с М', () => {
    expect(
      componentsText({
        verbal: false,
        somatic: true,
        material: { text: 'монетка', recipe: null },
        royalty: { text: '2 зм', costCp: 200 },
      }),
    ).toBe('С, М (монетка), А (2 зм)');
    expect(
      componentsText({
        verbal: true,
        somatic: true,
        material: null,
        royalty: { text: '1 зм', costCp: 100 },
      }),
    ).toBe('В, С, А (1 зм)');
  });
});

describe('подписи карточки', () => {
  it('уровень и школа, заговор, ритуал', () => {
    expect(levelAndSchool(3, 'evocation', false)).toBe('3 уровень, воплощение');
    expect(levelAndSchool(0, 'transmutation', false)).toBe('Заговор, преобразование');
    expect(levelAndSchool(1, 'divination', true)).toBe('1 уровень, прорицание (ритуал)');
  });

  it('классы по алфавиту, дополнительные TCE отдельно', () => {
    expect(
      classesText({ classes: ['class:wizard', 'class:bard'], optionalClasses: ['class:druid'] }),
    ).toBe('Бард, Волшебник, Друид (TCE)');
    expect(classesText({ classes: [], optionalClasses: [] })).toBe('—');
  });

  it('подклассы с классом', () => {
    expect(
      subclassesText({
        subclasses: [{ name: 'домен света', classId: 'class:cleric', dndsuId: 152 }],
      }),
    ).toBe('домен света (жрец)');
  });

  it('пометка доступа при фильтре по классу', () => {
    expect(classAccessText('subclass')).toBe('через подкласс');
    expect(classAccessText('optional')).toBe('доп. список TCE');
    expect(classAccessText('standard')).toBeNull();
    expect(classAccessText(null)).toBeNull();
  });

  it('число целей', () => {
    expect(targetsText({ targets: null })).toBeNull();
    expect(targetsText({ targets: { maxCount: 3, extraPerSlot: 1 } })).toBe(
      'до 3, +1 за каждый уровень ячейки выше',
    );
  });
});
