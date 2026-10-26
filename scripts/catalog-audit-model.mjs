import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { armorReviewedRules, armorResources } from './armor-reviewed-rules.mjs';
import { equipmentPayload } from './equipment-model.mjs';

export const auditSnapshot=()=>JSON.parse(readFileSync(new URL('../database/equipment/source-audit.json',import.meta.url),'utf8'));
export const auditDdl=`
CREATE TABLE rule_events(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name_ru TEXT NOT NULL) STRICT;
CREATE TABLE catalog_source_audits(url TEXT PRIMARY KEY,checked_on TEXT NOT NULL,sha256 TEXT NOT NULL,description TEXT NOT NULL) STRICT;
CREATE TABLE effect_context(effect_id INTEGER PRIMARY KEY REFERENCES effects(id),event_id INTEGER NOT NULL REFERENCES rule_events(id),range_ft REAL CHECK(range_ft>=0),long_range_ft REAL CHECK(long_range_ft>=range_ft),radius_ft REAL CHECK(radius_ft>=0),duration_value REAL CHECK(duration_value>0),duration_unit_id INTEGER REFERENCES time_units(id),maximum_per_turn INTEGER CHECK(maximum_per_turn>0),uses INTEGER CHECK(uses>0),recharge_event_id INTEGER REFERENCES rule_events(id),self_only INTEGER CHECK(self_only IN(0,1)),requires_concentration INTEGER CHECK(requires_concentration IN(0,1)),components_required INTEGER CHECK(components_required IN(0,1)),copy_stat_id INTEGER REFERENCES rule_stats(id),fact_id INTEGER REFERENCES rule_facts(id),divisor REAL CHECK(divisor>0),rounding TEXT CHECK(rounding IN('floor','ceil')),maximum REAL,attack_bonus REAL,attack_ability_id INTEGER REFERENCES abilities(id),alternate_ability_id INTEGER REFERENCES abilities(id),persistent_curse INTEGER NOT NULL DEFAULT 0 CHECK(persistent_curse IN(0,1)),shared_use_code TEXT) STRICT;
CREATE TABLE effect_save_rules(effect_id INTEGER PRIMARY KEY REFERENCES effects(id),ability_id INTEGER NOT NULL REFERENCES abilities(id),dc INTEGER CHECK(dc>0),dc_formula_id INTEGER REFERENCES roll_formulas(id),success_code TEXT, failure_code TEXT,CHECK((dc IS NULL)<>(dc_formula_id IS NULL))) STRICT;
CREATE TABLE effect_outcome_links(parent_effect_id INTEGER NOT NULL REFERENCES effects(id),outcome TEXT NOT NULL CHECK(outcome IN('failure','success')),effect_id INTEGER NOT NULL REFERENCES effects(id),PRIMARY KEY(parent_effect_id,outcome,effect_id),CHECK(parent_effect_id<>effect_id)) STRICT;
CREATE TABLE gear_resources(id INTEGER PRIMARY KEY,item_id INTEGER NOT NULL UNIQUE REFERENCES gear_entries(item_id),capacity INTEGER CHECK(capacity>0),initial_formula_id INTEGER REFERENCES roll_formulas(id),recovery_formula_id INTEGER REFERENCES roll_formulas(id),recharge_event_id INTEGER NOT NULL REFERENCES rule_events(id)) STRICT;
CREATE TABLE effect_resource_costs(effect_id INTEGER PRIMARY KEY REFERENCES effects(id),resource_id INTEGER NOT NULL REFERENCES gear_resources(id),quantity INTEGER NOT NULL CHECK(quantity>0),hit_point_alternative INTEGER CHECK(hit_point_alternative>0)) STRICT;
CREATE TABLE rule_spell_references(id INTEGER PRIMARY KEY,site_id INTEGER NOT NULL UNIQUE,name_ru TEXT NOT NULL,name_original TEXT NOT NULL,url TEXT NOT NULL,spell_id INTEGER REFERENCES spells(id)) STRICT;
CREATE TABLE effect_spell_links(effect_id INTEGER PRIMARY KEY REFERENCES effects(id),reference_id INTEGER NOT NULL REFERENCES rule_spell_references(id)) STRICT;
CREATE TABLE effect_condition_choices(effect_id INTEGER NOT NULL REFERENCES effects(id),condition_id INTEGER NOT NULL REFERENCES conditions(id),PRIMARY KEY(effect_id,condition_id)) STRICT;
CREATE TABLE spell_numeric_rules(spell_id INTEGER PRIMARY KEY REFERENCES spells(id),maximum_targets INTEGER CHECK(maximum_targets>0),additional_targets_per_slot INTEGER NOT NULL DEFAULT 0 CHECK(additional_targets_per_slot>=0),base_slot_level INTEGER CHECK(base_slot_level BETWEEN 0 AND 9),condition_group_id INTEGER REFERENCES rule_condition_groups(id),requires_continuous_touch INTEGER NOT NULL DEFAULT 0 CHECK(requires_continuous_touch IN(0,1))) STRICT;
CREATE TABLE spell_effect_rule_links(spell_effect_id INTEGER NOT NULL REFERENCES spell_effects(id),stat_id INTEGER REFERENCES rule_stats(id),operator_id INTEGER NOT NULL REFERENCES rule_operators(id),success_numerator INTEGER,success_denominator INTEGER CHECK(success_denominator>0),condition_group_id INTEGER REFERENCES rule_condition_groups(id),PRIMARY KEY(spell_effect_id,operator_id,stat_id)) STRICT;
CREATE TABLE gear_rule_reviews(item_id INTEGER PRIMARY KEY REFERENCES gear_entries(item_id),checked_on TEXT NOT NULL,numeric_reviewed INTEGER NOT NULL CHECK(numeric_reviewed IN(0,1))) STRICT;
`;

