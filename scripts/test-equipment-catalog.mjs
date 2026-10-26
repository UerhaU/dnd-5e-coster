import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createCatalog } from './build-spell-catalog.mjs';
import { applyEquipment, equipmentPayload } from './equipment-model.mjs';
import { EquipmentCatalog } from '../backend/src/spell-catalog/equipment-repository.ts';
import { SpellCatalog } from '../backend/src/spell-catalog/repository.ts';
import { buildSpellCatalogServer } from '../backend/src/spell-catalog/app.ts';
const directory=mkdtempSync(join(tmpdir(),'dnd-equipment-'));
const path=join(directory,'catalog.sqlite');createCatalog(path,{includeFullSpells:false});
const db=new DatabaseSync(path),equipment=new EquipmentCatalog(path),spells=new SpellCatalog(path),server=buildSpellCatalogServer(path,false),payload=equipmentPayload();
after(async()=>{await server.close();equipment.close();spells.close();db.close();rmSync(path);rmdirSync(directory);});
const byName=(name)=>{const entry=equipment.list({q:name}).entries.find(item=>item.name===name);assert.ok(entry,name);return equipment.detail(entry.id);};
const mechanic=(item,stat,op)=>item.rules.filter(rule=>rule.statCode===stat&&(!op||rule.operatorCode===op));
const formulaTerms=(effect)=>db.prepare('SELECT * FROM mechanic_terms WHERE effect_id=? ORDER BY ordinal').all(effect);

