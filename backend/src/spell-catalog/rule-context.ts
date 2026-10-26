import type { DatabaseSync } from 'node:sqlite';
import { readRoll } from './roll.js';

export interface RuleContext {
  activation:string;range:number|null;longRange:number|null;radius:number|null;durationValue:number|null;durationUnit:string|null;
  maximumPerTurn:number|null;uses:number|null;recharge:string|null;selfOnly:boolean;concentration:boolean|null;componentsRequired:boolean|null;
  copyStat:string|null;fact:string|null;divisor:number|null;rounding:string|null;maximum:number|null;attackBonus:number|null;
  attackAbility:string|null;alternateAbility:string|null;persistentCurse:boolean;sharedUseCode:string|null;condition:string|null;
  endEvent:string|null;
  conditions:{fact:string;valueType:string;comparison:string;value:number|string}[];
  save:{ability:string;dc:number|null;formula:string|null;success:string|null;failure:string|null;successImmunityHours:number|null}|null;
  cost:{quantity:number;hpAlternative:number|null}|null;spell:{name:string;url:string;spellId:number|null}|null;
  conditionChoices:string[];outcomes:{outcome:string;name:string;stat:string|null;operator:string|null;value:number|null;roll:string|null;context:RuleContext|null}[];
}
const num=(value:unknown)=>value==null?null:Number(value);
const txt=(value:unknown)=>value==null?null:String(value);
const outcomeNames:Record<string,string>={half:'Половина урона',possessed:'Одержимость доспехом',end_possession:'Одержимость прекращается',end_restrained:'Опутанность прекращается',banish:'Изгнание на родной план',soul_trapped:'Душа оказывается в ловушке'};

export function hasAudit(db:DatabaseSync){return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name='effect_context'").get());}

export function readRuleContext(db:DatabaseSync,effectId:number,depth=0):RuleContext|null{
  if(!hasAudit(db))return null;
  const row=db.prepare(`SELECT x.*,e.name_ru AS event_name,r.name_ru AS recharge_name,u.name_ru AS unit_name,s.name_ru AS copy_name,f.name_ru AS fact_name,
    a.name_ru AS attack_name,b.name_ru AS alternate_name,c.name_ru AS condition_name,ee.name_ru AS end_event_name FROM effect_context x JOIN rule_events e ON e.id=x.event_id
    LEFT JOIN rule_events r ON r.id=x.recharge_event_id LEFT JOIN time_units u ON u.id=x.duration_unit_id LEFT JOIN rule_stats s ON s.id=x.copy_stat_id
    LEFT JOIN rule_facts f ON f.id=x.fact_id LEFT JOIN abilities a ON a.id=x.attack_ability_id LEFT JOIN abilities b ON b.id=x.alternate_ability_id
    JOIN effects ef ON ef.id=x.effect_id LEFT JOIN conditions c ON c.id=ef.condition_id LEFT JOIN rule_events ee ON ee.id=x.end_event_id WHERE x.effect_id=?`).get(effectId);if(!row)return null;
  const save=db.prepare('SELECT x.*,a.name_ru AS ability FROM effect_save_rules x JOIN abilities a ON a.id=x.ability_id WHERE x.effect_id=?').get(effectId);
  const cost=db.prepare('SELECT * FROM effect_resource_costs WHERE effect_id=?').get(effectId);
  const spell=db.prepare('SELECT r.* FROM effect_spell_links l JOIN rule_spell_references r ON r.id=l.reference_id WHERE l.effect_id=?').get(effectId);
  const outcomes=depth>=8?[]:db.prepare(`SELECT x.outcome,e.id,e.name_ru,e.roll_formula_id,s.name_ru AS stat,o.name_ru AS operator,t.constant_value
    FROM effect_outcome_links x JOIN effects e ON e.id=x.effect_id LEFT JOIN effect_mechanics m ON m.effect_id=e.id LEFT JOIN rule_stats s ON s.id=m.stat_id
    LEFT JOIN rule_operators o ON o.id=m.operator_id LEFT JOIN mechanic_terms t ON t.effect_id=e.id AND t.ordinal=1 WHERE x.parent_effect_id=? ORDER BY e.id`).all(effectId).map(child=>({outcome:String(child.outcome),name:String(child.name_ru),stat:txt(child.stat),operator:txt(child.operator),value:num(child.constant_value),roll:readRoll(db,child.roll_formula_id),context:readRuleContext(db,Number(child.id),depth+1)}));
  const conditions=row.condition_group_id==null?[]:db.prepare('SELECT t.*,f.name_ru,f.value_type FROM rule_condition_tests t JOIN rule_facts f ON f.id=t.fact_id WHERE group_id=? ORDER BY t.id').all(Number(row.condition_group_id)).map(t=>({fact:String(t.name_ru),valueType:String(t.value_type),comparison:String(t.comparison),value:t.number_value==null?String(t.code_value):Number(t.number_value)}));
  return{activation:String(row.event_name),range:num(row.range_ft),longRange:num(row.long_range_ft),radius:num(row.radius_ft),durationValue:num(row.duration_value),durationUnit:txt(row.unit_name),maximumPerTurn:num(row.maximum_per_turn),uses:num(row.uses),recharge:txt(row.recharge_name),selfOnly:Boolean(row.self_only),concentration:row.requires_concentration==null?null:Boolean(row.requires_concentration),componentsRequired:row.components_required==null?null:Boolean(row.components_required),copyStat:txt(row.copy_name),fact:txt(row.fact_name),divisor:num(row.divisor),rounding:txt(row.rounding),maximum:num(row.maximum),attackBonus:num(row.attack_bonus),attackAbility:txt(row.attack_name),alternateAbility:txt(row.alternate_name),persistentCurse:Boolean(row.persistent_curse),sharedUseCode:txt(row.shared_use_code),condition:txt(row.condition_name),endEvent:txt(row.end_event_name),conditions,save:save?{ability:String(save.ability),dc:num(save.dc),formula:readRoll(db,save.dc_formula_id),success:save.success_code==null?null:outcomeNames[String(save.success_code)]??String(save.success_code),failure:save.failure_code==null?null:outcomeNames[String(save.failure_code)]??String(save.failure_code),successImmunityHours:num(save.success_immunity_hours)}:null,cost:cost?{quantity:Number(cost.quantity),hpAlternative:num(cost.hit_point_alternative)}:null,spell:spell?{name:String(spell.name_ru),url:String(spell.url),spellId:num(spell.spell_id)}:null,conditionChoices:db.prepare('SELECT c.name_ru FROM effect_condition_choices x JOIN conditions c ON c.id=x.condition_id WHERE x.effect_id=?').all(effectId).map(c=>String(c.name_ru)),outcomes};
}
