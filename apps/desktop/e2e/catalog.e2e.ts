import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { launchBuiltApp, type RunningApp } from './app';

// Сценарий этапа 1: «Справочник» → поиск «огнен» → карточка «Огненного шара».
// Огненный шар есть и в полном каталоге, и в тестовом (data/fixtures), поэтому
// сценарий проходит в zip из CI и в программе автора.

let running: RunningApp;

test.beforeAll(async () => {
  running = await launchBuiltApp();
});

test.afterAll(async () => {
  await running?.close();
});

test('справочник: найти «Огненный шар» по «огнен» и открыть карточку', async () => {
  const { window } = running;

  await expect(window.getByRole('heading', { name: 'Костёр' })).toBeVisible();
  await expect(window.getByTestId('health-status')).toContainText('Сервер работает');
  // Остальные пункты меню видны, но неактивны.
  await expect(window.getByText('Мои персонажи')).toBeVisible();
  await expect(window.getByRole('link', { name: 'Мои персонажи' })).toHaveCount(0);

  await window.getByRole('link', { name: 'Справочник' }).click();
  await window.getByRole('link', { name: /Заклинания/ }).click();

  await window.getByRole('searchbox', { name: 'Поиск заклинаний' }).fill('огнен');
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  const fireball = results.getByRole('link', { name: /Огненный шар/ });
  await expect(fireball).toBeVisible();

  await fireball.click();
  await expect(window.getByRole('heading', { level: 1, name: 'Огненный шар' })).toBeVisible();
  await expect(window.getByTestId('spell-level-school')).toHaveText('3 уровень, воплощение');
  await expect(window.getByTestId('spell-components')).toContainText('В, С, М (');

  // Назад — к тому же списку с тем же запросом.
  await window.getByRole('button', { name: '← К списку' }).click();
  await expect(window.getByRole('searchbox', { name: 'Поиск заклинаний' })).toHaveValue('огнен');
});