const statNames={incoming_attack:'Атаки по владельцу',strength_score:'Значение Силы',carrying_capacity:'Грузоподъёмность',fly_speed:'Скорость полёта (футы)',swim_speed:'Скорость плавания (футы)',temporary_hp:'Временные хиты',ability_checks:'Проверки характеристик',berserk_roll:'Результат броска берсерка',persuasion:'Убеждение: Сл проверки',draw_weapons:'Одновременно извлекаемых оружий',pockets:'Количество карманов',pocket_capacity:'Вместимость кармана (фунты)',pocket_volume:'Объём кармана (куб. футы)',teleport_radius:'Радиус астрального разрыва (футы)',death_saves:'Спасброски от смерти',translated_words:'Переводимых слов',underwater_breathing:'Дыхание под водой',darkvision:'Тёмное зрение (футы)',forced_movement:'Перемещение (футы)',redirect_attack:'Перенаправление атаки',redirect_damage:'Перенаправление урона',initiative:'Инициатива',exhaustion:'Степени истощения',condition:'Состояние',intelligence_saves:'Спасброски Интеллекта',wisdom_saves:'Спасброски Мудрости',charisma_saves:'Спасброски Харизмы',perception:'Восприятие',armor_proficiency:'Владение этим доспехом',detect_aberration:'Обнаружение аберраций',detect_dragon:'Обнаружение дракона',vertical_movement:'Подъём (футы)',doff_armor:'Снятие доспеха',change_expression:'Изменение выражения щита',shield_hands:'Рук для удержания щита',maximum_hp:'Максимум хитов',shield_activation:'Активация щита',remove_condition:'Прекращение состояния',concentration_saves:'Спасброски концентрации',acrobatics:'Акробатика',natural_d20:'Результат к20',initiative_d20:'Результат к20 инициативы',cancel_advantage_disadvantage:'Отмена преимущества и помехи',summon_knight:'Призыв духа рыцаря',summon_projection:'Проекция'};
const eventNames={while_equipped:'Пока предмет используется',action:'Действие',bonus_action:'Бонусное действие',reaction:'Реакция',attack:'Атака',replace_attack:'Вместо одной атаки',on_hit:'При попадании',after_lightning_damage:'После урона электричеством',after_fire_damage:'После урона огнём',after_critical_hit:'После критического попадания по владельцу',on_don:'При надевании',dawn:'На рассвете',battery:'Замена батареи',after_long_rest:'После продолжительного отдыха',short_or_long_rest:'Короткий или продолжительный отдых',after_shove:'После толчка',on_death:'При смерти владельца',on_destroyed:'При уничтожении щита',start_turn:'В начале своего хода',saving_throw_natural_one:'Натуральная 1 на спасброске',weapon_attack_natural_one:'Натуральная 1 на атаке этим оружием',psychic_reflection:'После психического отражения',on_d20_roll:'При броске к20',target_start_turn:'В начале следующего хода цели'};
const factNames={armor_active:'Силовой доспех активен',magical_effect:'Спасбросок от заклинания или магического эффекта',cursed:'Владелец проклят этим предметом',extradimensional_container:'Вложен в другой межпространственный контейнер',possessed:'Владелец одержим доспехом',incoming_ranged_attack:'Входящая дальнобойная атака',save_success:'Спасбросок успешен',save_half_damage:'Успех обычно уменьшает урон вдвое',save_strength_or_constitution:'Спасбросок Силы или Телосложения',nearby_allies:'Союзников в пределах 5 футов',incapacitated:'Владелец недееспособен',avoid_grapple:'Избежать или окончить захват',armor_fed:'Доспех получил требуемые кости хитов',shove_distance:'Дистанция исходного толчка (футы)',target_celestial_fey_fiend:'Цель — небожитель, фея или исчадие',target_on_home_plane:'Цель находится на родном плане',target_wounded:'Цель ранена',transformed:'Форма владельца заменяет игровые характеристики',melee_attack:'Рукопашная атака',same_plane_creator:'Щит и его создатель находятся на одном плане',spell_attack:'Входящая атака заклинанием',incoming_ranged_weapon_attack:'Входящая дальнобойная атака оружием',dragon_breath:'Дыхание дракона',damage_received:'Владелец получил урон',gauntlet_attack:'Атака рукавицами этого доспеха',target_demon:'Цель — демон',source_demon:'Источник эффекта — демон',dragon_frightful_or_breath:'Ужасающая внешность или дыхание дракона',selected_resistance:'Выбранный для предмета тип сопротивления',underwater:'Владелец под водой',current_hp:'Текущие хиты',incoming_magical_damage:'Входящий урон магический',ruidium_destroyed:'Руидий уничтожен после освобождения или гибели Апофеона',received_psychic_damage:'Владелец получил урон психической энергией',shield_active:'Щит активирован',stone_wall_from_armor:'Поддерживается Каменная стена этого доспеха',spell_effect:'Спасбросок от заклинания',avoid_charmed:'Избежать или окончить очарование',avoid_frightened:'Избежать или окончить испуг',character_level:'Уровень персонажа',target_creature_type:'Тип существа цели'};

