import assert from 'node:assert/strict';
import { test,after } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createCatalog } from './build-spell-catalog.mjs';
import { applyRaceSamples,raceSampleData } from './race-samples-model.mjs';
import { RaceCatalog } from '../backend/src/spell-catalog/race-repository.ts';
import { SpellCatalog } from '../backend/src/spell-catalog/repository.ts';
import { EquipmentCatalog } from '../backend/src/spell-catalog/equipment-repository.ts';
import { calculateBody,calculateCarrying } from '../backend/src/spell-catalog/race-math.ts';
import { buildSpellCatalogServer } from '../backend/src/spell-catalog/app.ts';
mkdirSync(resolve('storage/catalog-tests'),{recursive:true});const dir=mkdtempSync(resolve('storage/catalog-tests/races-')),path=join(dir,'catalog.sqlite');
createCatalog(path);const db=new DatabaseSync(path),races=new RaceCatalog(path),spells=new SpellCatalog(path),gear=new EquipmentCatalog(path),server=buildSpellCatalogServer(path,false);
const human=()=>races.detail(300081),hill=()=>races.detail(300078,310078),mountain=()=>races.detail(300078,320078),high=()=>races.detail(300079,310079),wood=()=>races.detail(300079,320079);
after(async()=>{await server.close();races.close();spells.close();gear.close();db.close();rmSync(dir,{recursive:true});});

