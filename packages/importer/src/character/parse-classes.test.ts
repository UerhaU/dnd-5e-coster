import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import { collectClasses, loadSubclassNames } from './collect-classes.ts';
import { parseEquipmentLine, tableValue, type ClassLookup } from './normalize-class.ts';

const folder = path.join(DEFAULT_PATHS.characterFixtures, 'classes');

const lookup: ClassLookup = {
  items: new Map([
    ['секира', 'item:greataxe'],
    ['булава', 'item:mace'],
    ['кольчуга', 'item:chain-mail'],
    ['длинный лук', 'item:longbow'],
  ]),
  spellsByPage: new Map(),
};

function collect() {
  const issues: ImportIssue[] = [];
  const result = collectClasses(
    openArticleCache(folder),
    lookup,
    loadSubclassNames(DEFAULT_PATHS.reviewedCharacter),
    issues,
    { knownSources: [], reportUnusedNames: false },
  );
  const get = <C extends 'class' | 'subclass'>(id: string, category: C) => {
    const entity = result.entities.find((candidate) => candidate.id === id);
    if (!entity || entity.category !== category) throw new Error(`нет ${id}`);
    return entity as Extract<(typeof result.entities)[number], { category: C }>;
  };
  return { ...result, issues, get };
}

describe('классы (тестовые страницы)', () => {
  it('собирает все страницы без ошибок; таблица — 20 строк', () => {
    const { stats, issues, entities } = collect();
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(stats.classes).toBe(8);
    expect(stats.subclasses).toBe(77);
    for (const entity of entities) {
      if (entity.category === 'class') {
        expect(entity.rules.table).toHaveLength(20);
        expect(
          entity.data.table.rows.every((row) => row.length === entity.data.table.header.length),
        ).toBe(true);
      }
    }
  });

  it('варвар: хиты, владения, таблица, мультикласс', () => {
    const barbarian = collect().get('class:barbarian', 'class');
    const r = barbarian.rules;
    expect([r.hitDie, r.hitPointsFirstLevel, r.hitPointsPerLevel]).toEqual([12, 12, 7]);
    expect(r.savingThrows).toEqual(['str', 'con']);
    expect(r.proficiencies.armor).toEqual(['light', 'medium', 'shield']);
    expect(r.proficiencies.weapons.categories).toEqual(['simple', 'martial']);
    expect(r.proficiencies.skills).toEqual([
      { count: 2, from: expect.arrayContaining(['skill:athletics', 'skill:survival']) },
    ]);
    expect(r.table[0]).toMatchObject({
      level: 1,
      proficiencyBonus: 2,
      features: ['unarmored-defense', 'rage'],
      values: { rages: 2, rageDamage: 2 },
    });
    expect(r.table[19]?.values).toEqual({ rages: 'unlimited', rageDamage: 4 });
    expect(r.subclass).toEqual({
      nameRu: 'Путь дикости',
      featureKey: 'primal-path',
      level: 3,
      featureLevels: [3, 6, 10, 14],
    });
    expect(r.multiclass.requirements).toEqual([[{ ability: 'str', min: 13 }]]);
    expect(r.multiclass.proficiencies.armor).toEqual(['shield']);
    expect(r.startingGold).toEqual({ dice: '2d4', multiplier: 10 });
    expect(r.spellcasting).toBeNull();
    // Опциональные умения TCE — вариант правил (Р74).
    const knowledge = barbarian.data.features.find((feature) => feature.key === 'primal-knowledge');
    expect(knowledge?.optionalRule).toBe(true);
    expect(barbarian.data.features.find((feature) => feature.key === 'rage')?.optionalRule).toBe(
      false,
    );
    expect(barbarian.data.features.find((feature) => feature.key === 'ASI')?.levels).toEqual([
      4, 8, 12, 16, 19,
    ]);
    expect(barbarian.links).toContainEqual({ toId: 'item:greataxe', kind: 'starting_equipment' });
  });

  it('подкласс: subclass_of, источник по строке «Источник» или книге класса', () => {
    const { get } = collect();
    const berserker = get('subclass:barbarian-berserker', 'subclass');
    expect(berserker.nameEn).toBe('Path of the Berserker');
    expect(berserker.rules.subclassOf).toBe('class:barbarian');
    expect(berserker.links).toContainEqual({ toId: 'class:barbarian', kind: 'subclass_of' });
    expect(berserker.sources[0]?.source.code).toBe('PH14');
    expect(berserker.data.features.map((feature) => feature.levels[0])).toEqual([3, 6, 10, 14]);
    expect(get('subclass:barbarian-wild-magic', 'subclass').sources[0]?.source.code).toBe('TCE');
    expect(get('subclass:barbarian-battlerager', 'subclass').sources[0]?.source.code).toBe('SCAG');
  });

  it('книга подкласса — из «Источник» в начале раздела (ручная проверка: 9 случаев, BPGG)', () => {
    const { get } = collect();
    const book = (id: string) => get(id, 'subclass').sources[0]?.source.code;
    // Голый <strong> без <p>, дальше текст.
    expect(book('subclass:cleric-death')).toBe('DMG14');
    expect(book('subclass:cleric-twilight')).toBe('TCE');
    expect(book('subclass:ranger-drakewarden')).toBe('FTD');
    // Точка после кавычки: «Источник: «Xanathar’s Guide to Everything».»
    expect(book('subclass:paladin-redemption')).toBe('XGE');
    expect(book('subclass:paladin-conquest')).toBe('XGE');
    expect(book('subclass:sorcerer-divine-soul')).toBe('XGE');
    expect(book('subclass:sorcerer-shadow')).toBe('XGE');
    expect(book('subclass:sorcerer-storm')).toBe('XGE');
    // «Источник» TCE у вложенного раздела «Спутники повелителя зверей» — не книга подкласса.
    expect(book('subclass:ranger-beast-master')).toBe('PH14');
    expect(book('subclass:paladin-oathbreaker')).toBe('DMG14');
    // Р79: один код книги Bigby.
    expect(book('subclass:barbarian-giant')).toBe('BPGG');
  });

  it('жрец: ячейки 1–9, заклинательная характеристика, домены — списки заклинаний', () => {
    const { get } = collect();
    const cleric = get('class:cleric', 'class');
    expect(cleric.rules.spellcasting).toEqual({
      ability: 'wis',
      progression: 'full',
      featureKey: 'spellcasting',
    });
    expect(cleric.rules.table[0]?.spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(cleric.rules.table[19]?.spellSlots).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(cleric.rules.subclass.level).toBe(1);
    expect(cleric.rules.proficiencies.armor).toEqual(['light', 'medium', 'shield']);
    // «Дополнительные заклинания жреца» (TCE) — без якоря на странице, ключ как у других классов.
    expect(
      cleric.data.features.find((feature) => feature.nameRu === 'Дополнительные заклинания жреца'),
    ).toMatchObject({ key: 'extra-spells', optionalRule: true });
    // Строка 8: «Умение божественного домена» и «Благословлённые удары» (TCE) — подряд без запятой.
    expect(cleric.data.table.rows[7]?.[2]).toBe(
      'Увеличение характеристик, Уничтожение Нежити (ПО 1), Умение божественного домена, Благословленные удары',
    );
    expect(cleric.rules.table[7]?.features).toEqual([
      'ASI',
      'destroy-undead',
      'divine-domain',
      'blessed-strikes',
    ]);
  });

  it('ключи особенностей — без опечаток якорей сайта (Р80)', () => {
    const { get } = collect();
    const keys = (id: string) => get(id, 'class').data.features.map((feature) => feature.key ?? '');
    expect(keys('class:warlock')).toContain('otherworldly-patron');
    expect(keys('class:barbarian')).toContain('unarmored-defense');
    expect(keys('class:monk')).toContain('unarmored-defense');
    const all = ['class:warlock', 'class:barbarian', 'class:monk'].flatMap(keys);
    expect(all.filter((key) => /defence|otherwordly/.test(key))).toEqual([]);
    expect(get('class:warlock', 'class').rules.subclass.featureKey).toBe('otherworldly-patron');
  });

  it('воин: списки вариантов, мистический рыцарь — заклинатель на треть', () => {
    const { get } = collect();
    const fighter = get('class:fighter', 'class');
    expect(fighter.data.options.map((list) => list.name)).toContain('Боевые приёмы');
    const knight = get('subclass:fighter-eldritch-knight', 'subclass');
    expect(knight.rules.spellcasting).toEqual({
      ability: 'int',
      progression: 'third',
      featureKey: null,
    });
    expect(knight.rules.spellTable?.at(-1)).toEqual({
      level: 20,
      values: { cantripsKnown: 3, spellsKnown: 13 },
      spellSlots: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    });
  });

  it('монах: кость и футы в таблице, два условия мультикласса, смешанный выбор инструмента', () => {
    const monk = collect().get('class:monk', 'class');
    expect(monk.rules.table[0]?.values).toEqual({
      martialArts: '1d4',
      kiPoints: null,
      unarmoredMovement: null,
    });
    expect(monk.rules.table[19]?.values).toEqual({
      martialArts: '1d10',
      kiPoints: 20,
      unarmoredMovement: 30,
    });
    expect(monk.rules.multiclass.requirements).toHaveLength(2);
    expect(monk.rules.proficiencies.mixed).toEqual([
      {
        count: 1,
        from: [
          { kind: 'tool_group', group: 'artisans_tools' },
          { kind: 'tool_group', group: 'musical_instrument' },
        ],
      },
    ]);
    expect(monk.rules.startingGold).toEqual({ dice: '5d4', multiplier: 1 });
  });

  it('колдун: магия договора, воззвания, расширенные списки по уровню заклинания', () => {
    const { get } = collect();
    const warlock = get('class:warlock', 'class');
    expect(warlock.rules.spellcasting?.progression).toBe('pact');
    expect(warlock.rules.table[19]?.values).toMatchObject({
      pactSlots: 4,
      pactSlotLevel: 5,
      invocationsKnown: 8,
    });
    expect(warlock.rules.table[0]?.spellSlots).toBeNull();
    expect(warlock.data.options.map((list) => list.name)).toContain('Таинственные воззвания');
    const fiend = get('subclass:warlock-fiend', 'subclass');
    // Заклинаний тестового каталога здесь нет: списки пустые, предупреждения — в отчёте.
    expect(fiend.rules.spellLists).toEqual([]);
  });
});

describe('разбор значений', () => {
  it('ячейки таблицы', () => {
    expect(tableValue('+2')).toBe(2);
    expect(tableValue('1к6')).toBe('1d6');
    expect(tableValue('+10 фт.')).toBe(10);
    expect(tableValue('3-й')).toBe(3);
    expect(tableValue('—')).toBeNull();
    expect(tableValue('Неограниченно')).toBe('unlimited');
    expect(() => tableValue('много')).toThrow();
  });

  it('строка снаряжения: варианты, количество, группы', () => {
    const line = parseEquipmentLine(
      'а) кольчуга или б) кожаный доспех, длинный лук и 20 стрел',
      lookup,
    );
    expect(
      line.options.map((option) => option.parts.map((part) => [part.itemId, part.quantity])),
    ).toEqual([
      [['item:chain-mail', 1]],
      [
        ['item:leather-armor', 1],
        ['item:longbow', 1],
        ['item:arrows', 20],
      ],
    ]);
    const groups = parseEquipmentLine(
      'а) воинское оружие и щит или б) два воинских оружия',
      lookup,
    );
    expect(groups.options[1]?.parts).toEqual([
      { text: 'два воинских оружия', itemId: null, group: 'martial_weapon', quantity: 2 },
    ]);
    const quiver = parseEquipmentLine('Длинный лук и колчан с 20 стрелами', lookup);
    expect(quiver.options[0]?.parts.map((part) => part.itemId)).toEqual([
      'item:longbow',
      'item:quiver',
      'item:arrows',
    ]);
  });
});
