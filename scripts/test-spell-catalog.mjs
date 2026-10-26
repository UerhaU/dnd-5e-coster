import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createCatalog, projectSchema } from './build-spell-catalog.mjs';
import { migrateMaterials } from './migrate-spell-materials.mjs';
import { SpellCatalog } from '../backend/src/spell-catalog/repository.ts';
import { buildSpellCatalogServer } from '../backend/src/spell-catalog/app.ts';

const directory = mkdtempSync(join(tmpdir(), 'dnd-spell-catalog-'));
const path = join(directory, 'catalog.sqlite');
createCatalog(path,{includeEquipment:false});
const database = new DatabaseSync(path);
const catalog = new SpellCatalog(path);
const server = buildSpellCatalogServer(path, false);
const source = JSON.parse(readFileSync(new URL('../database/spells/access-export.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const schema = projectSchema;
const plain = (value) => JSON.parse(JSON.stringify(value));
after(async () => { await server.close(); catalog.close(); database.close(); rmSync(path); rmdirSync(directory); });

test('все таблицы и 46 связей сохранены; дублирующий текст требования исключён', () => {
  assert.equal(database.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n, 37);
  let relations = 0;
  for (const table of schema.tables) {
    const actual = plain(database.prepare(`SELECT * FROM "${table.technical}" ORDER BY id`).all());
    const expected = source.tables[table.technical].map((row) => Object.fromEntries(table.fields.map((field) => [field.technical, typeof row[field.technical] === 'boolean' ? Number(row[field.technical]) : row[field.technical]])));
    assert.deepEqual(actual, expected, table.technical);
    relations += database.prepare(`PRAGMA foreign_key_list("${table.technical}")`).all().length;
  }
  assert.equal(relations, 46);
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(database.prepare('PRAGMA user_version').get().user_version, 102);
  const fields = database.prepare('PRAGMA table_info(spell_material_requirements)').all();
  assert.equal(fields.some((field) => field.name === 'requirement_text'), false);
  assert.equal(fields.find((field) => field.name === 'item_id').notnull, 1);
});

test('иконки заклинаний, всех 13 типов урона и пяти предметов — SQL NULL', () => {
  for (const [table, count] of [['spells', 4], ['damage_types', 13], ['items', 5]]) {
    const field = database.prepare(`PRAGMA table_info("${table}")`).all().find((column) => column.name === 'icon_url');
    assert.equal(field.notnull, 0);
    assert.equal(database.prepare(`SELECT count(*) AS n FROM ${table} WHERE icon_url IS NULL`).get().n, count);
  }
});

test('ограничения уровня, ревизии, денег, слагаемых и связей работают', () => {
  assert.throws(() => database.exec('UPDATE spells SET level=10 WHERE id=10001'), /CHECK/);
  assert.throws(() => database.exec('UPDATE spells SET revision=0 WHERE id=10001'), /CHECK/);
  assert.throws(() => database.exec('UPDATE items SET price_cp=-1 WHERE id=5003'), /CHECK/);
  assert.throws(() => database.exec('UPDATE items SET price_cp=1.5 WHERE id=5003'), /INTEGER/);
  assert.throws(() => database.exec('UPDATE roll_terms SET die_id=NULL WHERE id=1'), /CHECK/);
  assert.throws(() => database.exec('UPDATE spell_material_requirements SET quantity=1,unit_id=NULL WHERE id=1'), /CHECK/);
  assert.throws(() => database.exec('UPDATE spell_material_requirements SET item_id=NULL WHERE id=1'), /NOT NULL/);
  assert.throws(() => database.exec('UPDATE spells SET school_id=999999 WHERE id=10001'), /FOREIGN KEY/);
  assert.throws(() => database.exec("UPDATE spells SET canonical_id=(SELECT canonical_id FROM spells WHERE id=10002),revision=1 WHERE id=10001"), /UNIQUE/);
});

test('карточка собирается из ID и чисел, а не дублирующих готовых фраз', () => {
  const workingPath = join(directory, 'structured.sqlite');
  createCatalog(workingPath,{includeEquipment:false});
  const workingDatabase = new DatabaseSync(workingPath);
  const workingCatalog = new SpellCatalog(workingPath);
  try {
    workingDatabase.exec("UPDATE spells SET range_text='WRONG',duration_text='WRONG',components_text='WRONG',higher_levels_text='WRONG'; UPDATE spell_casting_times SET source_text='WRONG'; UPDATE roll_formulas SET source_expression='WRONG';");
    const fireball = workingCatalog.detail(10001);
    assert.equal(fireball.range, '150 футов');
    assert.equal(fireball.duration, 'Мгновенная');
    assert.equal(fireball.components, 'В, С, М');
    assert.deepEqual(fireball.castingTimes, ['1 действие']);
    assert.equal(fireball.effects[0].roll, '8к6');
    assert.ok(!fireball.higherLevels.includes('WRONG'));
    assert.deepEqual(workingCatalog.detail(10003).castingTimes, ['1 минута']);
    assert.equal(workingCatalog.detail(10003).range, 'Касание');
    assert.equal(workingCatalog.detail(10004).duration, 'До 1 минуты, концентрация');
    workingDatabase.exec("UPDATE items SET name_ru='Новое название пера' WHERE id=5004; UPDATE spell_material_requirements SET quantity=2 WHERE item_id=5004; UPDATE roll_terms SET dice_count=9 WHERE formula_id=2001;");
    const feather = workingCatalog.detail(10003).materials.flatMap((group) => group.requirements).find((entry) => entry.item.id === 5004);
    assert.equal(feather.item.name, 'Новое название пера');
    assert.equal(feather.quantityLabel, '2 шт.');
    assert.equal('text' in feather, false);
    assert.equal(workingCatalog.detail(10001).effects[0].roll, '9к6');
    assert.equal(workingCatalog.detail(10003).materials[0].requirements[0].minimumValueCp, 10000);
  } finally { workingCatalog.close(); workingDatabase.close(); rmSync(workingPath); }
});

test('миграция сохраняет материалы, условия, ссылки и количество; повтор безопасен', () => {
  const oldPath = join(directory, 'legacy.sqlite');
  createCatalog(oldPath,{includeEquipment:false});
  const old = new DatabaseSync(oldPath);
  old.exec('ALTER TABLE spell_material_requirements ADD COLUMN requirement_text TEXT; PRAGMA user_version=101;');
  const update = old.prepare('UPDATE spell_material_requirements SET requirement_text=? WHERE id=?');
  for (const row of source.tables.spell_material_requirements) update.run(row.requirement_text, row.id);
  old.exec("UPDATE spell_material_requirements SET requirement_text='Особое требование пользователя' WHERE id=4");
  old.close();
  let migration;
  try {
    migration = migrateMaterials(oldPath);
    const migrated = new DatabaseSync(oldPath);
    try {
      assert.equal(migration.rows, 5);
      const feather = migrated.prepare('SELECT * FROM spell_material_requirements WHERE item_id=5004').get();
      assert.equal(feather.quantity, 1);
      assert.equal(feather.unit_id, 1);
      assert.equal(feather.special_requirements, 'Особое требование пользователя');
      assert.equal('requirement_text' in feather, false);
      assert.deepEqual(migrated.prepare('PRAGMA foreign_key_check').all(), []);
      assert.equal(migrated.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally { migrated.close(); }
    assert.deepEqual(migrateMaterials(oldPath), { changed: false });
  } finally {
    rmSync(oldPath);
    if (migration?.backup) { rmSync(migration.backup); rmdirSync(join(directory, 'backups')); }
  }
});

test('четыре карточки получают свои эффекты, классы и материалы без остатков', () => {
  for (const [id, name, materialCount, accessCount, roll] of [
    [10001, 'Огненный шар', 2, 7, '8к6'], [10002, 'Лечение ран', 0, 10, '1к8 + модификатор заклинателя'],
    [10003, 'Опознание', 2, 5, null], [10004, 'Благословение', 1, 4, '1к4'], [10002, 'Лечение ран', 0, 10, '1к8 + модификатор заклинателя'],
  ]) {
    const spell = catalog.detail(id);
    assert.equal(spell.name, name);
    assert.equal(spell.iconUrl, null);
    assert.equal(spell.materials.flatMap((group) => group.requirements).length, materialCount, name);
    assert.equal(spell.classAccess.length + spell.subclasses.length, accessCount, name);
    assert.equal(spell.effects[0].roll, roll, name);
  }
  const identify = catalog.detail(10003);
  assert.equal(identify.ritual, true);
  assert.equal(identify.materials[0].requirements[0].minimumValueCp, 10000);
  assert.match(identify.materials[0].requirements[0].consumption, /Не расходуется/);
  assert.equal(catalog.detail(10004).concentration, true);
  assert.equal(catalog.detail(10001).effects[0].damageType.iconUrl, null);
});

test('поиск учитывает русский регистр, английское имя, фильтры и пустой результат', () => {
  assert.equal(catalog.list().spells.length, 4);
  assert.deepEqual(catalog.list({ q: 'ОГНЕННЫЙ' }).spells.map((spell) => spell.id), [10001]);
  assert.deepEqual(catalog.list({ q: 'cure' }).spells.map((spell) => spell.id), [10002]);
  assert.equal(catalog.list({ level: 0 }).spells.length, 0);
  assert.equal(catalog.list({ ritual: true }).spells[0].id, 10003);
  assert.equal(catalog.list({ concentration: true }).spells[0].id, 10004);
  assert.equal(catalog.list({ school: 5, level: 3 }).spells[0].id, 10001);
  assert.ok(catalog.list({ class: 8 }).spells.some((spell) => spell.id === 10001), 'доступ колдуна через подкласс');
  assert.equal(catalog.list({ q: 'несуществующее' }).spells.length, 0);
});

test('API отдаёт карточки и NULL, отклоняет неверные параметры; игровых маршрутов нет', async () => {
  const list = await server.inject('/api/spellbook/spells?q=%D0%9B%D0%95%D0%A7%D0%95%D0%9D%D0%98%D0%95');
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().spells[0].id, 10002);
  const detail = await server.inject('/api/spellbook/spells/10003');
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().materials[0].requirements[0].item.iconUrl, null);
  assert.equal((await server.inject('/api/spellbook/spells?ritual=true')).json().spells[0].id, 10003);
  assert.equal((await server.inject('/api/spellbook/lookups')).json().damageTypes.length, 13);
  for (const route of ['/api/spellbook/spells/999999', '/api/characters', '/api/campaigns']) assert.equal((await server.inject(route)).statusCode, 404);
  for (const route of ['/api/spellbook/spells/nope', '/api/spellbook/spells?level=10', '/api/spellbook/spells?ritual=maybe']) assert.equal((await server.inject(route)).statusCode, 400);
  assert.equal((await server.inject({ method: 'POST', url: '/api/spellbook/spells', payload: { name: 'test' } })).statusCode, 404);
});

test('будущие иконки сохраняются, повторная инициализация не перезаписывает базу', () => {
  database.exec("UPDATE items SET icon_url='/icons/owl-feather.svg' WHERE id=5004");
  assert.equal(catalog.detail(10003).materials.flatMap((group) => group.requirements).find((material) => material.item.id === 5004).item.iconUrl, '/icons/owl-feather.svg');
  assert.throws(() => createCatalog(path), /already exists/);
  database.exec('UPDATE items SET icon_url=NULL WHERE id=5004');
});
