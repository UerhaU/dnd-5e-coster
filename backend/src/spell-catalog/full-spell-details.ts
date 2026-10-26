import type { DatabaseSync } from 'node:sqlite';
import { readRoll } from './roll.js';
import { formatQuantity } from './format.js';

export interface MaterialNode {
 id:number;kind:'all'|'any'|'item'|'prerequisite';requirementId:number|null;
 prerequisite:string|null;minimumValueCp:number|null;children:MaterialNode[];
}
export interface CatalogRule {
 id:number;status:string;kind:string;roll:string|null;stat:string|null;operator:string|null;
 value:number|null;ability:string|null;spellcasting:boolean;damage:string|null;
 damageType:{id:number;name:string;iconUrl:string|null}|null;damageChoices:{id:number;name:string;iconUrl:string|null}[];
 condition:string|null;choice:string|null;scope:string|null;trigger:string|null;
 repeatCount:number|null;resolution:string;saveAbility:string|null;onSuccess:string|null;
 scaling:string[];
}
export interface FullSpellDetails {
 checkedOn:string;mechanicsStatus:string;durationUpTo:boolean;
 materialTree:MaterialNode|null;
 materialUsage:{requirementId:number;quantityBasis:string;priceBasis:string;selector:string|null}[];
 costs:{amountCp:number;perAdditionalSlotCp:number;baseSlotLevel:number}[];
 rules:CatalogRule[];durationScaling:{slotLevel:number;duration:string}[];
 rollMentions:number;saveMentions:number;
}
const text=(v:unknown)=>v==null?null:String(v);
const num=(v:unknown)=>v==null?null:Number(v);
const scopeNames:Record<string,string>={weapon:'Оружие'};
const triggerNames:Record<string,string>={reaction:'При реакции',on_hit:'При попадании',start_turn:'В начале хода',next_melee_hit:'Первое попадание в следующем ходу',hit_by_melee_attack:'При попадании рукопашной атакой по заклинателю',eat_berry:'При съедании ягоды'};

