import { createHash } from 'node:crypto';
import { raceSampleData } from './race-samples-data.mjs';
export { raceSampleData };
export const raceSamplesDdl=`
CREATE TABLE creature_sizes(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL,carrying_multiplier REAL NOT NULL CHECK(carrying_multiplier>0)) STRICT;
CREATE TABLE creature_types(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL) STRICT;
CREATE TABLE race_source_checks(id INTEGER PRIMARY KEY,url TEXT NOT NULL UNIQUE,source_hash TEXT NOT NULL CHECK(length(source_hash)=64),checked_on TEXT NOT NULL) STRICT;
CREATE TABLE body_descriptions(
 id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,height_min_in REAL CHECK(height_min_in>0),height_max_in REAL CHECK(height_max_in>=height_min_in),
 weight_min_lb REAL CHECK(weight_min_lb>0),weight_max_lb REAL CHECK(weight_max_lb>=weight_min_lb),weight_average_lb REAL CHECK(weight_average_lb>0),
 adult_age_years REAL CHECK(adult_age_years>=0),adulthood_basis TEXT CHECK(adulthood_basis IN('approximate','social','biological')),
 lifespan_years REAL CHECK(lifespan_years>0),lifespan_qualifier TEXT CHECK(lifespan_qualifier IN('under','over','up_to','approximate')),notes TEXT) STRICT;
CREATE TABLE body_generators(
 id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,base_height_in REAL NOT NULL CHECK(base_height_in>0),height_roll_id INTEGER NOT NULL REFERENCES roll_formulas(id),
 base_weight_lb REAL NOT NULL CHECK(base_weight_lb>0),weight_roll_id INTEGER NOT NULL REFERENCES roll_formulas(id),
 weight_formula_code TEXT NOT NULL CHECK(weight_formula_code='base_plus_height_roll_times_weight_roll'),source_check_id INTEGER NOT NULL REFERENCES race_source_checks(id)) STRICT;
CREATE TABLE race_entries(
 id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL,name_original TEXT NOT NULL,parent_id INTEGER REFERENCES race_entries(id),
 edition_id INTEGER NOT NULL REFERENCES editions(id),source_id INTEGER NOT NULL REFERENCES sources(id),source_check_id INTEGER NOT NULL REFERENCES race_source_checks(id),
 source_anchor TEXT,description TEXT,requires_subrace INTEGER NOT NULL DEFAULT 0 CHECK(requires_subrace IN(0,1)),
 size_id INTEGER REFERENCES creature_sizes(id),creature_type_id INTEGER REFERENCES creature_types(id),body_description_id INTEGER REFERENCES body_descriptions(id),body_generator_id INTEGER REFERENCES body_generators(id),icon_url TEXT,
 CHECK(parent_id IS NULL OR (parent_id<>id AND requires_subrace=0)),CHECK(parent_id IS NOT NULL OR (size_id IS NOT NULL AND creature_type_id IS NOT NULL))) STRICT;
CREATE TRIGGER race_parent_is_root BEFORE INSERT ON race_entries WHEN NEW.parent_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM race_entries p WHERE p.id=NEW.parent_id AND p.parent_id IS NULL AND p.edition_id=NEW.edition_id) THEN RAISE(ABORT,'Race parent must be a root of the same edition') END;
END;
CREATE TRIGGER race_parent_update_is_root BEFORE UPDATE OF parent_id,edition_id ON race_entries BEGIN
 SELECT CASE WHEN NEW.parent_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM race_entries p WHERE p.id=NEW.parent_id AND p.parent_id IS NULL AND p.edition_id=NEW.edition_id) OR EXISTS(SELECT 1 FROM race_entries c WHERE c.parent_id=NEW.id)) THEN RAISE(ABORT,'Race parent must remain a root of the same edition') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM race_entries c WHERE c.parent_id=NEW.id AND c.edition_id<>NEW.edition_id) THEN RAISE(ABORT,'Subraces must use the same edition') END;
END;
CREATE TABLE movement_modes(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL) STRICT;
CREATE TABLE race_speeds(race_id INTEGER NOT NULL REFERENCES race_entries(id),movement_mode_id INTEGER NOT NULL REFERENCES movement_modes(id),speed_ft REAL NOT NULL CHECK(speed_ft>=0),PRIMARY KEY(race_id,movement_mode_id)) STRICT;
CREATE TABLE race_ability_bonuses(race_id INTEGER NOT NULL REFERENCES race_entries(id),ability_id INTEGER NOT NULL REFERENCES abilities(id),bonus INTEGER NOT NULL CHECK(bonus<>0),PRIMARY KEY(race_id,ability_id)) STRICT;
CREATE TABLE languages(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL,exotic INTEGER NOT NULL DEFAULT 0 CHECK(exotic IN(0,1))) STRICT;
CREATE TABLE race_languages(race_id INTEGER NOT NULL REFERENCES race_entries(id),language_id INTEGER NOT NULL REFERENCES languages(id),PRIMARY KEY(race_id,language_id)) STRICT;
CREATE TABLE proficiencies(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT,kind TEXT NOT NULL CHECK(kind IN('skill','tool','weapon','armor')),
 ability_id INTEGER REFERENCES abilities(id),gear_item_id INTEGER REFERENCES gear_entries(item_id),gear_category_id INTEGER REFERENCES gear_categories(id),
 CHECK((kind='weapon' AND gear_item_id IS NOT NULL AND gear_category_id IS NULL) OR (kind='armor' AND gear_category_id IS NOT NULL AND gear_item_id IS NULL) OR (kind IN('skill','tool') AND gear_item_id IS NULL AND gear_category_id IS NULL AND name_ru IS NOT NULL))) STRICT;
CREATE TABLE race_proficiencies(race_id INTEGER NOT NULL REFERENCES race_entries(id),proficiency_id INTEGER NOT NULL REFERENCES proficiencies(id),PRIMARY KEY(race_id,proficiency_id)) STRICT;
CREATE TABLE race_traits(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL,description TEXT NOT NULL) STRICT;
CREATE TABLE race_trait_links(race_id INTEGER NOT NULL REFERENCES race_entries(id),trait_id INTEGER NOT NULL REFERENCES race_traits(id),PRIMARY KEY(race_id,trait_id)) STRICT;
CREATE TABLE race_trait_effects(id INTEGER PRIMARY KEY,trait_id INTEGER NOT NULL REFERENCES race_traits(id),effect_id INTEGER NOT NULL REFERENCES effects(id),
 condition_group_id INTEGER REFERENCES rule_condition_groups(id),value_basis TEXT NOT NULL CHECK(value_basis IN('fixed','character_level')),UNIQUE(trait_id,effect_id)) STRICT;
CREATE TABLE race_choices(id INTEGER PRIMARY KEY,race_id INTEGER NOT NULL REFERENCES race_entries(id),code TEXT NOT NULL,name_ru TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN('language','proficiency','spell')),choose_count INTEGER NOT NULL CHECK(choose_count>0),
 casting_ability_id INTEGER REFERENCES abilities(id),filter_class_id INTEGER REFERENCES classes(id),filter_spell_level INTEGER CHECK(filter_spell_level BETWEEN 0 AND 9),UNIQUE(race_id,code)) STRICT;
CREATE TABLE race_choice_options(id INTEGER PRIMARY KEY,choice_id INTEGER NOT NULL REFERENCES race_choices(id),language_id INTEGER REFERENCES languages(id),proficiency_id INTEGER REFERENCES proficiencies(id),spell_id INTEGER REFERENCES spells(id),
 CHECK((language_id IS NOT NULL)+(proficiency_id IS NOT NULL)+(spell_id IS NOT NULL)=1),UNIQUE(choice_id,language_id),UNIQUE(choice_id,proficiency_id),UNIQUE(choice_id,spell_id)) STRICT;
CREATE TABLE carrying_rules(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,edition_id INTEGER NOT NULL REFERENCES editions(id),ability_id INTEGER NOT NULL REFERENCES abilities(id),
 carry_lb_per_point REAL NOT NULL CHECK(carry_lb_per_point>0),push_drag_lift_lb_per_point REAL NOT NULL CHECK(push_drag_lift_lb_per_point>=carry_lb_per_point),
 overloaded_drag_speed_ft REAL NOT NULL CHECK(overloaded_drag_speed_ft>=0),source_check_id INTEGER NOT NULL REFERENCES race_source_checks(id)) STRICT;
CREATE INDEX ix_race_parent ON race_entries(parent_id);
CREATE INDEX ix_race_trait_effects ON race_trait_effects(trait_id);
CREATE INDEX ix_race_choice_options ON race_choice_options(choice_id);
`;

