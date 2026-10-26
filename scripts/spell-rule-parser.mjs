import { reviewedSpellRules } from './spell-reviewed-rules.mjs';
const damagePatterns=[['acid',/кислот/],['bludgeoning',/дробящ/],['cold',/холод/],['fire',/огн(?:ём|ем|я)|огнен/],['force',/силов(?:ым|ого) пол/],['lightning',/электрич/],['necrotic',/некротич/],['piercing',/колющ/],['poison',/ядом|яда|ядовит/],['psychic',/психич/],['radiant',/излучени/],['slashing',/рубящ/],['thunder',/звуком|звука|громов/]];
export const abilityPatterns=[['strength',/Силы/],['dexterity',/Ловкости/],['constitution',/Телосложения/],['intelligence',/Интеллекта/],['wisdom',/Мудрости/],['charisma',/Харизмы/]];
const conditionPatterns=[['blinded','ослепл'],['charmed','очарован'],['deafened','оглохш'],['frightened','испуган'],['grappled','схвачен'],['incapacitated','недееспособ'],['invisible','невидим'],['paralyzed','парализован'],['petrified','окаменевш'],['poisoned','отравлен'],['prone','сбит с ног'],['restrained','опутан'],['stunned','ошеломл'],['unconscious','бессознател']];
export const spellKey=s=>s.originalName.toLowerCase().replaceAll('’',"'").trim();
export function spellRuleData(spell){
  const key=spellKey(spell),reviewed=reviewedSpellRules[key];
  const paragraphs=spell.description.split(/\n\s*\n/),effects=[],mentions=[],saves=[];
  for(const[paragraphIndex,paragraph]of paragraphs.entries()){
    for(const match of paragraph.matchAll(/спасброс(?:ок|ка|ке|ком|ки|ков|кам|ками|ках)\s+(Силы|Ловкости|Телосложения|Интеллекта|Мудрости|Харизмы)(?:\s+Сл\s*(\d+))?/gi)){
      const ability=abilityPatterns.find(([,pattern])=>pattern.test(match[1][0].toUpperCase()+match[1].slice(1).toLowerCase()))?.[0];if(ability)saves.push({ability,dc:match[2]?Number(match[2]):null,paragraph:paragraphIndex,context:paragraph});
    }
    for(const match of paragraph.matchAll(/\b\d+\s*[кd]\s*\d+(?:\s*\+\s*\d+)?\b/gi))mentions.push({roll:match[0].replace(/\s+/g,'').replace('d','к'),paragraph:paragraphIndex,offset:match.index,context:paragraph});
  }
  if(reviewed)return{effects:reviewed,mentions,saves,reviewed:true};
  const uniqueSaves=[...new Set(saves.map(s=>s.ability))];
  const resolution=/рукопашн\S* атак\S* заклинан/i.test(spell.description)?'рукопашная атака':/дальнобойн\S* атак\S* заклинан/i.test(spell.description)?'дальнобойная атака':uniqueSaves.length===1?'спасбросок':'особое';
  for(const mention of mentions){
    const text=mention.context.toLowerCase();if(/урон.*увеличива|урон.*возраст|на \d+.*уровне.*\(/.test(text)&&spell.level===0)continue;
    const dieIndex=mention.offset,before=text.slice(Math.max(0,dieIndex-100),dieIndex),after=text.slice(dieIndex+mention.roll.length,dieIndex+mention.roll.length+110);
    const damageType=damagePatterns.find(([,pattern])=>pattern.test(after.slice(0,65)))?.[0]??damagePatterns.find(([,pattern])=>pattern.test(before.slice(-70)))?.[0]??null;
    const kind=/временн\S* хит|хит\S* временн/.test(text)?'temporary_hp':/восстан(?:авлив|овит|овлен|овля)/.test(text)&&/хит/.test(text)&&!/урон/.test(text)?'healing':/урон/.test(text)&&damageType?'damage':'other';
    const source=paragraphs[mention.paragraph];
    const roll=mention.roll+(/модификатор(?:а|ом)? (?:вашей |вашего )?(?:базовой характеристики|заклинател|характеристики заклинан)/i.test(source)?'+SC':'');
    const signature=[kind,roll,damageType,source].join('|');if(effects.some(e=>e.signature===signature))continue;
    effects.push({kind,roll,damage:kind==='damage'?damageType:null,resolution:kind==='damage'?resolution:'особое',save:kind==='damage'&&uniqueSaves.length===1?uniqueSaves[0]:null,onSuccess:kind==='damage'&&/половин\S* (?:этого )?урон/.test(text)?'half':null,conditionText:source,paragraph:mention.paragraph,signature,parsed:true});
  }
  if(!effects.length){
    for(const paragraph of paragraphs)for(const[code,stem]of conditionPatterns)if(new RegExp(`(?:становится|становятся|будет|будут|станет|считается)\\s+(?:[^.]{0,30}\\s)?${stem}`,'i').test(paragraph)&&!effects.some(e=>e.condition===code))effects.push({kind:'condition',condition:code,resolution:uniqueSaves.length===1?'спасбросок':'особое',save:uniqueSaves.length===1?uniqueSaves[0]:null,conditionText:paragraph,parsed:true});
  }
  if(!effects.length)effects.push({kind:'other',conditionText:spell.description,descriptionOnly:true});
  return{effects,mentions,saves,reviewed:false};
}
