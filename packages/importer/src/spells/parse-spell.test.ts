import { spellDataSchema } from '@koster/shared';
import { describe, expect, it } from 'vitest';
import { fixturePage, fixtures, fixtureSpell } from './fixtures.test-helpers.ts';
import { PageParseError, parseSpellPage } from './parse-page.ts';

// Тесты парсера на сохранённых страницах DnD.su (раздел 6, раздел 9).
// Каждый тест — отдельный трудный случай; список случаев — в make-spell-fixtures.ts.

describe('разбор страниц заклинаний DnD.su', () => {
  it('все тестовые страницы разбираются и проходят схему spell/v1', () => {
    expect(fixtures.list.cards.length).toBeGreaterThanOrEqual(10);
    for (const card of fixtures.list.cards) {
      const { spell } = fixtureSpell(card.siteId);
      expect(spellDataSchema.safeParse(spell.data).success, spell.id).toBe(true);
    }
  });

  it('Огненный шар: базовые поля, ID по Р11, ссылка на PH24 — не источник', () => {
    const page = fixturePage(205);
    expect(page.sources).toEqual([{ code: 'PH14', title: "Player's Handbook" }]);
    expect(page.otherEditions).toEqual([
      expect.objectContaining({ code: 'PH24', url: 'https://next.dnd.su/spells/10514-fireball' }),
    ]);

    const { spell, issues } = fixtureSpell(205);
    expect(issues).toEqual([]);
    expect(spell.id).toBe('spell:fireball');
    expect(spell.nameRu).toBe('Огненный шар');
    expect(spell.sources.map((source) => source.dndsuSourceId)).toEqual([102]);
    expect(spell.data).toMatchObject({
      level: 3,
      school: 'evocation',
      ritual: false,
      concentration: false,
      castingTime: { options: [{ amount: 1, unit: 'action' }], reactionTrigger: null },
      range: { kind: 'distance', feet: 150, area: null },
      components: {
        verbal: true,
        somatic: true,
        material: { text: 'крошечный шарик из гуано летучей мыши и серы' },
        royalty: null,
      },
      duration: { options: [{ kind: 'instantaneous' }], upTo: false },
      classes: ['class:wizard', 'class:sorcerer'],
      damageTypes: ['fire'],
    });
    expect(spell.data.subclasses).toContainEqual({
      name: 'домен света',
      classId: 'class:cleric',
      dndsuId: 152,
    });
    expect(spell.data.higherLevels).toEqual([
      {
        type: 'paragraph',
        text: expect.stringMatching(/^Если вы накладываете это заклинание, используя ячейку 4-го/),
      },
    ]);
  });

  it('Адское возмездие: условие реакции отдельно от времени', () => {
    const { castingTime } = fixtureSpell(1).spell.data;
    expect(castingTime.options).toEqual([{ amount: 1, unit: 'reaction' }]);
    expect(castingTime.reactionTrigger).toBe(
      'когда вы получаете урон от существа, находящегося в пределах 60 футов от вас и видимого вами',
    );
  });

  it('Антипатия/симпатия: класс с меткой TCE — в дополнительном списке', () => {
    const { data } = fixtureSpell(2).spell;
    expect(data.optionalClasses).toEqual(['class:bard']);
    expect(data.classes).not.toContain('class:bard');
    expect(data.castingTime.options).toEqual([{ amount: 1, unit: 'hour' }]);
  });

  it('Обнаружение магии: ритуал и концентрация «вплоть до»', () => {
    const { data } = fixtureSpell(195).spell;
    expect(data.ritual).toBe(true);
    expect(data.concentration).toBe(true);
    expect(data.duration).toMatchObject({
      options: [{ kind: 'timed', amount: 10, unit: 'minute' }],
      upTo: true,
    });
  });

  it('Рост растений и Власть над огнём: варианты через «или»', () => {
    expect(fixtureSpell(304).spell.data.castingTime.options).toEqual([
      { amount: 1, unit: 'action' },
      { amount: 8, unit: 'hour' },
    ]);
    expect(fixtureSpell(374).spell.data.duration.options).toEqual([
      { kind: 'instantaneous', amount: null, unit: null },
      { kind: 'timed', amount: 1, unit: 'hour' },
    ]);
  });

  it('Власть над огнём: два источника, по одному номеру DnD.su на каждый', () => {
    const { spell } = fixtureSpell(374);
    expect(spell.sources.map((source) => source.code)).toEqual(['XGE', 'POA']);
    expect(spell.sources.map((source) => source.dndsuSourceId)).toEqual([109, 107]);
  });

  it('области: конус на себя, полусфера, мили в футах', () => {
    expect(fixtureSpell(203).spell.data.range).toMatchObject({
      kind: 'self',
      area: { shape: 'cone', feet: 15 },
    });
    expect(fixtureSpell(143).spell.data.range).toMatchObject({
      kind: 'self',
      area: { shape: 'hemisphere', feet: 10 },
    });
    expect(fixtureSpell(22).spell.data.range).toMatchObject({
      kind: 'self',
      area: { shape: 'radius', feet: 5 * 5280 },
    });
  });

  it('Разбрасывание карт: конус без «на себя» — вид дистанции null и строка в отчёте', () => {
    const { spell, issues } = fixtureSpell(4664);
    expect(spell.data.range).toEqual({
      text: '15-футовый конус',
      kind: null,
      feet: null,
      area: { shape: 'cone', feet: 15 },
    });
    expect(issues).toEqual([expect.objectContaining({ field: 'range', severity: 'warning' })]);
    expect(spell.data.higherLevels).toHaveLength(1);
  });

  it('Падение пёрышком: «ё» в названии сохраняется', () => {
    const { spell } = fixtureSpell(223);
    expect(spell.nameRu).toBe('Падение пёрышком');
    expect(spell.id).toBe('spell:feather-fall');
  });

  it('Наблюдение и Власть над погодой: таблицы и заголовки — блоками', () => {
    const scrying = fixtureSpell(176).spell.data.description;
    expect(scrying).toContainEqual({
      type: 'table',
      caption: null,
      header: ['Знание', 'Модификатор спасброска'],
      rows: expect.arrayContaining([['Знакомые (вы хорошо знаете цель)', '-5']]),
    });
    const weather = fixtureSpell(22).spell.data.description;
    expect(weather).toContainEqual({ type: 'heading', text: 'Осадки' });
  });

  it('Божественное слово: список в описании', () => {
    const blocks = fixtureSpell(12).spell.data.description;
    expect(blocks.some((block) => block.type === 'list' && block.items.length >= 3)).toBe(true);
  });

  it('Иссушающий укол: дюнамантия, классов нет, только подклассы', () => {
    const { data } = fixtureSpell(2441).spell;
    expect(data.tags).toEqual(['dunamancy']);
    expect(data.classes).toEqual([]);
    expect(data.subclasses.map((subclass) => subclass.classId)).toEqual([
      'class:wizard',
      'class:wizard',
    ]);
  });

  it('Кодировка мыслей: нет ни классов, ни подклассов — пустые списки, не догадка', () => {
    const { data } = fixtureSpell(741).spell;
    expect(data.classes).toEqual([]);
    expect(data.subclasses).toEqual([]);
  });

  it('Волшебная стрела Джима: компонент А с ценой, цитата с подписью', () => {
    const { data } = fixtureSpell(2341).spell;
    expect(data.components.royalty).toEqual({ text: '1 зм', costCp: 100 });
    expect(data.components.material).toBeNull();
    expect(data.description[0]).toMatchObject({ type: 'quote', attribution: '— Джим Темномаг' });
    expect(data.description).toContainEqual({
      type: 'heading',
      text: 'Компонент авторских отчислений (А)',
    });
  });

  it('Сверкающая монета Джима: компоненты М и А, у каждого своё пояснение', () => {
    expect(fixtureSpell(2340).spell.data.components).toEqual({
      verbal: false,
      somatic: true,
      material: { text: 'монетка', recipe: null },
      royalty: { text: '2 зм', costCp: 200 },
    });
  });

  it('Крошечный слуга: абзац после «На больших уровнях» остаётся в описании', () => {
    const { data } = fixtureSpell(474).spell;
    expect(data.higherLevels).toHaveLength(1);
    expect(data.description.at(-1)).toEqual({
      type: 'paragraph',
      text: 'Бестиарий: Крошечный слуга',
    });
  });

  it('врезка additionalInfo раскрывается в заголовок и абзацы', () => {
    const blocks = fixtureSpell(137).spell.data.description;
    expect(blocks.some((block) => block.type === 'heading' && /TASHA/.test(block.text))).toBe(true);
  });

  it('страница без карточки — понятная ошибка, а не пустой объект', () => {
    expect(() => parseSpellPage('<html><body>404</body></html>')).toThrow(PageParseError);
  });
});