export function applyCatalogAudit(db){
  const snapshot=auditSnapshot();
  const hash=createHash('sha256').update(JSON.stringify([snapshot,armorReviewedRules,armorResources])).digest('hex');
  const installed=db.prepare("SELECT * FROM catalog_modules WHERE code='rules_audit'").get();
  if(installed?.data_hash===hash)return{changed:false};
  if(installed)throw new Error('Rules audit already exists with different data; use a new migration.');
  const insert=(table,values)=>{const keys=Object.keys(values).filter(k=>values[k]!==undefined);return Number(db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?')})`).run(...keys.map(k=>typeof values[k]==='boolean'?Number(values[k]):values[k])).lastInsertRowid);};
  const id=(table,code)=>db.prepare(`SELECT id FROM ${table} WHERE code=?`).get(code)?.id;
  const named=(table,code,name,extra={})=>id(table,code)??insert(table,{code,name_ru:name,...extra});
  const stat=code=>named('rule_stats',code,statNames[code]??code);
  const operator=code=>named('rule_operators',code,({immunity:'Иммунитет',vulnerability:'Уязвимость',set:'Установить',multiply:'Умножить',subtract:'Уменьшить',copy:'Равно другому показателю',grant:'Предоставить',apply:'Наложить'})[code]??code);
  const event=code=>named('rule_events',code,eventNames[code]??code);
  const fact=(code,value)=>named('rule_facts',code,factNames[code]??code,{value_type:typeof value==='string'?'code':['nearby_allies','shove_distance','current_hp','character_level','strength_score'].includes(code)?'number':'boolean'});
  const group=(code,tests)=>{if(!tests.length)return null;const groupId=insert('rule_condition_groups',{code,match_mode:'all'});for(const[f,comparison,value]of tests)insert('rule_condition_tests',{group_id:groupId,fact_id:fact(f,value),comparison,number_value:typeof value==='number'?value:null,code_value:typeof value==='string'?value:null});return groupId;};
  const formula=expression=>{
    if(!expression)return null;const existing=db.prepare('SELECT id FROM roll_formulas WHERE source_expression=?').get(expression);if(existing)return existing.id;
    const formulaId=insert('roll_formulas',{code:'equipment:audit:roll:'+expression,name_ru:expression,source_expression:expression});
    for(const[ordinal,token]of expression.split('+').entries()){
      const dice=token.match(/^(\d+)к(\d+)$/);const ability=id('abilities',token);
      if(dice){const die=named('dice','d'+dice[2],'к'+dice[2],{sides:Number(dice[2])});insert('roll_terms',{formula_id:formulaId,ordinal:ordinal+1,kind:'кубики',die_id:die,dice_count:Number(dice[1]),coefficient:1,use_spellcasting_ability:0});}
      else if(ability)insert('roll_terms',{formula_id:formulaId,ordinal:ordinal+1,kind:'модификатор',ability_id:ability,use_spellcasting_ability:0,coefficient:1});
      else if(token==='proficiency')insert('roll_terms',{formula_id:formulaId,ordinal:ordinal+1,kind:'мастерство',use_spellcasting_ability:0,coefficient:1});
      else if(/^\d+$/.test(token))insert('roll_terms',{formula_id:formulaId,ordinal:ordinal+1,kind:'константа',constant_value:Number(token),use_spellcasting_ability:0,coefficient:1});
      else throw new Error('Unsupported audit roll '+expression);
    }return formulaId;
  };
  db.exec('BEGIN IMMEDIATE');
  try{
    db.exec(auditDdl);
    for(const row of snapshot.sources){insert('catalog_source_audits',{url:row.url,checked_on:row.checkedOn,sha256:row.sha256,description:row.description});if(row.key.startsWith('item-')){
      const itemId=200000+Number(row.key.slice(5));const current=db.prepare('SELECT description FROM gear_entries WHERE item_id=?').get(itemId);
      if(current&&current.description!==row.description){if(current.description!==row.previousDescription)throw new Error('Description has local changes: '+itemId);db.prepare('UPDATE gear_entries SET description=? WHERE item_id=?').run(row.description,itemId);}
    }}
    for(const code of ['ruidium_corruption','possessed','soul_trapped'])named('conditions',code,({ruidium_corruption:'Руидиевая порча',possessed:'Одержимость доспехом',soul_trapped:'Душа в ловушке'})[code]);
    const resources=new Map();
    for(const[siteId,r]of Object.entries(armorResources))resources.set(Number(siteId),insert('gear_resources',{item_id:200000+Number(siteId),capacity:r.capacity??null,initial_formula_id:formula(r.initialRoll),recovery_formula_id:formula(r.recovery),recharge_event_id:event(r.recharge??'dawn')}));
    const createRule=(siteId,r,path,root=true)=>{
      const entry=db.prepare('SELECT requires_attunement FROM gear_entries WHERE item_id=?').get(200000+siteId);
      const effectId=insert('effects',{code:`equipment:audit:${siteId}:${path}`,name_ru:r.name,effect_type_id:r.condition?4:r.damage&&r.roll?1:5,roll_formula_id:formula(r.roll),damage_type_id:r.damage?id('damage_types',r.damage):null,condition_id:r.condition?id('conditions',r.condition):null,choose_damage_type:0,automation:'справочно'});
      insert('effect_mechanics',{effect_id:effectId,stat_id:stat(r.stat),operator_id:operator(r.op),stacking_group:r.stacking??r.stat,stacking_mode:r.op==='base'?'choose_one':r.op==='ignore'?'override':'add'});
      const terms=[];if(r.value!=null)terms.push({kind:'constant',constant_value:r.value});if(r.variantValue)terms.push({kind:'variant'});if(r.ability)terms.push({kind:'ability',ability_id:id('abilities',r.ability)});
      terms.forEach((t,index)=>insert('mechanic_terms',{effect_id:effectId,ordinal:index+1,...t,coefficient:1}));
      const tests=r.persistentCurse?[...(r.conditions??[])]:[['equipped','eq',1],...(entry.requires_attunement&&r.requiresAttunement!==false?[['attuned','eq',1]]:[]),...(r.conditions??[])];
      const condition=group(`audit:${siteId}:${path}`,tests);
      if(root)insert('gear_effect_links',{item_id:200000+siteId,effect_id:effectId,condition_group_id:condition,activation:r.activation??'while_equipped',duration_code:r.duration??(r.durationValue?'timed':'while_equipped'),scope:r.scope??'wearer'});
      insert('effect_context',{effect_id:effectId,event_id:event(r.activation??'while_equipped'),range_ft:r.range,long_range_ft:r.longRange,radius_ft:r.radius,duration_value:r.durationValue,duration_unit_id:r.durationUnit?id('time_units',r.durationUnit):undefined,maximum_per_turn:r.maxPerTurn,uses:r.uses,recharge_event_id:r.recharge?event(r.recharge):undefined,self_only:r.selfOnly,requires_concentration:r.concentration,components_required:r.componentsRequired,copy_stat_id:r.copyStat?stat(r.copyStat):undefined,fact_id:r.fact?fact(r.fact,1):undefined,divisor:r.divisor,rounding:r.rounding,maximum:r.maximum,attack_bonus:r.attackBonus,attack_ability_id:r.attackAbility?id('abilities',r.attackAbility):undefined,alternate_ability_id:r.alternateAbility?id('abilities',r.alternateAbility):undefined,persistent_curse:Boolean(r.persistentCurse),shared_use_code:r.sharedUse});
      if(r.cost)insert('effect_resource_costs',{effect_id:effectId,resource_id:resources.get(siteId),quantity:r.cost,hit_point_alternative:r.hpAlternative});
      if(r.save)insert('effect_save_rules',{effect_id:effectId,ability_id:id('abilities',r.save.ability),dc:r.save.dc,dc_formula_id:r.save.dcFormula?formula(r.save.dcFormula):undefined,success_code:r.save.success??r.success,failure_code:r.failure});
      if(r.spell){const ref=snapshot.spellReferences.find(x=>x.originalName.toLowerCase()===r.spell.originalName.toLowerCase());if(!ref)throw new Error('Missing spell reference '+r.spell.originalName);let referenceId=db.prepare('SELECT id FROM rule_spell_references WHERE site_id=?').get(ref.siteId)?.id;if(!referenceId)referenceId=insert('rule_spell_references',{site_id:ref.siteId,name_ru:r.spell.name,name_original:r.spell.originalName,url:ref.url,spell_id:db.prepare('SELECT id FROM spells WHERE site_id=?').get(String(ref.siteId))?.id??null});insert('effect_spell_links',{effect_id:effectId,reference_id:referenceId});}
      for(const name of r.conditionChoices??[])insert('effect_condition_choices',{effect_id:effectId,condition_id:id('conditions',name)});
      for(const[index,child]of(r.failureRules??[]).entries())insert('effect_outcome_links',{parent_effect_id:effectId,outcome:'failure',effect_id:createRule(siteId,child,path+'.f'+index,false)});
      return effectId;
    };
    for(const item of armorReviewedRules){
      item.rules.forEach((r,index)=>createRule(item.siteId,r,String(index)));
      insert('gear_rule_reviews',{item_id:200000+item.siteId,checked_on:'2026-10-16',numeric_reviewed:1});
    }
    // Explicit overrides replace the inherited armour formula rather than adding a second base.
    db.prepare('UPDATE items SET weight_lb=10 WHERE id=210836').run();
    const snakeEffect=db.prepare("SELECT effect_id FROM gear_effect_links WHERE item_id=202119 AND effect_id IN(SELECT effect_id FROM effect_mechanics WHERE stacking_mode='choose_one')").get();
    if(snakeEffect)db.prepare("UPDATE effect_mechanics SET stacking_mode='override' WHERE effect_id=?").run(snakeEffect.effect_id);
    const wild=202316;db.prepare('DELETE FROM gear_variants WHERE item_id=?').run(wild);for(const[code,name,value]of[['dormant','Дремлющий',1],['awakened','Пробуждённый',2],['exalted','Возвышенный',3]])insert('gear_variants',{item_id:wild,code,name_ru:name,rarity_id:id('gear_rarities','legendary'),enhancement:value});
    for(const[siteId,types]of[[37,['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder']],[38,['bludgeoning','piercing','slashing']],[34,['acid','cold','fire','lightning','poison']]]){
      db.prepare('DELETE FROM gear_variants WHERE item_id=?').run(200000+siteId);
      for(const type of types){const d=db.prepare('SELECT name_ru FROM damage_types WHERE code=?').get(type);insert('gear_variants',{item_id:200000+siteId,code:'resistance:'+type,name_ru:'Сопротивление: '+d.name_ru,rarity_id:id('gear_rarities',siteId===34?'very_rare':'rare'),enhancement:null});}
    }
    // Being considered proficient is specific to this armour, not a global proficiency grant.
    db.prepare("DELETE FROM gear_effect_links WHERE item_id=200259 AND effect_id IN(SELECT effect_id FROM effect_mechanics WHERE stat_id IN(SELECT id FROM rule_stats WHERE code IN('attack_roll','strength_checks','dexterity_checks','strength_saves','dexterity_saves','spellcasting')))").run();
    const blocked=group('audit:cure:wounds',[['target_creature_type','ne','undead'],['target_creature_type','ne','construct']]);
    for(const[spellId,max,extra,base,touch]of[[10001,null,0,3,0],[10002,1,0,1,0],[10003,1,0,1,1],[10004,3,1,1,0]])insert('spell_numeric_rules',{spell_id:spellId,maximum_targets:max,additional_targets_per_slot:extra,base_slot_level:base,requires_continuous_touch:touch,condition_group_id:spellId===10002?blocked:null});
    for(const target of ['attack_roll','saving_throws'])insert('spell_effect_rule_links',{spell_effect_id:4004,stat_id:stat(target),operator_id:operator('add')});
    insert('spell_effect_rule_links',{spell_effect_id:4001,stat_id:stat('damage_taken'),operator_id:operator('multiply'),success_numerator:1,success_denominator:2});
    const payloadHash=createHash('sha256').update(JSON.stringify(equipmentPayload())).digest('hex');db.prepare("UPDATE catalog_modules SET data_hash=? WHERE code='equipment'").run(payloadHash);
    insert('catalog_modules',{code:'rules_audit',version:2,data_hash:hash});
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Audit FK check failed');
    db.exec('COMMIT');return{changed:true,reviewedItems:armorReviewedRules.length,effects:db.prepare("SELECT COUNT(*) n FROM effects WHERE code LIKE 'equipment:audit:%'").get().n};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
