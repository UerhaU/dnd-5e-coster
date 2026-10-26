import assert from 'node:assert/strict';
import { test,after } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,mkdtempSync,rmSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createCatalog } from './build-spell-catalog.mjs';
import { applyFullSpells,fullSpellData } from './full-spell-catalog.mjs';
import { materialRecipe,recipeLeaves } from './spell-materials.mjs';
import { SpellCatalog } from '../backend/src/spell-catalog/repository.ts';
import { EquipmentCatalog } from '../backend/src/spell-catalog/equipment-repository.ts';
import { buildSpellCatalogServer } from '../backend/src/spell-catalog/app.ts';

mkdirSync(resolve('storage/catalog-tests'),{recursive:true});
const directory=mkdtempSync(resolve('storage/catalog-tests/full-spells-')),path=join(directory,'catalog.sqlite');
const built=createCatalog(path),db=new DatabaseSync(path),spells=new SpellCatalog(path),equipment=new EquipmentCatalog(path),server=buildSpellCatalogServer(path,false);
const id=site=>Number(db.prepare('SELECT id FROM spells WHERE site_id=?').get(String(site)).id);
const spell=site=>spells.detail(id(site));
const byName=name=>{const row=fullSpellData.spells.find(s=>s.originalName.toLowerCase()===name.toLowerCase());assert.ok(row,name);return spell(row.siteId);};
const material=(s,name)=>s.materials.flatMap(g=>g.requirements).find(m=>m.item.name===name);
after(async()=>{await server.close();spells.close();equipment.close();db.close();rmSync(directory,{recursive:true});});