export function readFullSpellDetails(db:DatabaseSync,spellId:number):FullSpellDetails|null{
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='spell_catalog_entries'").get())return null;
 const entry=db.prepare('SELECT * FROM spell_catalog_entries WHERE spell_id=?').get(spellId);if(!entry)return null;
 const nodes=db.prepare(`SELECT n.*,p.name_ru AS prerequisite FROM spell_material_nodes n
  LEFT JOIN spell_material_prerequisites p ON p.id=n.prerequisite_id WHERE spell_id=? ORDER BY ordinal`).all(spellId);
 const node=(row:Record<string,unknown>):MaterialNode=>({id:Number(row.id),kind:String(row.kind) as MaterialNode['kind'],requirementId:num(row.requirement_id),prerequisite:text(row.prerequisite),minimumValueCp:num(row.minimum_value_cp),children:nodes.filter(n=>n.parent_id===row.id).map(node)});
 const root=nodes.find(n=>n.parent_id==null);
 const rules=db.prepare(`SELECT x.id,x.resolution_type,x.application_condition,x.on_success,a.name_ru AS save_ability,
  e.id AS effect_id,e.roll_formula_id,k.name_ru AS kind,d.name_ru AS damage,d.id AS damage_id,d.icon_url AS damage_icon,s.name_ru AS stat,o.name_ru AS operator,c.*
  FROM spell_effects x JOIN spell_rule_contexts c ON c.spell_effect_id=x.id JOIN effects e ON e.id=x.effect_id
  JOIN effect_types k ON k.id=e.effect_type_id LEFT JOIN damage_types d ON d.id=e.damage_type_id
  LEFT JOIN abilities a ON a.id=x.save_ability_id LEFT JOIN effect_mechanics m ON m.effect_id=e.id
  LEFT JOIN rule_stats s ON s.id=m.stat_id LEFT JOIN rule_operators o ON o.id=m.operator_id
  WHERE x.spell_id=? ORDER BY x.ordinal`).all(spellId).filter(r=>r.status!=='description').map((r):CatalogRule=>{
  const scaling=db.prepare('SELECT * FROM spell_scaling WHERE spell_effect_id=? ORDER BY ordinal').all(Number(r.spell_effect_id)).map(s=>`${s.basis}: ${s.operation==='добавить формулу'?'+':'замена на '}${readRoll(db,s.roll_formula_id)}, начиная с ${s.threshold}${s.step?`, каждые ${s.step} ур.`:''}.`);
  for(const s of db.prepare('SELECT * FROM spell_numeric_scaling WHERE spell_effect_id=? ORDER BY threshold').all(Number(r.spell_effect_id))){
   const what=s.operation==='set_count'?'Количество':s.operation==='add_count'?'Дополнительных попаданий/лучей':'Значение';
   scaling.push(`${s.basis==='slot'?'Ячейка':'Уровень персонажа'} ${s.threshold}+: ${what} ${String(s.operation).startsWith('add')?'+':''}${s.value}${s.step?` за каждые ${s.step} ур.`:''}.`);
  }
  const ability=db.prepare('SELECT a.name_ru FROM mechanic_terms t JOIN abilities a ON a.id=t.ability_id WHERE effect_id=? ORDER BY ordinal').get(Number(r.effect_id));
  return{id:Number(r.spell_effect_id),status:String(r.status),kind:String(r.kind),roll:readRoll(db,r.roll_formula_id),stat:text(r.stat),operator:text(r.operator),value:num(r.modifier_value),ability:text(ability?.name_ru),spellcasting:Boolean(r.uses_spellcasting_ability),damage:text(r.damage),damageType:r.damage_id==null?null:{id:Number(r.damage_id),name:String(r.damage),iconUrl:text(r.damage_icon)},damageChoices:db.prepare('SELECT d.id,d.name_ru AS name,d.icon_url AS iconUrl FROM effect_damage_choices c JOIN damage_types d ON d.id=c.damage_type_id WHERE c.effect_id=?').all(Number(r.effect_id)) as unknown as CatalogRule['damageChoices'],condition:text(r.application_condition),choice:text(r.choice_name),scope:scopeNames[String(r.scope)]??text(r.scope),trigger:triggerNames[String(r.trigger_code)]??text(r.trigger_code),repeatCount:num(r.repeat_count),resolution:String(r.resolution_type),saveAbility:text(r.save_ability),onSuccess:r.on_success_code==='half'?'Половина урона':r.on_success_code==='none'?'Без эффекта':text(r.on_success),scaling};
 });
 return{checkedOn:String(entry.checked_on),mechanicsStatus:String(entry.mechanics_status),durationUpTo:Boolean(entry.duration_up_to),materialTree:root?node(root):null,
  materialUsage:db.prepare(`SELECT u.* FROM spell_material_usage u JOIN spell_material_requirements r ON r.id=u.requirement_id JOIN spell_material_groups g ON g.id=r.group_id WHERE g.spell_id=?`).all(spellId).map(r=>({requirementId:Number(r.requirement_id),quantityBasis:String(r.quantity_basis),priceBasis:String(r.price_basis),selector:text(r.selector_code)})),
  costs:db.prepare('SELECT * FROM spell_costs WHERE spell_id=?').all(spellId).map(c=>({amountCp:Number(c.amount_cp),perAdditionalSlotCp:Number(c.per_additional_slot_cp),baseSlotLevel:Number(c.base_slot_level)})),rules,
  durationScaling:db.prepare('SELECT s.*,u.code,u.name_ru FROM spell_duration_scaling s JOIN time_units u ON u.id=s.unit_id WHERE spell_id=? ORDER BY slot_level').all(spellId).map(d=>({slotLevel:Number(d.slot_level),duration:formatQuantity(Number(d.duration_value),String(d.code),String(d.name_ru))})),
  rollMentions:Number(db.prepare('SELECT count(*) n FROM spell_roll_mentions WHERE spell_id=?').get(spellId)?.n),saveMentions:Number(db.prepare('SELECT count(*) n FROM spell_save_mentions WHERE spell_id=?').get(spellId)?.n)};
}
