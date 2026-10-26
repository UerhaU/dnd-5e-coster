import assert from 'node:assert/strict';
import { test,after } from 'node:test';
import { mkdtempSync,rmSync,rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createCatalog } from './build-spell-catalog.mjs';
import { applyEquipment,equipmentPayload } from './equipment-model.mjs';
import { applyCatalogAudit,auditSnapshot } from './catalog-audit-model.mjs';
import { applyAuditCorrections,applyAuditSemantics,applyRuidiumTravel,applyDelayedOutcomes } from './catalog-audit-corrections.mjs';
import { EquipmentCatalog } from '../backend/src/spell-catalog/equipment-repository.ts';
import { SpellCatalog } from '../backend/src/spell-catalog/repository.ts';
import { descriptionParagraphs } from './dndsu-description.mjs';
const directory=mkdtempSync(join(tmpdir(),'dnd-rules-audit-')),path=join(directory,'catalog.sqlite');
createCatalog(path,{includeFullSpells:false});const db=new DatabaseSync(path),equipment=new EquipmentCatalog(path),spells=new SpellCatalog(path);
after(()=>{equipment.close();spells.close();db.close();rmSync(path);rmdirSync(directory);});
const item=siteId=>equipment.detail(200000+siteId);
const rules=(siteId,stat)=>item(siteId).rules.filter(r=>r.statCode===stat&&r.source===item(siteId).name);
const folded=value=>value.toLowerCase().replaceAll('ё','е').replace(/[^\p{L}\p{N}]/gu,'');

test('парсер сохраняет вложенные списки, таблицы и текст после вложенного div, исключая комментарии страницы',()=>{
  const html='<div itemprop="description"><p>Введение</p><ul><li>Бонус +2</li><li><div>2к6 урона</div><ul><li>Сл 20</li></ul></li></ul><table><tr><td>Холод</td><td>Сопротивление</td></tr></table><p>После списка &amp; таблицы</p></div><p>Комментарии</p>';
  assert.equal(descriptionParagraphs(html).join(' '),'Введение Бонус +2 2к6 урона Сл 20 Холод | Сопротивление После списка & таблицы');
});

