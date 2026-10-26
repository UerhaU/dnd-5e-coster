import { readFileSync, writeFileSync } from 'node:fs';
const load=path=>JSON.parse(readFileSync(path,'utf8'));
const original=load('database/equipment/catalog-data.json');
const sources=load('storage/catalog-audit/2026-10-16/sources.json');
if(sources.length!==original.magic.length+4||sources.some(row=>row.error))throw new Error('Incomplete source audit');
const references=new Map();
for(const s of sources)for(const link of s.spellLinks){const originalName=link.text.match(/\[([^\]]+)\]/)?.[1];const siteId=Number(link.url.match(/\/spells\/(\d+)-/)?.[1]);if(originalName&&siteId)references.set(originalName.toLowerCase(),{siteId,originalName,url:link.url});}
const snapshot={checkedOn:'2026-10-16',edition:'5e_2014',spellReferences:[...references.values()],sources:sources.map(({spellLinks,...row})=>({...row,...(row.key.startsWith('item-')?{previousDescription:original.magic.find(x=>'item-'+x.siteId===row.key).description}:{})}))};
writeFileSync('database/equipment/source-audit.json',JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({sources:sources.length,references:references.size}));
