import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { materialRecipe } from './spell-materials.mjs';
import { spellRuleData, spellKey } from './spell-rule-parser.mjs';
import { reviewedTargetCounts, targetPerSlot } from './spell-reviewed-rules.mjs';

export const fullSpellData=JSON.parse(readFileSync(new URL('../database/spells/full-catalog.json',import.meta.url),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
const fold=value=>value.toLowerCase().replaceAll('ё','е').replaceAll('’',"'").replace(/\s*\(2014\)\s*/g,'').trim();
export const fullSpellDdl=`
CREATE TABLE spell_catalog_entries(
 spell_id INTEGER PRIMARY KEY REFERENCES spells(id), site_id INTEGER NOT NULL UNIQUE,
 source_hash TEXT NOT NULL CHECK(length(source_hash)=64), checked_on TEXT NOT NULL,
 metadata_status TEXT NOT NULL CHECK(metadata_status='checked'),
 mechanics_status TEXT NOT NULL CHECK(mechanics_status IN('reviewed_core','partial')),
 duration_up_to INTEGER NOT NULL CHECK(duration_up_to IN(0,1))) STRICT;
CREATE TABLE spell_material_prerequisites(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL) STRICT;
CREATE TABLE spell_material_nodes(
 id INTEGER PRIMARY KEY,spell_id INTEGER NOT NULL REFERENCES spells(id),parent_id INTEGER REFERENCES spell_material_nodes(id),
 ordinal INTEGER NOT NULL CHECK(ordinal>0),kind TEXT NOT NULL CHECK(kind IN('all','any','item','prerequisite')),
 requirement_id INTEGER UNIQUE REFERENCES spell_material_requirements(id),prerequisite_id INTEGER REFERENCES spell_material_prerequisites(id),
 minimum_value_cp INTEGER CHECK(minimum_value_cp>=0),
 CHECK((kind='item' AND requirement_id IS NOT NULL AND prerequisite_id IS NULL) OR
 (kind='prerequisite' AND prerequisite_id IS NOT NULL AND requirement_id IS NULL) OR
 (kind IN('all','any') AND requirement_id IS NULL AND prerequisite_id IS NULL)),UNIQUE(parent_id,ordinal)) STRICT;
CREATE UNIQUE INDEX ix_spell_material_root ON spell_material_nodes(spell_id) WHERE parent_id IS NULL;
CREATE TABLE spell_material_usage(
 requirement_id INTEGER PRIMARY KEY REFERENCES spell_material_requirements(id),
 quantity_basis TEXT NOT NULL CHECK(quantity_basis IN('flat','per_target','per_eye')),
 price_basis TEXT NOT NULL CHECK(price_basis IN('flat','target_hit_die')),selector_code TEXT) STRICT;
CREATE TABLE spell_costs(spell_id INTEGER PRIMARY KEY REFERENCES spells(id),kind TEXT NOT NULL CHECK(kind='royalty'),
 amount_cp INTEGER NOT NULL CHECK(amount_cp>0),base_slot_level INTEGER NOT NULL CHECK(base_slot_level BETWEEN 1 AND 9),
 per_additional_slot_cp INTEGER NOT NULL CHECK(per_additional_slot_cp>=0)) STRICT;
CREATE TABLE spell_rule_contexts(
 spell_effect_id INTEGER PRIMARY KEY REFERENCES spell_effects(id),status TEXT NOT NULL CHECK(status IN('reviewed_core','parsed','description')),
 scope TEXT,trigger_code TEXT,choice_name TEXT,repeat_count INTEGER CHECK(repeat_count>0),repeat_per_slot INTEGER CHECK(repeat_per_slot>=0),
 uses_spellcasting_ability INTEGER NOT NULL DEFAULT 0 CHECK(uses_spellcasting_ability IN(0,1)),
 modifier_value REAL,save_dc INTEGER CHECK(save_dc>0),on_success_code TEXT CHECK(on_success_code IN('half','none')),
 paragraph_index INTEGER CHECK(paragraph_index>=0)) STRICT;
CREATE TABLE spell_numeric_scaling(
 id INTEGER PRIMARY KEY,spell_effect_id INTEGER NOT NULL REFERENCES spell_effects(id),
 basis TEXT NOT NULL CHECK(basis IN('slot','character')),threshold INTEGER NOT NULL CHECK(threshold>0),step INTEGER CHECK(step>0),
 operation TEXT NOT NULL CHECK(operation IN('set_value','add_value','set_count','add_count')),
 value REAL NOT NULL,UNIQUE(spell_effect_id,basis,threshold,operation)) STRICT;
CREATE TABLE spell_roll_mentions(id INTEGER PRIMARY KEY,spell_id INTEGER NOT NULL REFERENCES spells(id),
 formula_id INTEGER NOT NULL REFERENCES roll_formulas(id),paragraph_index INTEGER NOT NULL CHECK(paragraph_index>=0),
 offset_in_paragraph INTEGER NOT NULL CHECK(offset_in_paragraph>=0),context_text TEXT NOT NULL) STRICT;
CREATE TABLE spell_save_mentions(id INTEGER PRIMARY KEY,spell_id INTEGER NOT NULL REFERENCES spells(id),
 ability_id INTEGER NOT NULL REFERENCES abilities(id),fixed_dc INTEGER CHECK(fixed_dc>0),
 paragraph_index INTEGER NOT NULL CHECK(paragraph_index>=0),context_text TEXT NOT NULL) STRICT;
CREATE TABLE spell_duration_scaling(id INTEGER PRIMARY KEY,spell_id INTEGER NOT NULL REFERENCES spells(id),
 slot_level INTEGER NOT NULL CHECK(slot_level BETWEEN 1 AND 9),duration_value REAL NOT NULL CHECK(duration_value>0),
 unit_id INTEGER NOT NULL REFERENCES time_units(id),UNIQUE(spell_id,slot_level)) STRICT;
CREATE INDEX ix_spell_roll_mentions_spell ON spell_roll_mentions(spell_id);
CREATE INDEX ix_spell_save_mentions_spell ON spell_save_mentions(spell_id);
CREATE INDEX ix_spell_material_nodes_spell ON spell_material_nodes(spell_id);
`;

const statNames={magic_missile_damage:'Урон волшебной стрелы',additional_actions:'Дополнительные действия',reactions:'Реакции',attacks_per_turn:'Атак за ход',condition:'Состояние',maximum_hp:'Максимум хитов',current_hp:'Текущие хиты',weapon_damage_die:'Кубик урона оружия',weapon_attack_ability:'Характеристика атаки оружием',weapon_damage_ability:'Характеристика урона оружием',affected_hit_point_pool:'Суммарные хиты затрагиваемых существ',illusory_duplicates:'Иллюзорные копии',berries_created:'Созданные ягоды'};
const effectNames={damage:'Урон',healing:'Лечение',temporary_hp:'Временные хиты',condition:'Состояние',modifier:'Модификатор',creation:'Создание',control:'Контроль',other:'Особый бросок'};

export function applyFullSpells(db){
 const payload=fullSpellData.spells.map(spell=>({spell,material:materialRecipe(spell),rules:spellRuleData(spell)}));
 const hash=digest(JSON.stringify({version:1,payload,targets:reviewedTargetCounts,targetPerSlot:[...targetPerSlot]}));
 const installed=db.prepare("SELECT * FROM catalog_modules WHERE code='full_spells_2014'").get();
 if(installed){if(installed.data_hash!==hash)throw new Error('Full spell catalog changed; an explicit additive migration is required.');return false;}
 const insert=(table,row)=>{
  const columns=Object.keys(row),values=Object.values(row).map(v=>v===undefined?null:v);
  return Number(db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...values).lastInsertRowid);
 };
 const get=(table,code)=>{const row=db.prepare(`SELECT id FROM ${table} WHERE code=?`).get(code);if(!row)throw new Error(`Unknown ${table}: ${code}`);return Number(row.id);};
 const named=(table,code,name,extra={})=>db.prepare(`SELECT id FROM ${table} WHERE code=?`).get(code)?.id??insert(table,{code,name_ru:name,...extra});
 const byName=(table,name)=>db.prepare(`SELECT id,name_ru FROM ${table}`).all().find(row=>fold(row.name_ru)===fold(name))?.id;
 const termsCache=new Map();
 const signature=terms=>JSON.stringify(terms.map(t=>[t.kind,t.die_id??null,t.dice_count??null,t.constant_value??null,t.ability_id??null,t.use_spellcasting_ability??0,t.coefficient??1]));
 for(const formula of db.prepare('SELECT id FROM roll_formulas ORDER BY id').all()){
  const sig=signature(db.prepare('SELECT * FROM roll_terms WHERE formula_id=? ORDER BY ordinal').all(formula.id));if(!termsCache.has(sig))termsCache.set(sig,formula.id);
 }
 function roll(expression){
  if(expression==null)return null;
  const parts=String(expression).replaceAll(' ','').replaceAll('d','к').split('+'),terms=[];
  for(const part of parts){
   if(part==='SC')terms.push({kind:'модификатор',use_spellcasting_ability:1});
   else if(/^\d+к\d+$/.test(part)){const[count,sides]=part.split('к').map(Number);const die=db.prepare('SELECT id FROM dice WHERE sides=?').get(sides);if(!die)throw new Error(`Unsupported die: ${expression}`);terms.push({kind:'кубики',die_id:die.id,dice_count:count});}
   else if(/^\d+$/.test(part))terms.push({kind:'константа',constant_value:Number(part)});
   else throw new Error(`Unsupported roll: ${expression}`);
  }
  const sig=signature(terms);if(termsCache.has(sig))return termsCache.get(sig);
  const id=insert('roll_formulas',{code:`spell_roll:${digest(sig).slice(0,24)}`,name_ru:expression,source_expression:expression});
  terms.forEach((t,i)=>insert('roll_terms',{formula_id:id,ordinal:i+1,...t}));termsCache.set(sig,id);return id;
 }
 function time(text){const m=text.match(/(\d+)\s*(раунд|минут|час|дн|день|дня)/i);if(!m)return null;return{value:Number(m[1]),unit:get('time_units',/раунд/i.test(m[2])?'round':/минут/i.test(m[2])?'minute':/час/i.test(m[2])?'hour':'day')};}
 function range(text){
  const n=text.match(/^(\d+)\s*(фут|мил)/i);
  if(n)return{range_type_id:get('range_types','distance'),range_ft:Number(n[1])*(n[2].startsWith('мил')?5280:1)};
  return{range_type_id:get('range_types',/^На себя/i.test(text)?'self':/^Касание/i.test(text)?'touch':/видимости/i.test(text)?'sight':/Неограниченная|Без ограничений/i.test(text)?'unlimited':'special'),range_text:text};
 }
 function duration(text){
  const timed=time(text);if(timed&&!/ или /i.test(text))return{duration_type_id:get('duration_types','timed'),duration_value:timed.value,duration_unit_id:timed.unit};
  const code=text==='Мгновенная'?'instant':text==='Пока не рассеяно'?'dispelled':/или не сработает/.test(text)?'trigger':'special';
  return{duration_type_id:get('duration_types',code),duration_text:text};
 }
 function casting(spellId,text){
  (text==='1 действие или 8 часов'?text.split(' или '):[text]).forEach((part,i)=>{
   const action=/^1 бонусное действие/.test(part)?'bonus_action':/^1 действие/.test(part)?'action':/^1 реакция/.test(part)?'reaction':null;
   const t=time(part),trigger=action==='reaction'?part.replace(/^1 реакция,?\s*/,''):null;
   insert('spell_casting_times',{spell_id:spellId,ordinal:i+1,...(action?{action_type_id:get('action_types',action),action_count:1,reaction_trigger:trigger}:t?{time_value:t.value,time_unit_id:t.unit}:{source_text:part})});
  });
 }
 function material(spellId,recipe){
  if(!recipe)return;
  const groupId=insert('spell_material_groups',{spell_id:spellId,ordinal:1,selection_mode:recipe.node.kind==='any'?'один из':'все',description:null});let ordinal=0;
  function visit(node,parentId=null,position=1){
   let requirement=null,prerequisite=null;
   if(node.kind==='item'){
    const itemId=byName('items',node.name)??insert('items',{code:`spell_material:${digest(fold(node.name)).slice(0,24)}`,name_ru:node.name,unit_id:node.unit?get('quantity_units',node.unit):null});
    requirement=insert('spell_material_requirements',{group_id:groupId,ordinal:++ordinal,item_id:itemId,quantity:node.quantity,unit_id:node.unit?get('quantity_units',node.unit):null,minimum_item_value_cp:node.minimumValueCp,consumption_mode_id:get('consumption_modes',node.consumption),consumption_condition:node.consumptionCondition,special_requirements:node.special});
    insert('spell_material_usage',{requirement_id:requirement,quantity_basis:node.quantityBasis??'flat',price_basis:node.priceBasis??'flat',selector_code:node.selector});
   }
   if(node.kind==='prerequisite')prerequisite=named('spell_material_prerequisites',node.code,node.name);
   const id=insert('spell_material_nodes',{spell_id:spellId,parent_id:parentId,ordinal:position,kind:node.kind,requirement_id:requirement,prerequisite_id:prerequisite,minimum_value_cp:node.minimumGroupValueCp});
   node.children?.forEach((child,i)=>visit(child,id,i+1));
  }
  visit(recipe.node);
 }
 function area(spell,spellId){
  const text=spell.range;let m=text.match(/(\d+)-футов\S* (радиус|конус|куб|линия)/i),shape,value;
  if(m){shape=({радиус:'sphere',конус:'cone',куб:'cube',линия:'line'})[m[2]];value=Number(m[1]);}
  else if((m=text.match(/радиус(?:ом)? (\d+) (фут|мил)/))){shape='sphere';value=Number(m[1])*(m[2]==='мил'?5280:1);}
  if(shape)insert('spell_areas',{spell_id:spellId,ordinal:1,shape_id:get('area_shapes',shape),...(shape==='sphere'?{radius_ft:value}:{length_ft:value}),description:/полусфера/.test(text)?'Полусфера.':null});
 }
 function scaling(effectLink,spell,r){
  let ordinal=0;
  const addRoll=(expression,threshold,step,basis='уровень ячейки',operation='добавить формулу')=>insert('spell_scaling',{spell_effect_id:effectLink,ordinal:++ordinal,basis,threshold,step,operation,roll_formula_id:roll(expression)});
  if(r.noScaling)return;
  if(r.cantripDice){const[count,sides]=r.cantripDice.split('к').map(Number);for(const[level,multiplier]of[[5,2],[11,3],[17,4]])addRoll(`${count*multiplier}к${sides}`,level,null,'уровень персонажа','заменить формулу');return;}
  for(const v of r.scaling??[]){
   if(v.roll)addRoll(v.roll,v.level,null,'уровень ячейки','заменить формулу');
   else insert('spell_numeric_scaling',{spell_effect_id:effectLink,basis:'slot',threshold:v.level,operation:'set_value',value:v.value});
  }
  if(r.scalarPerSlot)insert('spell_numeric_scaling',{spell_effect_id:effectLink,basis:'slot',threshold:spell.level+1,step:1,operation:'add_value',value:r.scalarPerSlot});
  if(r.repeatPerSlot)insert('spell_numeric_scaling',{spell_effect_id:effectLink,basis:'slot',threshold:spell.level+1,step:1,operation:'add_count',value:r.repeatPerSlot});
  for(const v of r.beamLevels??[])insert('spell_numeric_scaling',{spell_effect_id:effectLink,basis:'character',threshold:v.level,operation:'set_count',value:v.count});
  if(r.scalingAdd){addRoll(r.scalingAdd,r.scalingStart??spell.level+1,r.scalingStep??1);return;}
  if(!r.roll||r.scaling?.length||r.beamLevels||r.repeatPerSlot||r.scalarPerSlot)return;
  const higher=spell.higherLevels??'';
  if(spell.level>0){
   const match=higher.match(/(?:урон|лечение|восстанавливаем\S* хит\S*|количество (?:восстанавливаем\S* )?хитов)[^.]*?(?:увеличива\S*|возраста\S*) на (\d+к\d+)[^.]*за каждый уровень ячейки/i);
   if(match&&['damage','healing','temporary_hp'].includes(r.kind))addRoll(match[1],spell.level+1,1);
  }else{
   const p=spell.description.split(/\n\s*\n/).find(t=>/(?:урон.*(?:увеличива|возраста)|на \d+.*уровне)/i.test(t)&&/5/.test(t)&&/11/.test(t)&&/17/.test(t));
   if(p&&r.kind==='damage'){
    const rolls=[...p.matchAll(/\((\d+)к(\d+)\)/g)].map(m=>({count:Number(m[1]),sides:Number(m[2])}));
    const base=r.roll.match(/^(\d+)к(\d+)/);if(base&&rolls.length===3&&rolls.every(v=>v.sides===Number(base[2])))for(const[level,index]of[[5,0],[11,1],[17,2]])addRoll(`${rolls[index].count}к${rolls[index].sides}`,level,null,'уровень персонажа','заменить формулу');
   }
  }
 }
 function effects(spell,spellId,data){
  for(const mention of data.mentions)insert('spell_roll_mentions',{spell_id:spellId,formula_id:roll(mention.roll),paragraph_index:mention.paragraph,offset_in_paragraph:mention.offset,context_text:mention.context});
  for(const save of data.saves)insert('spell_save_mentions',{spell_id:spellId,ability_id:get('abilities',save.ability),fixed_dc:save.dc,paragraph_index:save.paragraph,context_text:save.context});
  for(const[rIndex,r]of data.effects.entries()){
   const formula=roll(r.roll??(r.spellcasting?'SC':Number.isInteger(r.value)?String(Math.abs(r.value)):null));
   const type=get('effect_types',r.kind==='control'?'control':r.kind==='creation'?'creation':r.kind==='temporary_hp'?'temporary_hp':r.kind==='modifier'?'modifier':r.kind==='other'?'other':r.kind);
   // Only intrinsic mechanics enter the reusable effect. Timing and targets belong to the spell link.
   const intrinsic={type,formula,damage:r.damage??null,choices:r.choices??[],condition:r.condition??null,stat:r.stat??null,op:r.op??null,value:r.value??null,ability:r.ability??null,spellcasting:r.spellcasting??false};
   const code=`spell_effect:${digest(JSON.stringify(intrinsic)).slice(0,24)}`;
   let effectId=db.prepare('SELECT id FROM effects WHERE code=?').get(code)?.id;
   if(!effectId){
    effectId=insert('effects',{code,name_ru:effectNames[r.kind]??'Эффект',effect_type_id:type,roll_formula_id:formula,damage_type_id:r.damage?get('damage_types',r.damage):null,choose_damage_type:Number(Boolean(r.choices?.length)),condition_id:r.condition?get('conditions',r.condition):null,automation:'справочно'});
    for(const choice of r.choices??[])insert('effect_damage_choices',{effect_id:effectId,damage_type_id:get('damage_types',choice)});
    if(r.stat){
     const stat=named('rule_stats',r.stat,statNames[r.stat]??r.stat),op=named('rule_operators',r.op??'add',r.op==='minimum'?'Нижний предел':r.op??'Прибавка');
     insert('effect_mechanics',{effect_id:effectId,stat_id:stat,operator_id:op,stacking_group:`spell:${r.stat}`,stacking_mode:r.op==='base'?'choose_one':['add','subtract'].includes(r.op??'add')?'add':'override'});
     if(r.value!=null)insert('mechanic_terms',{effect_id:effectId,ordinal:1,kind:'constant',constant_value:r.value});
     if(r.ability)insert('mechanic_terms',{effect_id:effectId,ordinal:r.value==null?1:2,kind:'ability',ability_id:get('abilities',r.ability)});
    }
   }
   const save=r.save??null,link=insert('spell_effects',{spell_id:spellId,effect_id:effectId,ordinal:rIndex+1,resolution_type:r.resolution??(save?'спасбросок':'особое'),save_ability_id:save?get('abilities',save):null,on_success:r.onSuccess==='half'?'Половина урона':null,application_condition:r.conditionText,trigger_timing:r.trigger});
   insert('spell_rule_contexts',{spell_effect_id:link,status:r.descriptionOnly?'description':r.parsed?'parsed':'reviewed_core',scope:r.scope,trigger_code:r.trigger,choice_name:r.choice,repeat_count:r.repeatCount,repeat_per_slot:r.repeatPerSlot,uses_spellcasting_ability:Number(Boolean(r.spellcasting)),modifier_value:r.value,save_dc:r.saveDc,on_success_code:r.onSuccess,paragraph_index:r.paragraph});
   if(r.stat)insert('spell_effect_rule_links',{spell_effect_id:link,stat_id:get('rule_stats',r.stat),operator_id:get('rule_operators',r.op??'add')});
   scaling(link,spell,r);
  }
 }
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(fullSpellDdl);
  named('quantity_units','cup','Чашка');named('quantity_units','cubic_inch','Кубический дюйм');named('quantity_units','foot','Фут');
  named('component_types','R','Авторские отчисления');
  const sourceMap=new Map(fullSpellData.sources.map(source=>[source.id,byName('sources',source.name)??named('sources',`dndsu_spell_source:${source.id}`,source.name,{edition_id:1})]));
  const classMap=new Map(fullSpellData.classes.map(c=>[c.id,byName('classes',c.name)]));
  const subclassSource=named('sources','dndsu_subclass_access_2014','DnD.su: доступ подклассов 2014',{edition_id:1,url:'https://5e14.dnd.su/spells/'});
  const subclassMap=new Map(fullSpellData.subclasses.map(c=>{
   const classId=byName('classes',c.className);if(!classId)throw new Error(`Unknown subclass class: ${c.className}`);
   return[c.id,db.prepare('SELECT id,name_ru FROM subclasses WHERE class_id=?').all(classId).find(s=>fold(s.name_ru)===fold(c.name))?.id??named('subclasses',`dndsu_subclass:${c.id}`,c.name,{class_id:classId})];
  }));
  for(const{spell,material:recipe,rules}of payload){
   if(!spell.sourceIds.length||spell.sourceIds.some(id=>!sourceMap.has(id))||!spell.description||!/^https:\/\/5e14\.dnd\.su\/spells\//.test(spell.url))throw new Error(`Unverified spell source: ${spell.siteId}`);
   const existing=db.prepare('SELECT id FROM spells WHERE site_id=? OR canonical_id=?').get(String(spell.siteId),`dndsu:5e2014:spell:${spell.siteId}`);
   const id=existing?.id??1000000+spell.siteId;
   if(!existing){
    insert('spells',{id,canonical_id:`dndsu:5e2014:spell:${spell.siteId}`,name_ru:spell.name,name_original:spell.originalName,level:spell.level,school_id:byName('magic_schools',spell.school),edition_id:1,is_ritual:Number(spell.ritual),requires_concentration:Number(spell.concentration),...range(spell.range),...duration(spell.duration),description:spell.description,higher_levels_text:spell.higherLevels||null,source_url:spell.url,site_id:String(spell.siteId),review_status:'требует проверки'});
    casting(id,spell.casting);area(spell,id);
    for(const code of spell.componentCodes)insert('spell_components',{spell_id:id,component_type_id:get('component_types',code)});
    for(const sourceId of spell.sourceIds)insert('spell_sources',{spell_id:id,source_id:sourceMap.get(sourceId),url:spell.url});
    for(const classId of spell.classIds)insert('spell_classes',{spell_id:id,class_id:classMap.get(classId),rule_source_id:sourceMap.get(spell.sourceIds[0])});
    for(const classId of spell.optionalClassIds)if(!spell.classIds.includes(classId))insert('spell_classes',{spell_id:id,class_id:classMap.get(classId),rule_source_id:sourceMap.get(117),access_rule:'Дополнительный список заклинаний класса из Tasha’s Cauldron of Everything; по решению мастера.'});
    for(const subclassId of spell.subclassIds)insert('spell_subclasses',{spell_id:id,subclass_id:subclassMap.get(subclassId),rule_source_id:subclassSource,access_rule:'Доступ через особенность подкласса; действуют её условия и требования уровня.'});
    material(id,recipe);effects(spell,id,rules);
    const target=reviewedTargetCounts[spellKey(spell)];
    if(target)insert('spell_numeric_rules',{spell_id:id,maximum_targets:target,additional_targets_per_slot:targetPerSlot.has(spellKey(spell))?1:0,base_slot_level:spell.level,target_kind:'creature'});
    if(spell.royaltyCp)insert('spell_costs',{spell_id:id,kind:'royalty',amount_cp:spell.royaltyCp,base_slot_level:spell.level,per_additional_slot_cp:100});
    if(spellKey(spell)==="hunter's mark")for(const[level,value]of[[3,8],[5,24]])insert('spell_duration_scaling',{spell_id:id,slot_level:level,duration_value:value,unit_id:get('time_units','hour')});
   }else{
    // The original four reviewed records, IDs and user edits are retained intact.
    for(const mention of rules.mentions)insert('spell_roll_mentions',{spell_id:id,formula_id:roll(mention.roll),paragraph_index:mention.paragraph,offset_in_paragraph:mention.offset,context_text:mention.context});
    for(const save of rules.saves)insert('spell_save_mentions',{spell_id:id,ability_id:get('abilities',save.ability),fixed_dc:save.dc,paragraph_index:save.paragraph,context_text:save.context});
   }
   insert('spell_catalog_entries',{spell_id:id,site_id:spell.siteId,source_hash:spell.sourceHash,checked_on:spell.checkedOn,metadata_status:'checked',mechanics_status:existing||rules.reviewed?'reviewed_core':'partial',duration_up_to:Number(/вплоть|, до/i.test(spell.duration))});
   db.prepare('UPDATE rule_spell_references SET spell_id=? WHERE site_id=? AND spell_id IS NULL').run(id,spell.siteId);
  }
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Full spell catalog has broken foreign keys');
  insert('catalog_modules',{code:'full_spells_2014',version:1,data_hash:hash});
  db.exec('COMMIT');return true;
 }catch(error){db.exec('ROLLBACK');throw error;}
}
