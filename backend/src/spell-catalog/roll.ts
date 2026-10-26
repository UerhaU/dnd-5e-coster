import type { DatabaseSync } from 'node:sqlite';

export function readRoll(database: DatabaseSync, formulaId: unknown): string | null {
  if(formulaId==null)return null;
  const terms=database.prepare(`SELECT t.*,d.name_ru AS die_name,a.name_ru AS ability_name FROM roll_terms t
    LEFT JOIN dice d ON d.id=t.die_id LEFT JOIN abilities a ON a.id=t.ability_id WHERE t.formula_id=? ORDER BY t.ordinal`).all(Number(formulaId));
  if(!terms.length){const value=database.prepare('SELECT source_expression FROM roll_formulas WHERE id=?').get(Number(formulaId))?.source_expression;return value==null?null:String(value);}
  return terms.map((term,index)=>{
    let coefficient=Number(term.coefficient),label:string;
    if(term.kind==='кубики')label=`${Math.abs(coefficient)*Number(term.dice_count)}${term.die_name}`;
    else if(term.kind==='константа'){coefficient*=Number(term.constant_value);label=String(Math.abs(coefficient));}
    else{const base=term.kind==='мастерство'?'бонус мастерства':term.use_spellcasting_ability?'модификатор заклинателя':`модификатор (${term.ability_name})`;label=Math.abs(coefficient)===1?base:`${Math.abs(coefficient)} × ${base}`;}
    return `${index===0?coefficient<0?'-':'':coefficient<0?' - ':' + '}${label}`;
  }).join('');
}
