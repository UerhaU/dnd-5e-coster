import { readFileSync,writeFileSync } from 'node:fs';
import { descriptionParagraphs } from './dndsu-description.mjs';
const input=JSON.parse(readFileSync('storage/spell-fill/index.json','utf8'));
const sources=JSON.parse(readFileSync('storage/spell-fill/sources.json','utf8'));
const decode=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&thinsp;|&#8201;/g,' ').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const flatten=(nodes,output=[])=>{for(const node of Object.values(nodes)){if(node.value!==undefined)output.push({id:Number(node.value),name:node.title});if(node.list)flatten(node.list,output);}return output;};
const maps=Object.fromEntries(Object.entries(input.maps).map(([key,value])=>[key,flatten(value)]));
const subclasses=[];for(const parent of Object.values(input.maps.archetype))for(const child of flatten(parent.list))subclasses.push({...child,className:parent.title});
const forbidden=new Set(flatten(input.maps.source['999'].list).map(x=>x.id));
const records=[];
for(const card of input.cards){
  if(card.filter_source.some(s=>forbidden.has(s)))throw new Error('Homebrew source selected');
  const source=sources.find(x=>x.key==='spell-'+card.siteId);if(!source||source.error)throw new Error('Missing source '+card.siteId);
  const html=readFileSync('storage/spell-fill/pages/spell-'+card.siteId+'.html','utf8');
  const fields={};for(const match of html.matchAll(/<li[^>]*>\s*<strong>([^<:]+):<\/strong>\s*([\s\S]*?)<\/li>/gi))fields[decode(match[1]).toLowerCase()]=decode(match[2]);
  const paragraphs=descriptionParagraphs(html);const higherIndex=paragraphs.findIndex(p=>/^На (?:больших|высоких) уровнях\./i.test(p));
  const description=(higherIndex<0?paragraphs:paragraphs.slice(0,higherIndex)).join('\n\n');
  const higherLevels=higherIndex<0?null:paragraphs.slice(higherIndex).join('\n\n').replace(/^На (?:больших|высоких) уровнях\.\s*/i,'');
  const components=fields['компоненты'];let material=null;
  if(components?.includes('(')){let depth=0,end=-1;const begin=components.indexOf('(');for(let i=begin;i<components.length;i++){if(components[i]==='(')depth++;if(components[i]===')'&&--depth===0){end=i;break;}}if(end<0)throw new Error('Unclosed material '+card.siteId);material=components.slice(begin+1,end);}
  const flags=card.filter_components.split('|');
  records.push({siteId:card.siteId,url:card.url,name:card.title,originalName:card.title_en,level:Number(card.filter_level[0]),school:card.school,ritual:card.filter_ritual.includes('2'),concentration:card.filter_concentration.includes('2'),sourceIds:card.filter_source,classIds:card.filter_class,optionalClassIds:card.filter_class_tce,subclassIds:card.filter_archetype,componentCodes:['V','S','M'].filter((_,i)=>flags[i]==='1'),casting:fields['время накладывания']??null,range:fields['дистанция']??null,duration:fields['длительность']??null,components:components??null,material,description,higherLevels,sourceHash:source.sha256,checkedOn:source.checkedOn,originalEditionStatus:input.old.find(x=>x.siteId===card.siteId)?.editionCompatibility??null});
  if([1922,2341].includes(card.siteId)){Object.assign(records.at(-1),{componentCodes:['V','S','R'],material:null,royaltyCp:card.siteId===1922?200:100});}
}
const missing=records.filter(s=>!s.description||!s.casting||!s.range||!s.duration||s.componentCodes.includes('M')&&!s.material);
if(missing.length){console.log(JSON.stringify(missing.map(x=>({id:x.siteId,name:x.name,casting:x.casting,range:x.range,duration:x.duration,components:x.components})),null,2));throw new Error('Incomplete spell metadata');}
writeFileSync('database/spells/full-catalog.json',JSON.stringify({edition:'5e_2014',version:1,checkedOn:'2026-10-16',sources:maps.source.filter(x=>!forbidden.has(x.id)),classes:maps.class,subclasses,spells:records},null,2)+'\n');
console.log(JSON.stringify({spells:records.length,materials:records.filter(x=>x.material).length,sources:new Set(records.flatMap(x=>x.sourceIds)).size}));
