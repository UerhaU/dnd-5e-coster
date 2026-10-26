import { DatabaseSync } from 'node:sqlite';
import { readRoll } from './roll.js';
import type { BodyGenerator,CarryingRule } from './race-math.js';
type Row=Record<string,unknown>;
const num=(v:unknown)=>v==null?null:Number(v),txt=(v:unknown)=>v==null?null:String(v);
const fold=(v:string)=>v.toLocaleLowerCase('ru').replace(/ё/g,'е');
export interface RaceSummary {id:number;name:string;originalName:string;iconUrl:string|null;subraces:{id:number;name:string}[]}
export interface RaceDetail extends RaceSummary {
 selectedSubrace:{id:number;name:string}|null;description:string|null;size:{id:number;name:string;code:string;carryingMultiplier:number};creatureType:string;
 speeds:{mode:string;feet:number;origin:string}[];bonuses:{abilityId:number;ability:string;bonus:number}[];
 body:{id:number;heightMinIn:number|null;heightMaxIn:number|null;weightMinLb:number|null;weightMaxLb:number|null;weightAverageLb:number|null;adultAge:number|null;adulthoodBasis:string|null;lifespan:number|null;lifespanQualifier:string|null;notes:string|null}|null;
 generator:BodyGenerator|null;carrying:CarryingRule;
 languages:{id:number;name:string}[];proficiencies:{id:number;name:string;kind:string;itemId:number|null}[];
 choices:{id:number;name:string;kind:string;count:number;castingAbility:string|null;origin:string;options:{id:number;name:string;exotic:boolean}[]}[];
 traits:{id:number;name:string;description:string;origin:string;rules:{id:number;effectId:number;stat:string;operator:string;value:number|null;damage:string|null;basis:string;conditions:string[]}[]}[];
 sources:{name:string;url:string;checkedOn:string}[];
}
export class RaceCatalog{
 private db:DatabaseSync;
 constructor(path:string){this.db=new DatabaseSync(path,{readOnly:true,enableForeignKeyConstraints:true});}
 close(){this.db.close();}
 get available(){return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='race_entries'").get());}
 private rows(sql:string,...params:(number|string)[]){return this.db.prepare(sql).all(...params);}
 private summary(row:Row):RaceSummary{return{id:Number(row.id),name:String(row.name_ru),originalName:String(row.name_original),iconUrl:txt(row.icon_url),subraces:this.rows('SELECT id,name_ru AS name FROM race_entries WHERE parent_id=? ORDER BY name_ru',Number(row.id)) as unknown as RaceSummary['subraces']};}
 list(q=''){
  if(!this.available)return{entries:[],total:0};
  const roots=this.rows('SELECT * FROM race_entries WHERE parent_id IS NULL ORDER BY name_ru').map(r=>this.summary(r)),query=fold(q.trim());
  return{entries:roots.filter(r=>!query||fold([r.name,r.originalName,...r.subraces.map(s=>s.name)].join(' ')).includes(query)),total:roots.length};
 }
 detail(raceId:number,subraceId?:number):RaceDetail|null{
  if(!this.available)return null;
  const row=this.rows('SELECT * FROM race_entries WHERE id=?',raceId)[0];if(!row)return null;
  const root=row.parent_id==null?row:this.rows('SELECT * FROM race_entries WHERE id=?',Number(row.parent_id))[0],summary=this.summary(root);
  if(subraceId!==undefined&&!summary.subraces.some(s=>s.id===subraceId))throw new Error('Разновидность не принадлежит выбранной расе.');
  const selectedId=subraceId??(row.parent_id!=null?Number(row.id):summary.subraces[0]?.id),selected=selectedId?this.rows('SELECT * FROM race_entries WHERE id=?',selectedId)[0]:null;
  const ids=selected?[Number(root.id),Number(selected.id)]:[Number(root.id)],marks=ids.map(()=>'?').join(',');
  const resolved=(field:string)=>selected?.[field]??root[field];
  const size=this.rows('SELECT * FROM creature_sizes WHERE id=?',Number(resolved('size_id')))[0];
  const body=resolved('body_description_id')==null?null:this.rows('SELECT * FROM body_descriptions WHERE id=?',Number(resolved('body_description_id')))[0];
  const g=resolved('body_generator_id')==null?null:this.rows('SELECT g.*,s.url FROM body_generators g JOIN race_source_checks s ON s.id=g.source_check_id WHERE g.id=?',Number(resolved('body_generator_id')))[0];
  const dice=(formula:unknown)=>{const t=this.rows('SELECT t.dice_count,d.sides FROM roll_terms t JOIN dice d ON d.id=t.die_id WHERE t.formula_id=? ORDER BY t.ordinal',Number(formula));if(t.length!==1)throw new Error('Неверная формула генератора тела.');const count=Number(t[0].dice_count),sides=Number(t[0].sides);return{count,sides,label:readRoll(this.db,formula)??'',minimum:count,maximum:count*sides};};
  const c=this.rows('SELECT r.*,a.name_ru AS ability,s.url FROM carrying_rules r JOIN abilities a ON a.id=r.ability_id JOIN race_source_checks s ON s.id=r.source_check_id WHERE r.code=?','standard_2014')[0];
  const speeds=new Map<string,RaceDetail['speeds'][number]>();
  for(const id of ids)for(const s of this.rows('SELECT m.code,m.name_ru,s.speed_ft,r.name_ru AS origin FROM race_speeds s JOIN movement_modes m ON m.id=s.movement_mode_id JOIN race_entries r ON r.id=s.race_id WHERE s.race_id=?',id))speeds.set(String(s.code),{mode:String(s.name_ru),feet:Number(s.speed_ft),origin:String(s.origin)});
  return{...summary,selectedSubrace:selected?{id:Number(selected.id),name:String(selected.name_ru)}:null,description:txt(root.description),
   size:{id:Number(size.id),code:String(size.code),name:String(size.name_ru),carryingMultiplier:Number(size.carrying_multiplier)},creatureType:String(this.rows('SELECT name_ru FROM creature_types WHERE id=?',Number(resolved('creature_type_id')))[0].name_ru),
   speeds:[...speeds.values()],bonuses:this.rows(`SELECT a.id AS abilityId,a.name_ru AS ability,sum(b.bonus) AS bonus FROM race_ability_bonuses b JOIN abilities a ON a.id=b.ability_id WHERE b.race_id IN(${marks}) GROUP BY a.id ORDER BY a.id`,...ids) as unknown as RaceDetail['bonuses'],
   body:body?{id:Number(body.id),heightMinIn:num(body.height_min_in),heightMaxIn:num(body.height_max_in),weightMinLb:num(body.weight_min_lb),weightMaxLb:num(body.weight_max_lb),weightAverageLb:num(body.weight_average_lb),adultAge:num(body.adult_age_years),adulthoodBasis:txt(body.adulthood_basis),lifespan:num(body.lifespan_years),lifespanQualifier:txt(body.lifespan_qualifier),notes:txt(body.notes)}:null,
   generator:g?{id:Number(g.id),baseHeightIn:Number(g.base_height_in),baseWeightLb:Number(g.base_weight_lb),heightDice:dice(g.height_roll_id),weightDice:dice(g.weight_roll_id),formulaCode:String(g.weight_formula_code),sourceUrl:String(g.url)}:null,
   carrying:{ability:String(c.ability),carryPerPoint:Number(c.carry_lb_per_point),pushDragLiftPerPoint:Number(c.push_drag_lift_lb_per_point),overloadedDragSpeedFt:Number(c.overloaded_drag_speed_ft),sourceUrl:String(c.url)},
   languages:this.rows(`SELECT DISTINCT l.id,l.name_ru AS name FROM race_languages x JOIN languages l ON l.id=x.language_id WHERE x.race_id IN(${marks}) ORDER BY l.name_ru`,...ids) as unknown as RaceDetail['languages'],
   proficiencies:this.rows(`SELECT DISTINCT p.id,COALESCE(i.name_ru,g.name_ru,p.name_ru) AS name,p.kind,p.gear_item_id AS itemId FROM race_proficiencies x JOIN proficiencies p ON p.id=x.proficiency_id LEFT JOIN items i ON i.id=p.gear_item_id LEFT JOIN gear_categories g ON g.id=p.gear_category_id WHERE x.race_id IN(${marks}) ORDER BY p.kind,name`,...ids) as unknown as RaceDetail['proficiencies'],
   choices:this.rows(`SELECT c.*,a.name_ru AS ability,r.name_ru AS origin FROM race_choices c JOIN race_entries r ON r.id=c.race_id LEFT JOIN abilities a ON a.id=c.casting_ability_id WHERE c.race_id IN(${marks}) ORDER BY c.id`,...ids).map(choice=>({id:Number(choice.id),name:String(choice.name_ru),kind:String(choice.kind),count:Number(choice.choose_count),castingAbility:txt(choice.ability),origin:String(choice.origin),options:this.rows(`SELECT COALESCE(l.id,p.id,s.id) AS id,COALESCE(l.name_ru,i.name_ru,g.name_ru,p.name_ru,s.name_ru) AS name,coalesce(l.exotic,0) AS exotic FROM race_choice_options o LEFT JOIN languages l ON l.id=o.language_id LEFT JOIN proficiencies p ON p.id=o.proficiency_id LEFT JOIN items i ON i.id=p.gear_item_id LEFT JOIN gear_categories g ON g.id=p.gear_category_id LEFT JOIN spells s ON s.id=o.spell_id WHERE o.choice_id=? ORDER BY name`,Number(choice.id)).map(o=>({id:Number(o.id),name:String(o.name),exotic:Boolean(o.exotic)}))})),
   traits:this.rows(`SELECT t.*,r.name_ru AS origin FROM race_trait_links x JOIN race_traits t ON t.id=x.trait_id JOIN race_entries r ON r.id=x.race_id WHERE x.race_id IN(${marks}) ORDER BY x.race_id,t.id`,...ids).map(t=>({id:Number(t.id),name:String(t.name_ru),description:String(t.description),origin:String(t.origin),rules:this.rows(`SELECT x.*,s.name_ru AS stat,o.name_ru AS operator,d.name_ru AS damage,mt.constant_value AS value FROM race_trait_effects x JOIN effects e ON e.id=x.effect_id JOIN effect_mechanics m ON m.effect_id=e.id JOIN rule_stats s ON s.id=m.stat_id JOIN rule_operators o ON o.id=m.operator_id LEFT JOIN damage_types d ON d.id=e.damage_type_id LEFT JOIN mechanic_terms mt ON mt.effect_id=e.id AND mt.ordinal=1 WHERE x.trait_id=? ORDER BY x.id`,Number(t.id)).map(e=>({id:Number(e.id),effectId:Number(e.effect_id),stat:String(e.stat),operator:String(e.operator),value:num(e.value),damage:txt(e.damage),basis:String(e.value_basis),conditions:e.condition_group_id==null?[]:this.rows('SELECT f.name_ru FROM rule_condition_tests t JOIN rule_facts f ON f.id=t.fact_id WHERE t.group_id=? ORDER BY t.id',Number(e.condition_group_id)).map(f=>String(f.name_ru))}))})),
   sources:this.rows(`SELECT DISTINCT s.name_ru AS name,c.url,c.checked_on AS checkedOn FROM race_entries r JOIN sources s ON s.id=r.source_id JOIN race_source_checks c ON c.id=r.source_check_id WHERE r.id IN(${marks})`,...ids) as unknown as RaceDetail['sources']};
 }
}
