import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readRoll } from './roll.js';
import { hasAudit,readRuleContext } from './rule-context.js';
import { formatQuantity } from './format.js';
import type { GearDetail, GearList, GearLookups, GearRule, GearSummary } from './equipment-types.js';
type Row=Record<string,unknown>;
const txt=(value:unknown)=>value==null?null:String(value);
const num=(value:unknown)=>value==null?null:Number(value);
export class EquipmentCatalog {
  private db:DatabaseSync;
  readonly available:boolean;
  constructor(path:string){this.db=new DatabaseSync(path,{readOnly:true});this.available=Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='gear_entries'").get());}
  close(){this.db.close();}
  private rows(sql:string,...args:SQLInputValue[]):Row[]{return this.db.prepare(sql).all(...args);}
  private summary(row:Row):GearSummary{return{id:Number(row.item_id),name:String(row.name_ru),iconUrl:txt(row.icon_url),kind:String(row.kind_name),kindCode:String(row.kind_code),magical:Boolean(row.magical),status:row.review_status as GearSummary['status'],sourceNames:this.rows('SELECT s.name_ru FROM gear_sources x JOIN sources s ON s.id=x.source_id WHERE x.item_id=?',Number(row.item_id)).map(x=>String(x.name_ru))};}
  lookups():GearLookups{return{kinds:this.rows('SELECT id,code,name_ru AS name FROM gear_kinds') as unknown as GearLookups['kinds'],sources:this.rows('SELECT DISTINCT s.id,s.name_ru AS name FROM sources s JOIN gear_sources x ON x.source_id=s.id ORDER BY s.name_ru') as unknown as GearLookups['sources']};}
  list(filters:{q?:string;kind?:number;magic?:boolean;status?:string;source?:number}={}):GearList{
    const all=this.rows('SELECT g.*,i.name_ru,i.icon_url,k.name_ru AS kind_name,k.code AS kind_code FROM gear_entries g JOIN items i ON i.id=g.item_id JOIN gear_kinds k ON k.id=g.kind_id');
    const fold=(s:string)=>s.toLocaleLowerCase('ru').replaceAll('ё','е');
    const entries=all.filter(row=>(!filters.q||fold(String(row.name_ru)+' '+String(row.original_name??'')).includes(fold(filters.q.trim())))&&(filters.kind===undefined||row.kind_id===filters.kind)&&(filters.magic===undefined||Boolean(row.magical)===filters.magic)&&(!filters.status||row.review_status===filters.status)&&(filters.source===undefined||this.rows('SELECT 1 FROM gear_sources WHERE item_id=? AND source_id=?',Number(row.item_id),filters.source).length>0)).map(row=>this.summary(row)).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    return{entries,total:all.length,structured:all.filter(x=>x.review_status==='structured').length,partial:all.filter(x=>x.review_status==='partial').length};
  }
  detail(id:number,baseId?:number,variantId?:number):GearDetail|null{
    const row=this.rows(`SELECT g.*,i.name_ru,i.icon_url,i.price_cp,i.weight_lb,k.name_ru AS kind_name,k.code AS kind_code,c.name_ru AS category_name
      FROM gear_entries g JOIN items i ON i.id=g.item_id JOIN gear_kinds k ON k.id=g.kind_id LEFT JOIN gear_categories c ON c.id=g.category_id WHERE g.item_id=?`,id)[0];if(!row)return null;
    const baseOptions=this.rows('SELECT x.base_item_id AS id,i.name_ru AS name FROM gear_base_options x JOIN items i ON i.id=x.base_item_id WHERE x.item_id=? ORDER BY i.name_ru',id) as unknown as GearDetail['baseOptions'];
    if(baseId!==undefined&&!baseOptions.some(x=>x.id===baseId))throw new Error('Недопустимая основа предмета.');
    const selectedBaseId=baseId??(baseOptions.length===1?baseOptions[0].id:null);
    const variants=this.rows('SELECT v.id,v.code,v.name_ru AS name,v.enhancement,r.name_ru AS rarity FROM gear_variants v JOIN gear_rarities r ON r.id=v.rarity_id WHERE v.item_id=? ORDER BY v.id',id) as unknown as (GearDetail['variants'][number]&{code:string})[];
    if(variantId!==undefined&&!variants.some(x=>x.id===variantId))throw new Error('Недопустимый вариант предмета.');
    const selectedVariantId=variantId??(variants.length===1?variants[0].id:null),enhancement=variants.find(x=>x.id===selectedVariantId)?.enhancement;
    const ids=selectedBaseId===null?[id]:[id,selectedBaseId],marks=ids.map(()=>'?').join(',');
    const properties=this.rows(`SELECT p.id,p.name_ru AS name,p.description,x.numeric_value AS value,x.formula_id FROM gear_property_links x JOIN gear_properties p ON p.id=x.property_id WHERE x.item_id IN(${marks}) ORDER BY p.id`,...ids).map(p=>({id:Number(p.id),name:String(p.name),description:String(p.description),value:num(p.value),roll:readRoll(this.db,p.formula_id)}));
    const attacks=this.rows(`SELECT p.*,e.roll_formula_id,d.id AS damage_id,d.name_ru AS damage_name,d.icon_url AS damage_icon,a.name_ru AS attack_ability,b.name_ru AS alternate_ability,c.name_ru AS damage_ability FROM gear_attack_profiles p
      LEFT JOIN effects e ON e.id=p.damage_effect_id LEFT JOIN damage_types d ON d.id=e.damage_type_id JOIN abilities a ON a.id=p.attack_ability_id
      LEFT JOIN abilities b ON b.id=p.alternate_ability_id JOIN abilities c ON c.id=p.damage_ability_id WHERE p.item_id IN(${marks}) ORDER BY p.id`,...ids).map(p=>({id:Number(p.id),mode:String(p.mode),hands:Number(p.hands_required),roll:readRoll(this.db,p.roll_formula_id),damage:p.damage_id==null?null:{id:Number(p.damage_id),name:String(p.damage_name),iconUrl:txt(p.damage_icon)},attackAbility:String(p.attack_ability),alternateAbility:txt(p.alternate_ability),damageAbility:String(p.damage_ability),addAbilityToDamage:Boolean(p.add_ability_to_damage),reach:num(p.reach_ft),normalRange:num(p.normal_range_ft),maxRange:num(p.maximum_range_ft)}));
    const rawRules=this.rows(`SELECT l.effect_id,l.condition_group_id,l.activation,l.duration_code,l.scope,i.name_ru AS source FROM gear_effect_links l JOIN items i ON i.id=l.item_id WHERE l.item_id IN(${marks})
      UNION ALL SELECT pe.effect_id,pe.condition_group_id,'weapon_property','while_equipped','source_weapon',p.name_ru FROM property_effect_links pe JOIN gear_property_links x ON x.property_id=pe.property_id JOIN gear_properties p ON p.id=pe.property_id WHERE x.item_id IN(${marks})`,...ids,...ids);
    let rules:GearRule[]=rawRules.map(link=>{
      const e=this.rows(`SELECT e.*,m.stacking_mode,m.stacking_group,s.code AS stat_code,s.name_ru AS stat_name,o.code AS operator_code,o.name_ru AS operator_name
        FROM effects e LEFT JOIN effect_mechanics m ON m.effect_id=e.id LEFT JOIN rule_stats s ON s.id=m.stat_id LEFT JOIN rule_operators o ON o.id=m.operator_id WHERE e.id=?`,Number(link.effect_id))[0];
      const terms=this.rows('SELECT t.*,a.name_ru AS ability_name,p.name_ru AS parameter_name FROM mechanic_terms t LEFT JOIN abilities a ON a.id=t.ability_id LEFT JOIN gear_parameters p ON p.id=t.parameter_id WHERE t.effect_id=? ORDER BY t.ordinal',Number(e.id));
      let expression=terms.map((term,index)=>{
        const coefficient=Number(term.coefficient);let value:string;
        if(term.kind==='constant')value=String(Math.abs(Number(term.constant_value)*coefficient));
        else if(term.kind==='ability')value=`мод. (${term.ability_name})${term.maximum==null?'':` [не более +${term.maximum}]`}`;
        else if(term.kind==='variant')value=enhancement==null?'бонус выбранного варианта':String(enhancement);
        else value=String(term.parameter_name);
        if(term.kind!=='constant'&&Math.abs(coefficient)!==1)value=`${Math.abs(coefficient)} × ${value}`;
        const negative=term.kind==='constant'?Number(term.constant_value)*coefficient<0:coefficient<0;
        return`${index===0?negative?'−':'':negative?' − ':' + '}${value}`;
      }).join('')||null;
      const context=readRuleContext(this.db,Number(e.id));
      if(context?.fact){const dependent=`${context.fact}${context.divisor?` / ${context.divisor}`:''}${context.rounding==='floor'?' (округлить вниз)':''}${context.maximum!==null?` [не более ${context.maximum}]`:''}`;expression=[expression,dependent].filter(Boolean).join(' + ');}
      const group=link.condition_group_id==null?null:this.rows('SELECT match_mode FROM rule_condition_groups WHERE id=?',Number(link.condition_group_id))[0];
      const conditions=group?{match:group.match_mode as 'all'|'any',tests:this.rows('SELECT t.*,f.code AS fact_code,f.name_ru AS fact_name,f.value_type FROM rule_condition_tests t JOIN rule_facts f ON f.id=t.fact_id WHERE t.group_id=? ORDER BY t.id',Number(link.condition_group_id)).map(t=>({fact:String(t.fact_name),factCode:String(t.fact_code),valueType:String(t.value_type),comparison:String(t.comparison),value:t.number_value==null?String(t.code_value):Number(t.number_value)}))}:null;
      const d=e.damage_type_id==null?null:this.rows('SELECT id,name_ru,icon_url FROM damage_types WHERE id=?',Number(e.damage_type_id))[0];
      return{id:Number(e.id),name:String(e.name_ru),stat:txt(e.stat_name),statCode:txt(e.stat_code),operator:txt(e.operator_name),operatorCode:txt(e.operator_code),expression,stackingMode:txt(e.stacking_mode),stackingGroup:txt(e.stacking_group),source:String(link.source),conditions,activation:String(link.activation),duration:String(link.duration_code),scope:String(link.scope),damage:d?{id:Number(d.id),name:String(d.name_ru),iconUrl:txt(d.icon_url)}:null,roll:readRoll(this.db,e.roll_formula_id),context};
    });
    const chosenResistance=variants.find(v=>v.id===selectedVariantId)?.code.replace(/^resistance:/,'');
    const ownBaseOverride=rules.some(r=>r.source===row.name_ru&&r.statCode==='armor_class'&&r.stackingMode==='override');
    const grantedProficiency=rules.some(r=>r.source===row.name_ru&&r.statCode==='armor_proficiency'&&r.operatorCode==='grant');
    rules=rules.filter(r=>{
      if(ownBaseOverride&&r.source!==row.name_ru&&r.statCode==='armor_class'&&r.operatorCode==='base')return false;
      if(grantedProficiency&&r.source!==row.name_ru&&r.conditions?.tests.some(test=>test.factCode==='armor_proficient'))return false;
      const resistanceTest=r.conditions?.tests.find(test=>test.factCode==='selected_resistance');
      if(resistanceTest){if(!chosenResistance)return false;return resistanceTest.comparison==='ne'?resistanceTest.value!==chosenResistance:resistanceTest.value===chosenResistance;}
      return true;
    });
    const base=selectedBaseId===null?null:this.rows('SELECT i.weight_lb,c.name_ru AS category FROM items i JOIN gear_entries g ON g.item_id=i.id LEFT JOIN gear_categories c ON c.id=g.category_id WHERE i.id=?',selectedBaseId)[0];
    const unresolvedCount=ids.reduce((sum,item)=>sum+Number(this.rows('SELECT COUNT(*) AS n FROM gear_unresolved_rules WHERE item_id=?',item)[0].n),0);
    const ammunition=this.rows(`SELECT i.id,i.name_ru,a.quantity_per_attack,u.code AS unit_code,u.name_ru AS unit_name,p.quantity,p.price_cp,p.weight_lb FROM weapon_ammunition a JOIN items i ON i.id=a.ammunition_item_id JOIN quantity_units u ON u.id=a.unit_id LEFT JOIN item_packages p ON p.item_id=i.id WHERE a.weapon_item_id IN(${marks})`,...ids).map(a=>({id:Number(a.id),name:String(a.name_ru),quantityLabel:formatQuantity(Number(a.quantity_per_attack),txt(a.unit_code),txt(a.unit_name)),packageQuantity:num(a.quantity),packagePriceCp:num(a.price_cp),packageWeightLb:num(a.weight_lb)}));
    const resources=hasAudit(this.db)?this.rows('SELECT r.*,e.name_ru AS recharge FROM gear_resources r JOIN rule_events e ON e.id=r.recharge_event_id WHERE r.item_id=?',id).map(r=>({id:Number(r.id),capacity:num(r.capacity),initialRoll:readRoll(this.db,r.initial_formula_id),recoveryRoll:readRoll(this.db,r.recovery_formula_id),recharge:String(r.recharge)})):[];
    const numericReviewed=hasAudit(this.db)&&Boolean(this.rows('SELECT 1 FROM gear_rule_reviews WHERE item_id=?',id).length);
    return{...this.summary(row),originalName:txt(row.original_name),category:txt(base?.category??row.category_name),description:txt(row.description),requiresAttunement:Boolean(row.requires_attunement),attunementRequirement:txt(row.attunement_requirement),sourceUrl:String(row.source_url),optional:Boolean(row.optional_rule),priceCp:num(row.price_cp),priceMinCp:num(row.price_min_cp),priceMaxCp:num(row.price_max_cp),weightLb:num(row.weight_lb??base?.weight_lb),baseOptions,selectedBaseId,variants,selectedVariantId,properties,attacks,rules,unresolvedCount,ammunition,resources,numericReviewed,parameters:this.rows('SELECT id,name_ru AS name,minimum,maximum,default_value AS defaultValue FROM gear_parameters WHERE item_id=?',id) as unknown as GearDetail['parameters']};
  }
}