export function applyRaceSamples(db,data=raceSampleData){
 if(data.edition!=='5e_2014'||data.entries.length!==7||data.sources.some(s=>!/^(https:\/\/5e14\.dnd\.su\/race\/|https:\/\/www\.dndbeyond\.com\/sources\/dnd\/basic-rules-2014\/)/.test(s.url)))throw new Error('Only the reviewed 2014 race sample is supported.');
 const hash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
 const installed=db.prepare("SELECT * FROM catalog_modules WHERE code='race_samples_2014'").get();
 if(installed){if(installed.data_hash!==hash)throw new Error('Race samples changed; use a new additive migration.');return false;}
 if(!db.prepare("SELECT 1 FROM catalog_modules WHERE code='full_spells_2014'").get())throw new Error('The full spell catalog is required for linked cantrip choices.');
 const insert=(table,row)=>{const columns=Object.keys(row).filter(k=>row[k]!==undefined);return Number(db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...columns.map(k=>row[k])).lastInsertRowid);};
 const id=(table,code)=>{const row=db.prepare(`SELECT id FROM ${table} WHERE code=?`).get(code);if(!row)throw new Error(`Unknown ${table}: ${code}`);return Number(row.id);};
 const named=(table,code,name,extra={})=>db.prepare(`SELECT id FROM ${table} WHERE code=?`).get(code)?.id??insert(table,{code,name_ru:name,...extra});
 const diceRoll=([count,sides])=>{
  const die=db.prepare('SELECT id FROM dice WHERE sides=?').get(sides);if(!die)throw new Error('Unknown die');
  const row=db.prepare(`SELECT t.formula_id FROM roll_terms t WHERE t.kind='кубики' AND t.die_id=? AND t.dice_count=? AND t.coefficient=1 AND (SELECT count(*) FROM roll_terms x WHERE x.formula_id=t.formula_id)=1 ORDER BY t.formula_id LIMIT 1`).get(die.id,count);if(row)return row.formula_id;
  const expression=`${count}к${sides}`,formula=insert('roll_formulas',{code:`shared_dice:${count}d${sides}`,name_ru:expression,source_expression:expression});insert('roll_terms',{formula_id:formula,ordinal:1,kind:'кубики',die_id:die.id,dice_count:count});return formula;
 };
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(raceSamplesDdl);
  for(const[code,name,multiplier]of data.sizes)named('creature_sizes',code,name,{carrying_multiplier:multiplier});
  named('creature_types','humanoid','Гуманоид');named('movement_modes','walk','Ходьба');
  const sourceChecks=new Map(data.sources.map(s=>[s.code,insert('race_source_checks',{url:s.url,source_hash:s.sha256,checked_on:s.checkedOn})]));
  const sourceId=db.prepare("SELECT id FROM sources WHERE code='PHB2014' OR name_original IN ('Player''s Handbook','Player''s Handbook (2014)') ORDER BY id LIMIT 1").get()?.id??1;
  for(const[code,body]of Object.entries(data.bodyDescriptions))insert('body_descriptions',{code:`phb2014:${code}`,...body});
  for(const[code,g]of Object.entries(data.generators))insert('body_generators',{code:`phb2014:${code}`,base_height_in:g.baseHeightIn,height_roll_id:diceRoll(g.heightDice),base_weight_lb:g.baseWeightLb,weight_roll_id:diceRoll(g.weightDice),weight_formula_code:'base_plus_height_roll_times_weight_roll',source_check_id:sourceChecks.get('body_table')});
  for(const[code,name,exotic]of data.languages)named('languages',code,name,{exotic:Number(Boolean(exotic))});
  for(const p of data.proficiencies){const gear=p.gearCode?db.prepare('SELECT i.id FROM items i JOIN gear_entries g ON g.item_id=i.id WHERE i.code=?').get(p.gearCode):null;insert('proficiencies',{code:p.code,name_ru:['weapon','armor'].includes(p.kind)?null:p.name,kind:p.kind,ability_id:p.ability?id('abilities',p.ability):null,gear_item_id:gear?.id,gear_category_id:p.category?id('gear_categories',p.category):null});}
  for(const trait of data.traits){
   const traitId=insert('race_traits',{code:trait.code,name_ru:trait.name,description:trait.description});
   for(const rule of trait.rules??[]){
    const stat=named('rule_stats',rule.stat,rule.statName??rule.stat),operator=id('rule_operators',rule.op);
    const intrinsic={stat,operator,value:rule.value??null,damage:rule.damage??null,stacking:rule.stacking??(['add'].includes(rule.op)?'add':'override')};
    const code='shared:race_effect:'+createHash('sha256').update(JSON.stringify(intrinsic)).digest('hex').slice(0,24);
    let effect=db.prepare('SELECT id FROM effects WHERE code=?').get(code)?.id;
    if(!effect){effect=insert('effects',{code,name_ru:trait.name,effect_type_id:id('effect_types','modifier'),damage_type_id:rule.damage?id('damage_types',rule.damage):null,automation:'справочно'});insert('effect_mechanics',{effect_id:effect,stat_id:stat,operator_id:operator,stacking_group:`racial:${rule.stat}`,stacking_mode:intrinsic.stacking});if(rule.value!==undefined)insert('mechanic_terms',{effect_id:effect,ordinal:1,kind:'constant',constant_value:rule.value});}
    let group=null;
    if(rule.fact){const fact=named('rule_facts',rule.fact,rule.factName,{value_type:'boolean'}),code=`race_condition:${rule.fact}`;group=db.prepare('SELECT id FROM rule_condition_groups WHERE code=?').get(code)?.id;if(!group){group=insert('rule_condition_groups',{code,match_mode:'all'});insert('rule_condition_tests',{group_id:group,fact_id:fact,comparison:'eq',number_value:1});}}
    insert('race_trait_effects',{trait_id:traitId,effect_id:effect,condition_group_id:group,value_basis:rule.basis??'fixed'});
   }
  }
  for(const r of data.entries){
   insert('race_entries',{id:r.id,code:r.code,name_ru:r.name,name_original:r.original,parent_id:r.parent?id('race_entries',r.parent):null,edition_id:id('editions','5e_2014'),source_id:sourceId,source_check_id:sourceChecks.get(r.source),source_anchor:r.anchor,description:r.description,requires_subrace:Number(Boolean(r.requiresSubrace)),size_id:r.parent?null:id('creature_sizes','medium'),creature_type_id:r.parent?null:id('creature_types','humanoid'),body_description_id:r.body?id('body_descriptions',`phb2014:${r.body}`):null,body_generator_id:r.generator?id('body_generators',`phb2014:${r.generator}`):null});
   if(r.speed!==undefined)insert('race_speeds',{race_id:r.id,movement_mode_id:id('movement_modes','walk'),speed_ft:r.speed});
   for(const[ability,bonus]of Object.entries(r.bonuses??{}))insert('race_ability_bonuses',{race_id:r.id,ability_id:id('abilities',ability),bonus});
   for(const code of r.languages??[])insert('race_languages',{race_id:r.id,language_id:id('languages',code)});
   for(const code of r.proficiencies??[])insert('race_proficiencies',{race_id:r.id,proficiency_id:id('proficiencies',code)});
   for(const code of r.traits??[])insert('race_trait_links',{race_id:r.id,trait_id:id('race_traits',code)});
   for(const c of r.choices??[]){
    const choice=insert('race_choices',{race_id:r.id,code:c.code,name_ru:c.name,kind:c.kind,choose_count:c.count,casting_ability_id:c.castingAbility?id('abilities',c.castingAbility):null,filter_class_id:c.class?id('classes',c.class):null,filter_spell_level:c.level});
    const options=c.kind==='language'?db.prepare('SELECT id FROM languages WHERE id NOT IN (SELECT language_id FROM race_languages WHERE race_id IN (?,?))').all(r.id,r.parent?id('race_entries',r.parent):r.id):c.kind==='proficiency'?c.options.map(code=>({id:id('proficiencies',code)})):db.prepare('SELECT DISTINCT s.id FROM spells s JOIN spell_classes c ON c.spell_id=s.id WHERE c.class_id=? AND s.level=? AND s.edition_id=?').all(id('classes',c.class),c.level,id('editions','5e_2014'));
    if(options.length<c.count)throw new Error(`Not enough options for ${r.name}: ${c.code}`);
    for(const o of options)insert('race_choice_options',{choice_id:choice,[c.kind==='language'?'language_id':c.kind==='spell'?'spell_id':'proficiency_id']:o.id});
   }
  }
  insert('carrying_rules',{code:'standard_2014',edition_id:id('editions','5e_2014'),ability_id:id('abilities','strength'),carry_lb_per_point:15,push_drag_lift_lb_per_point:30,overloaded_drag_speed_ft:5,source_check_id:sourceChecks.get('carrying')});
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Race catalog foreign key check failed');
  insert('catalog_modules',{code:'race_samples_2014',version:data.version,data_hash:hash});db.exec('COMMIT');return true;
 }catch(error){db.exec('ROLLBACK');throw error;}
}