test('524 официальных заклинания 2014 и обе пропущенные старым импортом записи; прежние ID сохранены',()=>{
 assert.equal(built.spells,524);assert.equal(spells.list().total,524);
 assert.equal(id(205),10001);assert.equal(id(145),10002);assert.equal(id(210),10003);assert.equal(id(9),10004);
 assert.equal(spell(478).originalName.toLowerCase(),'shadow of moil');assert.equal(spell(499).originalName.toLowerCase(),'create homunculus');
 assert.equal(db.prepare('SELECT count(*) n FROM spells WHERE edition_id<>1').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM spell_catalog_entries WHERE length(source_hash)=64').get().n,524);
 assert.equal(db.prepare('SELECT count(*) n FROM spells WHERE level=0').get().n,46);
 assert.equal(db.prepare('SELECT count(*) n FROM spells WHERE icon_url IS NOT NULL').get().n,0);
});
test('все карточки доступны; классы, источники, описания и временные параметры заполнены',()=>{
 for(const s of fullSpellData.spells){const card=spell(s.siteId);assert.equal(card.name,s.name);assert.ok(card.description?.length,card.name);assert.ok(card.castingTimes.length);assert.ok(card.range);assert.ok(card.duration);assert.ok(card.sources.length);assert.ok(card.classAccess.length||card.subclasses.length||s.siteId===741,card.name);assert.ok(card.catalog);}
 assert.ok(spell(741).description.includes('Оперативникам Димиров'));assert.equal(spell(741).duration,'До 8 часов');
 assert.deepEqual(byName('Plant growth').castingTimes,['1 действие','8 часов']);
 assert.equal(byName('Silvery barbs').castingTimes.length,1);
 assert.equal(byName('Silvery barbs').castingTimes[0].includes('спасброске'),true);
 assert.equal(byName('Hunter’s mark'.replace('’',"'")).catalog.durationScaling[1].duration,'24 часа');
});
test('каждый из 280 материальных составов разобран, без цены и количества в именах предметов',()=>{
 let recipes=0;
 for(const s of fullSpellData.spells){const recipe=materialRecipe(s);if(recipe){recipes++;const leaves=recipeLeaves(recipe.node);assert.ok(leaves.length);assert.equal(spell(s.siteId).materials.flatMap(g=>g.requirements).length,leaves.length,s.name);for(const leaf of leaves){assert.ok(!/\d|расходует|\bзм\b/.test(leaf.name),leaf.name);assert.equal(leaf.quantity==null,leaf.unit==null);}}}
 assert.equal(recipes,280);
 assert.equal(byName('Gift of gab').components,'В, С, А (авторские отчисления)');assert.equal(byName('Gift of gab').materials.length,0);assert.equal(byName('Gift of gab').catalog.costs[0].amountCp,200);
});
test('предметы и формулы переиспользуются; материал меняется по ID сразу во всех карточках',()=>{
 const sulfur=material(byName('Fireball'),'Сера');assert.equal(sulfur.item.id,5002);
 const other=material(byName('Flaming sphere'),'Сера');assert.equal(other.item.id,5002);
 db.prepare('UPDATE items SET name_ru=? WHERE id=?').run('Проверка общего предмета',5002);
 assert.ok(byName('Fireball').materials.flatMap(g=>g.requirements).some(m=>m.item.name==='Проверка общего предмета'));assert.ok(byName('Flaming sphere').materials.flatMap(g=>g.requirements).some(m=>m.item.name==='Проверка общего предмета'));
 db.prepare('UPDATE items SET name_ru=? WHERE id=?').run('Сера',5002);
 assert.equal(db.prepare("SELECT count(DISTINCT e.roll_formula_id) n FROM effects e JOIN spell_effects x ON x.effect_id=e.id WHERE e.roll_formula_id=2004").get().n,1);
});
test('AND/OR вложены: язык змеи И (соты ИЛИ масло); существо не превращается в товар',()=>{
 const suggestion=byName('Suggestion'),tree=suggestion.catalog.materialTree;assert.equal(tree.kind,'all');assert.equal(tree.children[1].kind,'any');assert.equal(tree.children[1].children.length,2);
 const veil=byName('Dream of the blue veil').catalog.materialTree;assert.equal(veil.kind,'any');assert.equal(veil.children[1].kind,'prerequisite');assert.ok(veil.children[1].prerequisite.includes('Согласное существо'));
});
test('расход и стоимость компонентов различаются: Клон, Знание легенд, Оживление, Маген',()=>{
 const clone=byName('Clone');assert.equal(material(clone,'Алмаз').consumption,'Расходуется');assert.equal(material(clone,'Сосуд для клона').consumption,'Не расходуется');assert.equal(material(clone,'Сосуд для клона').minimumValueCp,200000);
 const lore=byName('Legend lore');assert.equal(material(lore,'Пластинка из слоновой кости').quantity,4);assert.equal(material(lore,'Пластинка из слоновой кости').minimumValueCp,5000);assert.equal(material(lore,'Благовония').consumption,'Расходуется');
 assert.equal(byName('Revivify').catalog.materialTree.minimumValueCp,30000);assert.equal(material(byName('Revivify'),'Алмаз').minimumValueCp,null);
 assert.equal(material(byName('Create magen'),'Хрустальный жезл').consumption,'Не расходуется');
});
test('Указание, Порча, Щит и Доспехи мага содержат модификаторы, операции и характеристики',()=>{
 const shield=byName('Shield').catalog.rules.find(r=>r.stat==='Класс брони');assert.equal(shield.value,5);assert.equal(shield.operator,'Прибавка');
 const mage=byName('Mage armor').catalog.rules[0];assert.equal(mage.value,13);assert.equal(mage.ability,'Ловкость');assert.equal(mage.operator,'Базовая формула');
 assert.equal(byName('Guidance').catalog.rules[0].roll,'1к4');assert.equal(byName('Bane').catalog.rules[0].operator,'Уменьшить');
 assert.equal(byName('Haste').catalog.rules.find(r=>r.stat==='Скорость (футы)').value,2);
});
test('Волшебная стрела, Мистический заряд и Палящий луч хранят количество отдельно от броска',()=>{
 const missile=byName('Magic missile').catalog.rules[0];assert.equal(missile.roll,'1к4 + 1');assert.equal(missile.repeatCount,3);assert.equal(missile.resolution,'автоматически');assert.ok(missile.scaling.some(s=>s.includes('+1')));
 const blast=byName('Eldritch blast').catalog.rules[0];assert.equal(blast.roll,'1к10');assert.equal(blast.repeatCount,1);assert.deepEqual(blast.scaling.map(s=>s.match(/Количество (\d)/)?.[1]),['2','3','4']);
 assert.equal(byName('Scorching ray').catalog.rules[0].repeatCount,3);
});
test('ячейки, уровни персонажа и особый шаг роста урона не смешиваются',()=>{
 const fire=byName('Fire bolt').catalog.rules[0];assert.equal(fire.roll,'1к10');assert.ok(fire.scaling[0].includes('2к10'));assert.ok(fire.scaling[2].includes('4к10'));
 assert.ok(byName('Spiritual weapon').catalog.rules[0].scaling[0].includes('начиная с 4, каждые 2'));
 assert.ok(byName('Hunter\'s mark').catalog.rules[0].scaling.length===0);
 const ice=byName('Ice knife').catalog.rules;assert.equal(ice[0].scaling.length,0);assert.equal(ice[0].resolution,'дальнобойная атака');assert.equal(ice[1].saveAbility,'Ловкость');assert.equal(ice[1].onSuccess,'Без эффекта');assert.ok(ice[1].scaling[0].includes('1к6'));
 assert.ok(!byName('Elemental weapon').catalog.rules.some(r=>r.stat==='Бросок урона'));
});
test('спасброски распознаны во всех падежах; разбор сложных условий честно отмечен частичным',()=>{
 assert.equal(byName('Acid splash').catalog.rules[0].saveAbility,'Ловкость');assert.equal(byName('Sacred flame').catalog.rules[0].saveAbility,'Ловкость');
 assert.equal(byName('Hellish rebuke').catalog.rules[0].onSuccess,'Половина урона');
 assert.equal(byName('Wish').catalog.mechanicsStatus,'partial');
 assert.ok(db.prepare("SELECT count(*) n FROM spell_save_mentions").get().n>200);
});
test('повторный импорт ничего не перезаписывает, оружие и броня остаются доступны',()=>{
 db.prepare("UPDATE spells SET icon_url='/icons/test.svg' WHERE id=10003").run();
 assert.equal(applyFullSpells(db),false);assert.equal(spells.detail(10003).iconUrl,'/icons/test.svg');
 db.prepare('UPDATE spells SET icon_url=NULL WHERE id=10003').run();
 assert.equal(equipment.list().total,342);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});
test('API выдаёт полный список и выбранные карточки; поиск и фильтры работают',async()=>{
 const list=await server.inject('/api/spellbook/spells');assert.equal(list.statusCode,200);assert.equal(list.json().total,524);
 const result=await server.inject('/api/spellbook/spells?q=гомункул');assert.equal(result.json().spells.length,1);
 const detail=await server.inject(`/api/spellbook/spells/${id(499)}`);assert.equal(detail.statusCode,200);assert.ok(detail.json().catalog.materialTree);
 const ritual=await server.inject('/api/spellbook/spells?ritual=true&level=1');assert.ok(ritual.json().spells.length>1);assert.ok(ritual.json().spells.every(s=>s.ritual&&s.level===1));
 assert.equal((await server.inject('/api/characters')).statusCode,404);
});
