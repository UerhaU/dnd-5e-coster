import { readFileSync,writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const read=path=>readFileSync(path,'utf8');
const html=read('storage/spell-fill/index.html'),list=JSON.parse(read('storage/spell-fill/list.html').match(/window\.LIST\s*=\s*({[\s\S]*?});\s*<\/script>/i)[1]);
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
const maps={};
for(const input of html.matchAll(/<input\b[^>]*>/gi)){
  const name=input[0].match(/\bname=["']([^"']+)/)?.[1],data=input[0].match(/\bdata-list=["']([^"']+)/)?.[1];if(!name||!data)continue;
  maps[name]=JSON.parse(decode(data));
}
const db=new DatabaseSync('storage/dnd.sqlite',{readOnly:true});
const old=db.prepare("SELECT russianName,englishName,entityUrl,editionCompatibility,mechanicsJson,payloadJson FROM ImportedContent WHERE category='spells'").all().map(x=>({...x,siteId:Number(x.entityUrl.match(/\/spells\/(\d+)-/)[1]),mechanics:JSON.parse(x.mechanicsJson),payload:JSON.parse(x.payloadJson)}));db.close();
const cards=list.cards.map(card=>({siteId:Number(card.link.match(/\/spells\/(\d+)-/)[1]),url:'https://5e14.dnd.su'+card.link,...card}));
if(cards.some(c=>!/^\/spells\/\d+-/.test(c.link)))throw new Error('Unexpected section');
const result={checkedOn:'2026-10-16',edition:'5e_2014',cards,maps,old};
writeFileSync('storage/spell-fill/index.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({current:cards.length,old:old.length,new:cards.filter(c=>!old.some(o=>o.siteId===c.siteId)).map(c=>c.title),removed:old.filter(o=>!cards.some(c=>c.siteId===o.siteId)).map(c=>c.russianName),maps:Object.keys(maps)}));