test('выборочная сверка с тремя страницами 2014 пройдена до импорта',()=>{
  const checks=JSON.parse(readFileSync('database/equipment/source-checks.json','utf8'));
  assert.equal(checks.edition,'5e_2014');assert.equal(checks.checks.length,3);
  assert.ok(checks.checks.every(check=>check.sameDescription&&check.sameType&&check.url.startsWith('https://5e14.dnd.su/')));
});
test('весь сохранённый набор импортирован в одну базу со связями и NULL иконок',()=>{
  assert.equal(equipment.list().total,payload.base.length+payload.magic.length);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gear_entries WHERE edition_id<>1').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gear_entries g JOIN items i ON i.id=g.item_id WHERE i.icon_url IS NOT NULL').get().n,0);
  for(const entry of payload.magic){const imported=equipment.detail(200000+entry.siteId);assert.equal(imported.name,entry.name);assert.equal(imported.sourceUrl,entry.url);}
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});
test('существующие заклинания, материалы и их формулы сохраняются',()=>{
  assert.equal(spells.list().total,4);assert.equal(spells.detail(10001).effects[0].roll,'8к6');
  assert.equal(spells.detail(10002).effects[0].roll,'1к8 + модификатор заклинателя');
  const feather=spells.detail(10003).materials.flatMap(group=>group.requirements).find(row=>row.item.id===5004);
  assert.equal(feather.quantityLabel,'1 шт.');assert.equal(feather.item.name,'Перо совы');
  const sword=byName('Длинный меч');assert.equal(sword.attacks.find(p=>p.mode==='melee').roll,'1к8');
  const formula=db.prepare("SELECT id FROM roll_formulas WHERE source_expression='1к8'").all();assert.equal(formula.length,1);
});
test('КБ доспеха — базовая формула, щит — отдельная прибавка; Ловкость не дублируется',()=>{
  const plate=mechanic(byName('Латы'),'armor_class','base')[0],leather=mechanic(byName('Кожаный'),'armor_class','base')[0],breast=mechanic(byName('Кираса'),'armor_class','base')[0],shield=mechanic(byName('Щит'),'armor_class','add')[0];
  assert.equal(formulaTerms(plate.id).length,1);assert.equal(formulaTerms(plate.id)[0].constant_value,18);assert.equal(plate.stackingMode,'choose_one');
  assert.equal(formulaTerms(leather.id)[1].maximum,null);assert.equal(formulaTerms(leather.id)[1].ability_id,2);
  assert.equal(formulaTerms(breast.id)[0].constant_value,14);assert.equal(formulaTerms(breast.id)[1].maximum,2);
  assert.equal(formulaTerms(shield.id)[0].constant_value,2);assert.equal(shield.stackingMode,'highest');
});
test('щит +1 добавляет магический бонус отдельно от стандартных +2',()=>{
  const item=byName('Щит +1, +2, +3'),variant=item.variants.find(v=>v.enhancement===1);
  assert.equal(item.baseOptions.length,1);const selected=equipment.detail(item.id,undefined,variant.id);
  const rules=mechanic(selected,'armor_class','add');assert.equal(rules.length,2);
  assert.ok(rules.some(rule=>rule.expression==='2'));assert.ok(rules.some(rule=>rule.expression==='1'));
  assert.equal(item.selectedVariantId,null,'не подставляем произвольное улучшение');
});
test('универсальный урон, фехтование и дальности — отдельные профили',()=>{
  const sword=byName('Длинный меч');assert.equal(sword.attacks.find(x=>x.mode==='melee').roll,'1к8');assert.equal(sword.attacks.find(x=>x.mode==='two_handed').roll,'1к10');
  assert.equal(sword.attacks[0].damage.name,'Рубящий');const rapier=byName('Рапира');assert.equal(rapier.attacks[0].attackAbility,'Сила');assert.equal(rapier.attacks[0].alternateAbility,'Ловкость');
  const bow=byName('Длинный лук').attacks[0];assert.equal(bow.normalRange,150);assert.equal(bow.maxRange,600);
  assert.equal(byName('Дротик').attacks[0].mode,'thrown');
});
test('тяжёлое оружие использует размер по 2014; длинное копьё хранит близкую цель и верховую езду',()=>{
  const heavy=byName('Двуручный меч').rules.find(rule=>rule.name.includes('Маленький/Крошечный'));
  assert.equal(heavy.conditions.match,'any');assert.deepEqual(heavy.conditions.tests.map(x=>x.value),['small','tiny']);assert.ok(heavy.conditions.tests.every(x=>x.factCode==='size'));
  const lance=byName('Длинное копьё');assert.ok(lance.rules.some(rule=>rule.conditions?.tests.some(x=>x.factCode==='target_distance'&&x.value===5&&x.comparison==='le')));
  assert.ok(lance.rules.some(rule=>rule.statCode==='hands'&&rule.conditions.tests.some(x=>x.factCode==='mounted'&&x.value===0)));
});
test('доспех хранит штраф недостаточной Силы, исключение и отсутствие владения',()=>{
  const plate=byName('Латы'),speed=mechanic(plate,'speed')[0];
  assert.equal(speed.expression,'−10');assert.ok(speed.conditions.tests.some(x=>x.factCode==='strength_score'&&x.value===15));assert.ok(speed.conditions.tests.some(x=>x.factCode==='armor_strength_exempt'&&x.value===0));
  const blocked=mechanic(plate,'spellcasting','block')[0];assert.ok(blocked.conditions.tests.some(x=>x.factCode==='armor_proficient'&&x.value===0));
  assert.ok(mechanic(plate,'attack_roll','disadvantage').length);
  assert.ok(mechanic(plate,'attack_roll','disadvantage')[0].conditions.tests.some(x=>x.factCode==='attack_uses_strength_or_dexterity'&&x.value===1));
});

test('боеприпас связан по ID, количество на атаку отделено от цены и веса упаковки',()=>{
  const bow=byName('Длинный лук').ammunition[0];assert.equal(bow.name,'Стрелы');assert.equal(bow.quantityLabel,'1 шт.');assert.equal(bow.packageQuantity,20);assert.equal(bow.packagePriceCp,100);assert.equal(bow.packageWeightLb,1);
  const arrows=db.prepare('SELECT price_cp,weight_lb FROM items WHERE id=?').get(bow.id);assert.equal(arrows.price_cp,null);assert.equal(arrows.weight_lb,null);
  assert.equal(byName('Короткий лук').ammunition[0].id,bow.id);
  assert.equal(byName('Лазерный пистолет').ammunition[0].quantityLabel,'1 заряд');
  assert.equal(byName('Лазерный пистолет').ammunition[0].name,'Батарея');
});

