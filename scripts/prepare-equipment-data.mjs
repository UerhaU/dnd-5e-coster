import { readFileSync, writeFileSync } from 'node:fs';
const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const inventory = load('database/equipment/inventory-tables.json');
const firearms = load('database/equipment/firearms-tables.json');
const magic = load('database/equipment/imported-magic.json');
const inventoryUrl = 'https://5e14.dnd.su/articles/inventory/147-armor-arms-equipment-tools/';
const firearmsUrl = 'https://5e14.dnd.su/articles/inventory/155-firearms-and-explosives/';
const numeric = (value) => Number(value.replaceAll(' ', '').replace('¼','.25').replace('½','.5').replace(',','.'));
function price(value) {
  const match = value.match(/^([\d\s,.]+)\s*(мм|см|эм|зм|пм)/);
  return match ? Math.round(numeric(match[1]) * ({мм:1,см:10,эм:50,зм:100,пм:1000}[match[2]])) : null;
}
function weight(value) {
  const match = value.match(/^([\d\s¼½,.]+)\s*(фнт|унц)/);
  return match ? numeric(match[1]) / (match[2] === 'унц' ? 16 : 1) : null;
}
const base = [];
let category='';
for (const row of inventory[0].slice(1)) {
  if (row.length === 1) { category = /Лёгкий/.test(row[0]) ? 'light_armor' : /Средний/.test(row[0]) ? 'medium_armor' : /Тяжёлый/.test(row[0]) ? 'heavy_armor' : 'shield'; continue; }
  base.push({key:`base:${base.length+1}`,name:row[0],kind:category==='shield'?'shield':'armor',category,priceCp:price(row[1]),weightLb:weight(row[5]),ac:Number(row[2].match(/^\d+/)[0]),dex:row[2].includes('Лов'),dexCap:row[2].includes('макс.')?2:null,strength:row[3].match(/\d+/)?.[0]*1 || null,stealth:row[4]==='Помеха',source:"Player's Handbook",url:inventoryUrl,optional:false});
}
function weapon(row, category, source, url, optional) {
  const props = row[4];
  const damage = row[2].match(/(\d+к\d+|\d+)\s+(.*)/);
  const range = props.match(/(?:дис[^\d]*|Боеприпас\s*\()(\d+)\/(\d+)/i);
  base.push({key:`base:${base.length+1}`,name:row[0].replace(/\s*\([A-Z]+\)$/,''),kind:'weapon',category,priceCp:price(row[1]),weightLb:weight(row[3]),damage:damage?.[1]??null,damageType:damage?.[2]??null,properties:props,normalRange:range?Number(range[1]):null,maxRange:range?Number(range[2]):null,source,url,optional});
}
for (const row of inventory[1].slice(1)) {
  if(row.length===1){ category = /Простое/.test(row[0]) ? (/рукопашное/.test(row[0])?'simple_melee':'simple_ranged') : /рукопашное/.test(row[0])?'martial_melee':'martial_ranged';continue; }
  weapon(row,category,"Player's Handbook",inventoryUrl,false);
}
const extraSources=["Eberron: Rising from the Last War","Tomb of Annihilation","Out of the Abyss","Out of the Abyss","Waterdeep: Dragon Heist","Dragonlance: Shadow of the Dragon Queen"];
for(let i=5;i<=10;i++)for(const row of inventory[i].slice(1))weapon(row,i===8||i===9?'martial_ranged':'martial_melee',extraSources[i-5],inventoryUrl,true);
let firearmCategory='renaissance';
for (const row of firearms[0].slice(1)) {
  if (row.length===1) {if(/Современное/i.test(row[0]))firearmCategory='modern';if(/Футуристическое/i.test(row[0]))firearmCategory='future';continue;}
  if (!/\d/.test(row[2])) continue;
  weapon(row,`firearm_${firearmCategory}`,"Dungeon Master's Guide",firearmsUrl,true);
}
const optionalNotes={
  'Двухклинковый скимитар':'После действия Атака этим оружием доступна атака обратным клинком бонусным действием с уроном 1к4.',
  'Короткое копьё с крюком':'Вместо урона можно опрокинуть цель: спасбросок Силы против 8 + модификатор Силы владельца + бонус мастерства.',
  'Лёгкий многозарядный арбалет':'Обойма на 6 болтов, перезарядка обоймы действием. Свойства «перезарядка» нет.',
  'Большой длинный лук':'Требует размер Средний или больше и Силу 18. К урону добавляется модификатор Силы.',
  'Хупак':'Рукопашный режим игнорирует боеприпасы. Дальнобойный режим использует снаряды пращи и наносит 1к4 дробящего урона.',
  'Сеть':'Не наносит обычного урона. Опутывает подходящую цель; условия освобождения и ограничения см. источник.',
};
for(const entry of base)entry.specialDescription=optionalNotes[entry.name]??null;
const ammunition=[];
for(const row of inventory[2].slice(5,9))ammunition.push({name:row[0].replace(/\s*\(\d+\)/,''),quantity:Number(row[0].match(/\((\d+)\)/)[1]),priceCp:price(row[1]),weightLb:weight(row[2]),source:"Player's Handbook"});
for(const row of firearms[0].filter(row=>row.length===5&&['Пули (10)','Патроны (10)','Батарея'].includes(row[0])))ammunition.push({name:row[0].replace(/\s*\(\d+\)/,''),quantity:Number(row[0].match(/\((\d+)\)/)?.[1]??1),priceCp:price(row[1]),weightLb:weight(row[3]),source:"Dungeon Master's Guide"});
ammunition.push({name:'Большие стрелы',quantity:1,priceCp:null,weightLb:null,source:'Waterdeep: Dragon Heist'});
const payload={version:1,edition:'5e_2014',base,ammunition,magic:magic.map((row)=>({siteId:Number(row.url.match(/\/items\/(\d+)-/)[1]),name:row.name,originalName:row.originalName,url:row.url,typeLine:row.mechanics.typeLine,description:row.payload.details.descriptionText,requiresAttunement:row.mechanics.requiresAttunement,sourceTitles:row.payload.sourceTitles,originalEditionStatus:row.edition,priceText:row.mechanics.priceText??null}))};
writeFileSync('database/equipment/catalog-data.json',JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({base:base.length,magic:payload.magic.length,ordinaryWeapons:base.filter(x=>x.kind==='weapon').length,armorAndShields:base.filter(x=>x.kind!=='weapon').length}));
