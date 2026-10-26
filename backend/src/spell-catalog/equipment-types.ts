import type { IllustratedEntry, NamedEntry } from './types.js';
import type { RuleContext } from './rule-context.js';
export interface GearSummary extends IllustratedEntry {
  kind: string; kindCode: string; magical: boolean; status: 'structured'|'partial'; sourceNames: string[];
}
export interface GearList { entries: GearSummary[]; total: number; structured: number; partial: number }
export interface GearLookups { kinds: (NamedEntry & {code:string})[]; sources: NamedEntry[] }
export interface GearRule {
  id:number; name:string; stat:string|null; statCode:string|null; operator:string|null; operatorCode:string|null;
  expression:string|null; stackingMode:string|null; stackingGroup:string|null; source:string;
  conditions:{match:'all'|'any';tests:{fact:string;factCode:string;valueType:string;comparison:string;value:number|string}[]}|null;
  activation:string; duration:string; scope:string; damage:IllustratedEntry|null; roll:string|null;
  context:RuleContext|null;
}
export interface GearAttack {
  id:number;mode:string;hands:number;roll:string|null;damage:IllustratedEntry|null;attackAbility:string;
  alternateAbility:string|null;damageAbility:string;addAbilityToDamage:boolean;reach:number|null;normalRange:number|null;maxRange:number|null;
}
export interface GearDetail extends GearSummary {
  originalName:string|null;category:string|null;description:string|null;requiresAttunement:boolean;attunementRequirement:string|null;
  sourceUrl:string;optional:boolean;priceCp:number|null;priceMinCp:number|null;priceMaxCp:number|null;weightLb:number|null;
  baseOptions:NamedEntry[];selectedBaseId:number|null;variants:(NamedEntry&{enhancement:number|null;rarity:string})[];selectedVariantId:number|null;
  properties:{id:number;name:string;description:string;value:number|null;roll:string|null}[];
  attacks:GearAttack[];rules:GearRule[];unresolvedCount:number;
  ammunition:{id:number;name:string;quantityLabel:string;packageQuantity:number|null;packagePriceCp:number|null;packageWeightLb:number|null}[];
  parameters:{id:number;name:string;minimum:number;maximum:number;defaultValue:number}[];
  resources:{id:number;capacity:number|null;initialRoll:string|null;recoveryRoll:string|null;recharge:string}[];
  numericReviewed:boolean;
}