test('280 источников 2014 сверены, восстановленные списки не теряются при создании базы',()=>{
  const snapshot=auditSnapshot();assert.equal(snapshot.sources.length,280);assert.ok(snapshot.sources.every(s=>s.url.startsWith('https://5e14.dnd.su/')&&s.sha256.length===64));
  const changed=snapshot.sources.filter(s=>s.previousDescription&&folded(s.previousDescription)!==folded(s.description));assert.equal(changed.length,43);
  for(const s of snapshot.sources.filter(s=>s.key.startsWith('item-')))assert.equal(item(Number(s.key.slice(5))).description,s.description);
  assert.ok(item(10778).description.includes('3к10'));assert.ok(item(10841).description.includes('Силы равен 18'));assert.ok(item(2252).description.includes('Сл спасброска 21'));
});
test('каждый магический доспех и щит включён в проверку, ссылки и SQL целы',()=>{
  const armor=equipmentPayload().magic.filter(x=>x.typeLine.startsWith('Доспех'));assert.equal(armor.length,67);
  for(const a of armor)assert.equal(item(a.siteId).numericReviewed,true,a.name);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
});
test('утраченные прибавки КБ записаны отдельно от основы и бонуса щита',()=>{
  for(const[id,value]of[[115,3],[116,1],[122,2],[2240,2],[2252,2],[2165,1],[259,1]])assert.ok(rules(id,'armor_class').some(r=>r.expression===String(value)&&r.operatorCode==='add'),String(id));
  const shield=item(2240);assert.equal(shield.rules.filter(r=>r.statCode==='armor_class'&&r.expression==='2').length,2);
  assert.ok(rules(123,'armor_class')[0].conditions.tests.some(t=>t.factCode==='incoming_ranged_attack'&&t.value===1));
});
test('особая формула змеиной чешуи заменяет основу; эльфийская кольчуга не штрафует за отсутствие владения',()=>{
  const snake=item(2119);const base=snake.rules.filter(r=>r.operatorCode==='base');assert.equal(base.length,1);assert.equal(base[0].expression,'14 + мод. (Ловкость)');assert.equal(base[0].stackingMode,'override');
  assert.ok(!item(259).rules.some(r=>r.conditions?.tests.some(t=>t.factCode==='armor_proficient')));
  assert.equal(item(10836).weightLb,10);
});
test('сопротивление выбирается одно; проклятая уязвимость относится к двум оставшимся типам',()=>{
  const armor=item(37);assert.equal(armor.variants.length,10);assert.ok(!armor.rules.some(r=>r.operatorCode==='resistance'));
  const fire=armor.variants.find(v=>v.name.includes('Огонь'));const selected=equipment.detail(armor.id,undefined,fire.id);assert.deepEqual(selected.rules.filter(r=>r.operatorCode==='resistance').map(r=>r.damage.name),['Огонь']);
  const vulnerability=item(38),choice=vulnerability.variants.find(v=>v.name.includes('Колющий'));
  const resolved=equipment.detail(vulnerability.id,undefined,choice.id);assert.deepEqual(resolved.rules.filter(r=>r.operatorCode==='resistance').map(r=>r.damage.name),['Колющий']);assert.equal(resolved.rules.filter(r=>r.operatorCode==='vulnerability').length,2);assert.ok(resolved.rules.filter(r=>r.operatorCode==='vulnerability').every(r=>r.context.persistentCurse));
});
test('руидиевое оружие: 2к6 психического урона, Харизма Сл20, два отдельных последствия провала',()=>{
  const weapon=item(3617);const damage=weapon.rules.find(r=>r.roll==='2к6');assert.equal(damage.damage.name,'Психическая энергия');assert.equal(damage.scope,'source_weapon');
  const corruption=weapon.rules.find(r=>r.context?.save);assert.equal(corruption.context.save.dc,20);assert.equal(corruption.context.save.ability,'Харизма');assert.equal(corruption.context.activation,'Натуральная 1 на атаке этим оружием');
  assert.equal(corruption.context.outcomes.find(o=>o.name==='Истощение').value,1);assert.equal(corruption.context.outcomes.find(o=>o.name==='Руидиевая порча').context.condition,'Руидиевая порча');
  assert.equal(weapon.status,'structured');assert.equal(weapon.unresolvedCount,0);
  assert.equal(weapon.rules.find(r=>r.statCode==='swim_speed').context.copyStat,'Скорость (футы)');assert.ok(weapon.rules.some(r=>r.statCode==='underwater_breathing'));assert.ok(weapon.rules.find(r=>r.statCode==='swim_speed').conditions.tests.some(t=>t.factCode==='carried'&&t.value===1));
});
test('руидиевые доспех/щит не путают триггеры и Сл; после уничтожения руидия бонус не требует настройки',()=>{
  const armor=item(3615),shield=item(3616);assert.equal(armor.rules.find(r=>r.context?.save).context.save.dc,15);assert.equal(shield.rules.find(r=>r.context?.save).context.save.dc,20);
  assert.equal(armor.rules.find(r=>r.context?.save).context.activation,'Натуральная 1 на спасброске');assert.equal(shield.rules.find(r=>r.context?.save).context.activation,'После психического отражения');
  const finalAc=rules(3615,'armor_class')[0];assert.equal(finalAc.expression,'1');assert.ok(!finalAc.conditions.tests.some(t=>t.factCode==='attuned'));assert.ok(finalAc.conditions.tests.some(t=>t.factCode==='ruidium_destroyed'&&t.value===1));
  assert.equal(rules(3616,'redirect_damage')[0].context.range,30);assert.equal(rules(3615,'swim_speed')[0].context.copyStat,'Скорость (футы)');
});
test('заряды, восстановление, стоимость и заклинания доспеха связаны по ID',()=>{
  const armor=item(7143);assert.equal(armor.resources[0].capacity,5);assert.equal(armor.resources[0].recoveryRoll,'1к4 + 1');
  assert.equal(armor.rules.find(r=>r.context?.spell?.name==='Левитация').context.cost.quantity,2);
  const lord=item(2252);assert.equal(lord.resources[0].capacity,3);const fireball=lord.rules.find(r=>r.context?.spell?.name==='Огненный шар');assert.equal(fireball.context.spell.spellId,10001);assert.equal(fireball.context.save.dc,21);assert.equal(fireball.context.cost.quantity,1);
});
test('стадии артефакта, бросок щита и динамическая Сл хранятся раздельно',()=>{
  const hide=item(2316),exalted=hide.variants.find(v=>v.enhancement===3);assert.equal(hide.selectedVariantId,null);const selected=equipment.detail(hide.id,undefined,exalted.id);assert.equal(selected.rules.find(r=>r.source===hide.name&&r.statCode==='armor_class').expression,'3');
  const throwRule=item(7149).rules.find(r=>r.roll==='1к6');assert.equal(throwRule.damage.name,'Рубящий');assert.equal(throwRule.context.range,20);assert.equal(throwRule.context.longRange,60);assert.equal(throwRule.context.alternateAbility,'Ловкость');
  const bash=item(6464).rules.find(r=>r.damage?.name==='Дробящий');assert.equal(bash.context.save.formula,'8 + модификатор (Сила) + бонус мастерства');assert.equal(bash.context.maximumPerTurn,1);assert.equal(bash.context.save.success,'Половина урона');
});
test('последствия одноразовые; сопротивления не суммируются, базовый урон рукавиц не становится добавочным',()=>{
  const corruption=item(3617).rules.find(r=>r.context?.save);assert.ok(corruption.context.outcomes.every(o=>o.context.activation==='После провала указанного спасброска'));
  assert.ok(rules(115,'damage_taken').every(r=>r.stackingMode==='highest'));
  assert.equal(item(32).rules.find(r=>r.roll==='1к8').statCode,'base_damage');assert.equal(item(32).attacks[0].roll,'1к8');
  assert.equal(item(7149).attacks[0].maxRange,60);
  assert.equal(rules(6443,'maximum_hp')[0].expression,'10 + Уровень персонажа');
  assert.ok(rules(10778,'fly_speed')[0].conditions.tests.some(t=>t.factCode==='armor_active'&&t.value===1));
  const petrification=item(7175).rules.find(r=>r.context?.save);assert.equal(petrification.context.outcomes.find(o=>o.context?.save).context.activation,'В начале следующего хода цели');assert.equal(petrification.context.outcomes.find(o=>o.context?.save).context.outcomes[0].context.durationValue,24);
  assert.equal(item(2252).rules.find(r=>r.context?.save?.dc===18).scope,'target');
});
test('проверены значения четырёх заклинаний; Благословение и его цели больше не зависят от фраз',()=>{
  const fire=spells.detail(10001);assert.equal(fire.school.name,'Воплощение');assert.equal(fire.level,3);assert.equal(fire.effects[0].roll,'8к6');assert.equal(fire.effects[0].saveAbility,'Ловкость');assert.equal(fire.areas[0].radiusFt,20);
  const cure=spells.detail(10002);assert.equal(cure.effects[0].roll,'1к8 + модификатор заклинателя');assert.deepEqual(cure.numericRules.excludedCreatureTypes,['Нежить','Конструкт']);
  const identify=spells.detail(10003);assert.equal(identify.numericRules.continuousTouch,true);assert.deepEqual(identify.castingTimes,['1 минута']);assert.equal(identify.ritual,true);
  const bless=spells.detail(10004);assert.equal(bless.effects[0].roll,'1к4');assert.equal(bless.numericRules.maximumTargets,3);assert.equal(bless.numericRules.additionalTargetsPerSlot,1);assert.deepEqual(bless.effects[0].ruleTargets.map(x=>x.stat),['Бросок атаки','Спасброски']);
  db.exec("UPDATE effects SET modified_stat='WRONG' WHERE id=3004;UPDATE spells SET targets_text='WRONG',higher_levels_text='WRONG' WHERE id=10004;UPDATE spell_numeric_rules SET maximum_targets=4 WHERE spell_id=10004;");
  assert.ok(!JSON.stringify(spells.detail(10004)).includes('WRONG'));assert.ok(spells.detail(10004).targets.includes('4'));
  db.exec("UPDATE spell_effects SET on_success='WRONG' WHERE id=4001");assert.equal(spells.detail(10001).effects[0].onSuccess,'Половина урона');
});
test('повторное исправление не меняет пользовательские иконки; локальное описание защищено откатом',()=>{
  db.prepare('UPDATE items SET icon_url=? WHERE id=203617').run('/icons/test.svg');assert.deepEqual(applyCatalogAudit(db),{changed:false});assert.deepEqual(applyAuditCorrections(db),{changed:false});assert.deepEqual(applyAuditSemantics(db),{changed:false});assert.deepEqual(applyRuidiumTravel(db),{changed:false});assert.deepEqual(applyDelayedOutcomes(db),{changed:false});assert.equal(item(3617).iconUrl,'/icons/test.svg');
  const rawPath=join(directory,'raw.sqlite');createCatalog(rawPath,{includeEquipment:false});const raw=new DatabaseSync(rawPath);try{applyEquipment(raw);raw.prepare('UPDATE gear_entries SET description=? WHERE item_id=200001').run('User description');assert.throws(()=>applyCatalogAudit(raw),/local changes/);assert.equal(raw.prepare('SELECT description FROM gear_entries WHERE item_id=200001').get().description,'User description');assert.equal(raw.prepare("SELECT 1 FROM sqlite_master WHERE name='effect_context'").get(),undefined);assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(),[]);}finally{raw.close();rmSync(rawPath);}
});