// Сценарий этапа 2: скрытые по умолчанию компоненты (Р70), затем
// «Снаряжение» → фильтр «Воинское рукопашное» → поиск «меч» →
// карточка «Длинного меча» с уроном и свойствами. Есть в обоих каталогах.
test('справочник: компоненты по фильтру вида, найти «Длинный меч» и открыть карточку', async () => {
  const { window } = running;

  // Прошлый сценарий закончился в списке заклинаний.
  await window.getByRole('link', { name: '← Справочник' }).click();
  await window.getByRole('link', { name: /Снаряжение/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Снаряжение' })).toBeVisible();

  const search = window.getByRole('searchbox', { name: 'Поиск снаряжения' });
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  const kind = window.getByRole('combobox', { name: 'Вид', exact: true });
  await expect(results).toBeVisible();
  await expect(results.getByRole('link', { name: /Компонент заклинания/ })).toHaveCount(0);
  await search.fill('Гуано летучей мыши');
  await expect(window.getByTestId('result-count')).toHaveText('Найдено: 0');
  await expect(results.getByRole('link')).toHaveCount(0);

  await kind.selectOption('spell_component');
  await expect(window.getByTestId('result-count')).toHaveText('Найдено: 1');
  await results.getByRole('link', { name: /Гуано летучей мыши/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Гуано летучей мыши' })).toBeVisible();
  await expect(window.getByTestId('item-kind')).toHaveText('Компонент заклинания');

  await window.getByRole('button', { name: '← К списку' }).click();
  await expect(kind).toHaveValue('spell_component');
  await kind.selectOption('');
  await expect(window.getByTestId('result-count')).toHaveText('Найдено: 0');
  await expect(results.getByRole('link')).toHaveCount(0);

  await window.getByLabel('Группа').selectOption('martial_melee');
  await search.fill('меч');
  const longsword = results.getByRole('link', { name: /Длинный меч/ });
  await expect(longsword).toBeVisible();
  await expect(longsword).toContainText('1к8 рубящий');

  await longsword.click();
  await expect(window.getByRole('heading', { level: 1, name: 'Длинный меч' })).toBeVisible();
  await expect(window.getByTestId('item-kind')).toHaveText('Воинское рукопашное оружие');
  await expect(window.getByTestId('item-damage')).toHaveText('1к8 рубящий');
  await expect(window.getByText('Универсальное (1к10)')).toBeVisible();

  await window.getByRole('button', { name: '← К списку' }).click();
  await expect(window.getByRole('searchbox', { name: 'Поиск снаряжения' })).toHaveValue('меч');
  await expect(window.getByLabel('Группа')).toHaveValue('martial_melee');
});

// Доделки части Б: зелье лечения с эффектом (Р64) и скакун со столбцами таблицы (Р66).
// Оба есть в обоих каталогах.
test('справочник: зелье лечения и боевой конь в снаряжении', async () => {
  const { window } = running;
  const search = window.getByRole('searchbox', { name: 'Поиск снаряжения' });
  const results = window.getByRole('list', { name: 'Результаты поиска' });

  // Прошлый сценарий оставил фильтр «Воинское рукопашное».
  await window.getByLabel('Группа').selectOption('');
  await search.fill('зелье');
  await results.getByRole('link', { name: /Зелье лечения/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Зелье лечения' })).toBeVisible();
  await expect(window.getByTestId('item-use-effect')).toHaveText('Восстанавливает 2к4 + 2 хита');
  await expect(window.getByText('Действие, предмет расходуется')).toBeVisible();

  await window.getByRole('button', { name: '← К списку' }).click();
  await search.fill('боевой конь');
  await results.getByRole('link', { name: /Боевой конь/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Боевой конь' })).toBeVisible();
  await expect(window.getByTestId('item-kind')).toHaveText('Скакун или животное');
  await expect(window.getByText('Скорость', { exact: true })).toBeVisible();
  await expect(window.getByText('Грузоподъёмность', { exact: true })).toBeVisible();
});

// Сценарий части Б: «Расы» → фильтр «Разновидности» → поиск «дроу» → карточка
// разновидности со ссылкой на расу → карточка «Эльфа». Есть в обоих каталогах.
test('справочник: найти разновидность «дроу» и перейти к расе', async () => {
  const { window } = running;

  await window.getByRole('button', { name: '← К списку' }).click();
  await window.getByRole('link', { name: '← Справочник' }).click();
  await window.getByRole('link', { name: /Расы/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Расы' })).toBeVisible();

  await window.getByLabel('Расы и разновидности').selectOption('variant');
  await window.getByRole('searchbox', { name: 'Поиск рас' }).fill('дроу');
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  const drow = results.getByRole('link', { name: /Тёмный эльф \(дроу\)/ });
  await expect(drow).toContainText('разновидность: Эльф');

  await drow.click();
  await expect(window.getByRole('heading', { level: 1, name: 'Тёмный эльф (дроу)' })).toBeVisible();
  await expect(window.getByTestId('race-darkvision')).toHaveText('120 фт.');
  await expect(window.getByTestId('race-abilities')).toHaveText('Хар +1');

  await window.getByTestId('race-kind').getByRole('link', { name: 'Эльф' }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Эльф' })).toBeVisible();
  await expect(window.getByTestId('race-speed')).toHaveText('30 фт.');
  await expect(window.getByTestId('race-languages')).toHaveText('Общий, Эльфийский');
  await expect(window.getByRole('link', { name: 'Высший эльф' })).toBeVisible();
  // Р69: возраст и рост числами из особенностей «Возраст» и «Размер».
  await expect(window.getByTestId('race-age')).toHaveText('зрелость — 100 лет, жизнь — 750 лет');
  await expect(window.getByTestId('race-height')).toHaveText('5 фт. – 6 фт. (152 – 183 см)');
});

// Этап 2, часть В: поиск по всему справочнику (Р54) и связь заклинания с компонентом
// (Р60). «Щит», «Огненный шар» и «Гуано летучей мыши» есть в обоих каталогах.
test('справочник: поиск везде, огненный шар → компонент «Гуано летучей мыши»', async () => {
  const { window } = running;

  await window.getByRole('link', { name: 'Все расы' }).click();
  await window.getByRole('link', { name: '← Справочник' }).click();
  const search = window.getByRole('searchbox', { name: 'Поиск по всему справочнику' });
  await search.fill('щит');
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  await expect(results.getByTestId('result-category').first()).toHaveText(/^Снаряжение · Щит/);
  await expect(
    results.getByTestId('result-category').filter({ hasText: /^(Раса|Разновидность расы)/ }),
  ).not.toHaveCount(0);

  await search.fill('Гуано летучей мыши');
  await expect(results.getByRole('link', { name: /Гуано летучей мыши/ })).toBeVisible();
  await expect(results.getByTestId('result-category').first()).toHaveText(
    /^Снаряжение · Компонент заклинания/,
  );

  await search.fill('огненный шар');
  await results
    .getByRole('link', { name: /Огненный шар/ })
    .first()
    .click();
  await expect(window.getByRole('heading', { level: 1, name: 'Огненный шар' })).toBeVisible();
  await window
    .getByTestId('spell-material-items')
    .getByRole('link', { name: 'Гуано летучей мыши' })
    .click();
  await expect(window.getByRole('heading', { level: 1, name: 'Гуано летучей мыши' })).toBeVisible();
  await expect(window.getByTestId('item-kind')).toHaveText('Компонент заклинания');
  await expect(window.getByRole('link', { name: 'Огненный шар', exact: true })).toBeVisible();
});

// Этап 3, часть А: справочные категории — по сценарию на категорию. Навыки, «Акван»,
// «Сбитый с ног», «Артист» и черты «Одарённый», «Знаток средних доспехов» есть в обоих
// каталогах. Каждый сценарий открывает свой список адресом: не зависит от прошлого.
async function openList(category: string, title: string) {
  const { window } = running;
  // Строкой: в типах сценариев нет DOM (tsconfig.node.json).
  await window.evaluate("location.hash = '#/reference'");
  await window.getByRole('link', { name: new RegExp(title) }).click();
  await expect(window.getByRole('heading', { level: 1, name: title })).toBeVisible();
  expect(await window.evaluate('location.hash')).toBe(`#/reference/${category}`);
  return window;
}

test('справочник: навыки Ловкости → «Акробатика»', async () => {
  const window = await openList('skill', 'Навыки');
  await window.getByLabel('Характеристика').selectOption('dex');
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  await expect(results.getByRole('link')).toHaveCount(3);
  await results.getByRole('link', { name: /Акробатика/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Акробатика' })).toBeVisible();
  await expect(window.getByTestId('skill-ability')).toHaveText('Ловкость');
});

test('справочник: язык «Акван» — диалект Первичного', async () => {
  const window = await openList('language', 'Языки');
  await window.getByRole('searchbox', { name: 'Поиск: языки' }).fill('Акван');
  const aquan = window
    .getByRole('list', { name: 'Результаты поиска' })
    .getByRole('link', { name: /Акван/ });
  await expect(aquan).toContainText('Диалект: Первичный');
  await aquan.click();
  await expect(window.getByRole('heading', { level: 1, name: 'Акван' })).toBeVisible();
  await window.getByRole('link', { name: 'Первичный' }).first().click();
  await expect(window.getByRole('heading', { level: 1, name: 'Первичный' })).toBeVisible();
});

test('справочник: состояние «Сбитый с ног» по синониму «ничком»', async () => {
  const window = await openList('condition', 'Состояния');
  await window.getByRole('searchbox', { name: 'Поиск: состояния' }).fill('ничком');
  await window
    .getByRole('list', { name: 'Результаты поиска' })
    .getByRole('link', { name: /Сбитый с ног/ })
    .click();
  await expect(window.getByRole('heading', { level: 1, name: 'Сбитый с ног' })).toBeVisible();
  await expect(window.getByTestId('entity-kind')).toHaveText('Состояние');
});

test('справочник: предыстория «Артист» — навыки ссылками на объекты, характер', async () => {
  const window = await openList('background', 'Предыстории');
  await window.getByRole('searchbox', { name: 'Поиск: предыстории' }).fill('Артист');
  await window
    .getByRole('list', { name: 'Результаты поиска' })
    .getByRole('link', { name: /Артист Entertainer/ })
    .click();
  await expect(window.getByRole('heading', { level: 1, name: 'Артист' })).toBeVisible();
  await expect(window.getByTestId('background-skills')).toHaveText('Акробатика; Выступление');
  await expect(window.getByTestId('background-tools')).toContainText('музыкальн');
  await expect(window.getByRole('heading', { name: 'Разновидность: Гладиатор' })).toBeVisible();
  await expect(window.getByRole('heading', { name: /Черты характера/ })).toBeVisible();
});

test('справочник: черты — «Одарённый» и требование «Знатока средних доспехов»', async () => {
  const window = await openList('feat', 'Черты');
  await window.getByLabel('Требование').selectOption('false');
  await window.getByRole('searchbox', { name: 'Поиск: черты' }).fill('Одарённый');
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  await results.getByRole('link', { name: /Одарённый/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Одарённый' })).toBeVisible();
  await expect(window.getByTestId('feat-mixed')).toHaveText(
    '3 на выбор в любой комбинации: любой навык, любой инструмент',
  );
  await expect(window.getByTestId('feat-prerequisite')).toHaveText('нет');

  await window.getByRole('button', { name: '← К списку' }).click();
  await window.getByLabel('Требование').selectOption('true');
  await window.getByRole('searchbox', { name: 'Поиск: черты' }).fill('средних доспехов');
  await results.getByRole('link', { name: /Знаток средних доспехов/ }).click();
  await expect(window.getByTestId('feat-prerequisite')).toHaveText('владение: лёгкие доспехи');
  await expect(window.getByTestId('feat-abilities')).toContainText('из: Сил, Лов');
});

// Этап 3, часть Б: классы и подклассы. Монах и мистический рыцарь есть в обоих каталогах.
test('справочник: класс «Монах» — таблица 1–20, вариант правил TCE, подкласс', async () => {
  const window = await openList('class', 'Классы');
  await window.getByRole('searchbox', { name: 'Поиск: классы' }).fill('Монах');
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  await results.getByRole('link', { name: /Монах/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Монах' })).toBeVisible();
  await expect(window.getByTestId('class-hit-die')).toHaveText('к8');
  await expect(window.getByTestId('class-multiclass')).toHaveText('Мудрость 13 и Ловкость 13');
  await expect(window.getByTestId('class-table').locator('tbody tr')).toHaveCount(20);
  await expect(window.getByTestId('optional-rule').first()).toContainText('вариант правил');
  await window
    .getByTestId('class-subclasses')
    .getByRole('link', { name: 'Путь открытой ладони' })
    .click();
  await expect(
    window.getByRole('heading', { level: 1, name: 'Путь открытой ладони' }),
  ).toBeVisible();
  await expect(window.getByTestId('subclass-class')).toHaveText('Монах');
});

test('справочник: подклассы воина → «Мистический рыцарь», переход к классу', async () => {
  const window = await openList('subclass', 'Подклассы');
  await window.getByRole('combobox', { name: /^Класс/ }).selectOption('class:fighter');
  const results = window.getByRole('list', { name: 'Результаты поиска' });
  await results.getByRole('link', { name: /Мистический рыцарь/ }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Мистический рыцарь' })).toBeVisible();
  await expect(window.getByRole('heading', { name: 'Таблица заклинателя' })).toBeVisible();
  await window.getByTestId('subclass-class').getByRole('link', { name: 'Воин' }).click();
  await expect(window.getByRole('heading', { level: 1, name: 'Воин' })).toBeVisible();
});

test('программа пишет только в data/ рядом с Koster.exe', async () => {
  const data = path.join(running.folder, 'data');
  expect(fs.existsSync(data)).toBe(true);
  expect(fs.readdirSync(data).sort()).toEqual(['electron', 'logs']);
});