test('бонус атаки оружия ограничен своим оружием, а защита относится к владельцу',()=>{
  const weapon=byName('Оружие +1, +2, +3');assert.ok(mechanic(weapon,'attack_roll').every(x=>x.scope==='source_weapon'));
  assert.ok(mechanic(byName('Защитник'),'damage_roll').every(x=>x.scope==='source_weapon'));
  assert.equal(mechanic(byName('Кольцо защиты'),'armor_class')[0].scope,'wearer');
});
test('мифрил отменяет соответствующие ограничения, а не все помехи; наручи имеют условия',()=>{
  const mithral=byName('Мифрильный доспех');assert.ok(mithral.rules.some(x=>x.operatorCode==='ignore'&&x.stackingGroup==='armor_stealth'));
  assert.ok(mithral.rules.some(x=>x.operatorCode==='ignore'&&x.stackingGroup==='armor_strength_speed'));
  const bracers=mechanic(byName('Наручи защиты'),'armor_class')[0];assert.ok(bracers.conditions.tests.some(x=>x.factCode==='wearing_armor'&&x.value===0));assert.ok(bracers.conditions.tests.some(x=>x.factCode==='using_shield'&&x.value===0));assert.ok(bracers.conditions.tests.some(x=>x.factCode==='attuned'&&x.value===1));
});
test('кольцо и плащ используют общие эффекты и допускают прибавки разных источников',()=>{
  const ring=mechanic(byName('Кольцо защиты'),'armor_class')[0],cloak=mechanic(byName('Плащ защиты'),'armor_class')[0];assert.equal(ring.id,cloak.id);assert.equal(ring.stackingMode,'add');assert.equal(cloak.stackingMode,'add');
});
test('«Защитник» связывает выбор КБ с уменьшением бонуса атаки и урона',()=>{
  const defender=byName('Защитник');assert.equal(defender.parameters.length,1);assert.equal(defender.parameters[0].maximum,3);
  const attack=mechanic(defender,'attack_roll')[0],ac=mechanic(defender,'armor_class')[0];
  const attackTerms=formulaTerms(attack.id),acTerms=formulaTerms(ac.id);assert.equal(attackTerms[0].constant_value,3);assert.equal(attackTerms[1].coefficient,-1);assert.equal(attackTerms[1].parameter_id,acTerms[0].parameter_id);assert.equal(attack.duration,'start_next_turn');
});
test('неразобранные свойства не выдаются за числовую готовность; неизвестные цена и вес — NULL',()=>{
  const flame=byName('Язык пламени');assert.equal(flame.status,'partial');assert.ok(flame.unresolvedCount>0);assert.ok(flame.rules.some(rule=>rule.roll==='2к6'&&rule.damage.name==='Огонь'));
  assert.equal(flame.priceCp,null);const defender=byName('Защитник');assert.equal(defender.priceMaxCp,null);assert.ok(defender.priceMinCp>0);
});
test('API фильтрует, проверяет основу и вариант и не открывает игровой лист',async()=>{
  assert.equal((await server.inject('/api/spellbook/equipment?magic=false')).json().entries.length,payload.base.length);
  const sword=byName('Длинный меч'),shield=byName('Щит +1, +2, +3');
  assert.equal((await server.inject(`/api/spellbook/equipment/${shield.id}?base=${sword.id}`)).statusCode,400);
  assert.equal((await server.inject(`/api/spellbook/equipment/${shield.id}?variant=999999`)).statusCode,400);
  assert.equal((await server.inject('/api/spellbook/equipment/abc')).statusCode,400);assert.equal((await server.inject('/api/characters')).statusCode,404);
});
test('повторный импорт ничего не перезаписывает и исключает 2024 и homebrew',()=>{
  assert.deepEqual(applyEquipment(db),{changed:false});const bad=structuredClone(payload);bad.magic[0].url='https://next.dnd.su/items/1-test/';assert.throws(()=>applyEquipment(db,bad),/2014/);
  assert.equal(spells.list().total,4);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
