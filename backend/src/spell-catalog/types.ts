import type { FullSpellDetails } from './full-spell-details.js';
export interface NamedEntry { id: number; name: string }
export interface IllustratedEntry extends NamedEntry { iconUrl: string | null }
export interface ClassAccess extends NamedEntry { source: string; rule: string | null }
export interface SpellSummary extends IllustratedEntry {
  originalName: string | null;
  level: number;
  school: NamedEntry;
  ritual: boolean;
  concentration: boolean;
  classes: NamedEntry[];
}
export interface SpellFilters { q?: string; level?: number; school?: number; class?: number; ritual?: boolean; concentration?: boolean }
export interface SpellList { spells: SpellSummary[]; total: number }
export interface MaterialRequirement {
  id: number;
  item: IllustratedEntry;
  quantity: number | null;
  unit: string | null;
  quantityLabel: string | null;
  consumedQuantityLabel: string | null;
  minimumValueCp: number | null;
  consumption: string;
  consumedQuantity: number | null;
  consumptionCondition: string | null;
  specialRequirements: string | null;
}
export interface MaterialGroup {
  id: number;
  selection: string;
  minimumValueCp: number | null;
  description: string | null;
  requirements: MaterialRequirement[];
}
export interface SpellEffect {
  id: number;
  name: string;
  kind: string;
  roll: string | null;
  damageType: IllustratedEntry | null;
  damageChoices: IllustratedEntry[];
  description: string | null;
  resolution: string;
  saveAbility: string | null;
  onSuccess: string | null;
  condition: string | null;
  target: string | null;
  option: string | null;
  ruleTargets: {stat:string;operator:string}[];
  scaling: { basis: string; description: string | null; roll: string | null }[];
}
export interface SpellDetail extends SpellSummary {
  catalog:FullSpellDetails|null;
  edition: string;
  castingTimes: string[];
  range: string | null;
  duration: string | null;
  components: string | null;
  targets: string | null;
  description: string | null;
  higherLevels: string | null;
  sourceUrl: string | null;
  classAccess: ClassAccess[];
  subclasses: (ClassAccess & { className: string })[];
  materials: MaterialGroup[];
  effects: SpellEffect[];
  areas: { shape: string; radiusFt: number | null; lengthFt: number | null; widthFt: number | null; heightFt: number | null; description: string | null }[];
  sources: { name: string; page: string | null; url: string | null }[];
  numericRules:{maximumTargets:number|null;additionalTargetsPerSlot:number;baseSlotLevel:number|null;continuousTouch:boolean;excludedCreatureTypes:string[]}|null;
}
export interface SpellLookups {
  schools: NamedEntry[];
  classes: NamedEntry[];
  damageTypes: IllustratedEntry[];
  items: IllustratedEntry[];
}
