export interface DiceSpec {count:number;sides:number;label:string;minimum:number;maximum:number}
export interface BodyGenerator {id:number;baseHeightIn:number;baseWeightLb:number;heightDice:DiceSpec;weightDice:DiceSpec;formulaCode:string;sourceUrl:string}
export interface CarryingRule {ability:string;carryPerPoint:number;pushDragLiftPerPoint:number;overloadedDragSpeedFt:number;sourceUrl:string}
export function calculateBody(generator:BodyGenerator,heightRoll:number,weightRoll:number){
 for(const[value,die]of[[heightRoll,generator.heightDice],[weightRoll,generator.weightDice]] as const)if(!Number.isInteger(value)||value<die.minimum||value>die.maximum)throw new Error('Результат броска вне допустимого диапазона.');
 if(generator.formulaCode!=='base_plus_height_roll_times_weight_roll')throw new Error('Неизвестная формула веса.');
 const heightIn=generator.baseHeightIn+heightRoll,weightLb=generator.baseWeightLb+heightRoll*weightRoll;
 return{heightIn,heightCm:heightIn*2.54,weightLb,weightKg:weightLb*0.45359237};
}
export function calculateCarrying(rule:CarryingRule,strength:number,sizeMultiplier:number,loadLb=0){
 if(!Number.isFinite(strength)||strength<1||strength>30||!Number.isInteger(strength))throw new Error('Сила должна быть целым числом от 1 до 30.');
 if(!Number.isFinite(sizeMultiplier)||sizeMultiplier<=0||!Number.isFinite(loadLb)||loadLb<0)throw new Error('Некорректный размер или вес груза.');
 const capacityLb=strength*rule.carryPerPoint*sizeMultiplier,pushDragLiftLb=strength*rule.pushDragLiftPerPoint*sizeMultiplier;
 return{capacityLb,capacityKg:capacityLb*0.45359237,pushDragLiftLb,pushDragLiftKg:pushDragLiftLb*0.45359237,remainingLb:capacityLb-loadLb,overloaded:loadLb>capacityLb};
}