test('пробный набор: 3 расы, 4 разновидности, редакция 2014; исходные каталоги сохранены',()=>{
 assert.equal(races.list().total,3);assert.equal(races.list().entries.reduce((n,r)=>n+r.subraces.length,0),4);assert.equal(spells.list().total,524);assert.equal(gear.list().total,342);
 assert.equal(db.prepare('SELECT count(*) n FROM race_entries WHERE edition_id<>1').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM race_entries WHERE icon_url IS NOT NULL').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM race_source_checks WHERE length(source_hash)=64').get().n,5);
 assert.ok(raceSampleData.sources.every(s=>s.url.includes('2014')||s.url.startsWith('https://5e14.dnd.su/race/')));
});
test('бонусы общих рас и разновидностей не начисляются дважды; скорость лесного эльфа заменяется',()=>{
 const bonuses=r=>Object.fromEntries(r.bonuses.map(b=>[b.ability,b.bonus]));
 assert.deepEqual(bonuses(mountain()),{Сила:2,Телосложение:2});assert.deepEqual(bonuses(hill()),{Телосложение:2,Мудрость:1});assert.deepEqual(bonuses(high()),{Ловкость:2,Интеллект:1});assert.deepEqual(bonuses(wood()),{Ловкость:2,Мудрость:1});
 assert.equal(human().bonuses.length,6);assert.ok(human().bonuses.every(b=>b.bonus===1));assert.equal(mountain().speeds[0].feet,25);assert.equal(high().speeds[0].feet,30);assert.equal(wood().speeds[0].feet,35);assert.equal(wood().speeds.length,1);
});
test('физическое описание отделено от случайной формулы; базовые профили переиспользуются',()=>{
 assert.equal(hill().body.id,mountain().body.id);assert.equal(high().body.id,wood().body.id);assert.notEqual(hill().generator.id,mountain().generator.id);
 assert.equal(hill().body.weightAverageLb,150);assert.equal(hill().body.weightMinLb,null);assert.equal(high().body.adulthoodBasis,'social');assert.equal(high().body.adultAge,100);assert.equal(human().body.lifespanQualifier,'under');
 const g=human().generator;assert.equal(g.heightDice.label,'2к10');assert.equal(g.weightDice.label,'2к4');
 const b=calculateBody(g,12,3);assert.equal(b.heightIn,68);assert.equal(b.weightLb,146);assert.equal(b.heightCm,172.72);
 assert.throws(()=>calculateBody(g,21,3),/диапазона/);assert.throws(()=>calculateBody(g,12,1),/диапазона/);assert.throws(()=>calculateBody(g,12.1,3),/диапазона/);
});
test('вес тела не меняет грузоподъёмность; используется значение Силы и корректный множитель размера',()=>{
 for(const race of[human(),hill(),high()]){const c=calculateCarrying(race.carrying,10,race.size.carryingMultiplier,100);assert.equal(c.capacityLb,150);assert.equal(c.pushDragLiftLb,300);assert.equal(c.remainingLb,50);assert.equal(c.overloaded,false);}
 assert.equal(calculateCarrying(human().carrying,10,1,150).overloaded,false);assert.equal(calculateCarrying(human().carrying,10,1,151).overloaded,true);
 const sizes=Object.fromEntries(db.prepare('SELECT code,carrying_multiplier FROM creature_sizes').all().map(s=>[s.code,s.carrying_multiplier]));assert.equal(sizes.small,1);assert.equal(sizes.tiny,0.5);assert.equal(sizes.large,2);assert.equal(calculateCarrying(human().carrying,10,sizes.large).capacityLb,300);
 assert.throws(()=>calculateCarrying(human().carrying,0,1),/Сила/);assert.throws(()=>calculateCarrying(human().carrying,10,1,-1),/груза/);
});
test('числа собираются по ID; правка описания не меняет бонусы, общие профили и формулы',()=>{
 db.exec("UPDATE race_entries SET description='WRONG';UPDATE race_traits SET description='WRONG';UPDATE roll_formulas SET source_expression='WRONG' WHERE id IN(SELECT height_roll_id FROM body_generators)");
 assert.equal(high().generator.heightDice.label,'2к10');assert.equal(hill().bonuses.find(b=>b.ability==='Телосложение').bonus,2);
 const bodyId=hill().body.id;db.prepare('UPDATE body_descriptions SET weight_average_lb=155 WHERE id=?').run(bodyId);assert.equal(mountain().body.weightAverageLb,155);db.prepare('UPDATE body_descriptions SET weight_average_lb=150 WHERE id=?').run(bodyId);
});
test('владения ссылаются на существующее оружие и категории брони; щит горному дварфу не добавлен',()=>{
 const weapons=mountain().proficiencies.filter(p=>p.kind==='weapon');assert.equal(weapons.length,4);assert.ok(weapons.every(p=>p.itemId!==null));assert.equal(mountain().proficiencies.filter(p=>p.kind==='armor').length,2);assert.equal(hill().proficiencies.filter(p=>p.kind==='armor').length,0);
 assert.equal(high().proficiencies.filter(p=>p.kind==='weapon').length,4);assert.equal(high().proficiencies.filter(p=>p.kind==='skill')[0].name,'Восприятие');
 db.prepare('UPDATE items SET name_ru=? WHERE id=100031').run('Общее имя топора');assert.ok(mountain().proficiencies.some(p=>p.name==='Общее имя топора'));db.prepare('UPDATE items SET name_ru=? WHERE id=100031').run('Боевой топор');
});
test('общие тёмное зрение и эффекты не дублируются; защита от яда и очарования условна',()=>{
 const dt=hill().traits.find(t=>t.name==='Тёмное зрение'),et=high().traits.find(t=>t.name==='Тёмное зрение');assert.equal(dt.id,et.id);assert.equal(dt.rules[0].effectId,et.rules[0].effectId);assert.equal(dt.rules[0].value,60);
 const poison=hill().traits.find(t=>t.name==='Дварфийская устойчивость');assert.equal(poison.rules.length,2);assert.ok(poison.rules.find(r=>r.operator==='Преимущество').conditions[0].includes('яда'));assert.equal(poison.rules.find(r=>r.operator==='Сопротивление').damage,'Яд');
 const fey=high().traits.find(t=>t.name==='Наследие фей');assert.equal(fey.rules.find(r=>r.operator==='Преимущество').effectId,poison.rules.find(r=>r.operator==='Преимущество').effectId);assert.ok(fey.rules.find(r=>r.operator==='Преимущество').conditions[0].includes('очарован'));assert.equal(fey.rules.find(r=>r.operator==='Иммунитет').stat,'Магический сон');
 const hp=hill().traits.find(t=>t.name==='Дварфийская выдержка').rules[0];assert.equal(hp.value,1);assert.equal(hp.basis,'character_level');assert.ok(!mountain().traits.some(t=>t.name==='Дварфийская выдержка'));
});
test('инструменты и язык выбираются из ID; высший эльф выбирает заговор волшебника с Интеллектом',()=>{
 const tools=hill().choices.find(c=>c.kind==='proficiency');assert.equal(tools.count,1);assert.equal(tools.options.length,3);
 assert.equal(human().choices.find(c=>c.kind==='language').options.length,15);assert.ok(!high().choices.find(c=>c.kind==='language').options.some(o=>['Общий','Эльфийский'].includes(o.name)));
 const cantrip=high().choices.find(c=>c.kind==='spell');assert.equal(cantrip.castingAbility,'Интеллект');assert.ok(cantrip.options.length>10);assert.ok(cantrip.options.some(o=>o.name==='Волшебная рука'));
 for(const option of cantrip.options){const s=spells.detail(option.id);assert.equal(s.level,0);assert.ok(s.classes.some(c=>c.name==='Волшебник'));}
});
test('API ищет по расе и разновидности и отклоняет чужую разновидность',async()=>{
 assert.equal((await server.inject('/api/spellbook/races')).json().total,3);assert.equal((await server.inject('/api/spellbook/races?q=лесной')).json().entries[0].name,'Эльф');
 const result=await server.inject('/api/spellbook/races/300079?subrace=320079');assert.equal(result.statusCode,200);assert.equal(result.json().speeds[0].feet,35);
 assert.equal((await server.inject('/api/spellbook/races/300079?subrace=310078')).statusCode,400);assert.equal((await server.inject('/api/spellbook/races/300081?subrace=310078')).statusCode,400);assert.equal((await server.inject('/api/spellbook/races/999999')).statusCode,404);assert.equal((await server.inject('/api/spellbook/races/abc')).statusCode,400);assert.equal((await server.inject('/api/characters')).statusCode,404);
});
test('ограничения и повторный импорт сохраняют пользовательские изменения',()=>{
 assert.throws(()=>db.exec('UPDATE body_generators SET base_weight_lb=-1'),/CHECK/);assert.throws(()=>db.exec('UPDATE race_ability_bonuses SET ability_id=99999 WHERE race_id=310078'),/FOREIGN KEY/);
 db.prepare("UPDATE race_entries SET icon_url='/icons/test.svg' WHERE id=300081").run();assert.equal(applyRaceSamples(db),false);assert.equal(human().iconUrl,'/icons/test.svg');
 assert.throws(()=>applyRaceSamples(db,{...raceSampleData,version:2}),/migration/);assert.equal(human().iconUrl,'/icons/test.svg');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});
test('ошибка миграции откатывает все добавления и не затрагивает старую базу',()=>{
 const path=join(dir,'rollback.sqlite');createCatalog(path,{includeRaceSamples:false});const d=new DatabaseSync(path);try{const data=structuredClone(raceSampleData);data.entries.at(-1).bonuses={nonexistent_ability:1};assert.throws(()=>applyRaceSamples(d,data),/Unknown abilities/);assert.equal(d.prepare("SELECT 1 FROM sqlite_master WHERE name='race_entries'").get(),undefined);assert.equal(d.prepare('SELECT count(*) n FROM spells').get().n,524);assert.deepEqual(d.prepare('PRAGMA foreign_key_check').all(),[]);}finally{d.close();}
});
