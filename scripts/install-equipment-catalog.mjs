import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { applyEquipment, equipmentDdl } from './equipment-model.mjs';

const path=resolve(process.argv.slice(2).find(arg=>!arg.startsWith('--'))??'storage/spell-catalog.sqlite');
const rebuild=process.argv.includes('--rebuild');
if(!existsSync(path))throw new Error('Сначала создайте новую базу заклинаний.');
const db=new DatabaseSync(path,{timeout:5000});
try{
  if(rebuild||!db.prepare("SELECT 1 FROM sqlite_master WHERE name='catalog_modules'").get()){
    const backup=resolve(dirname(path),'backups',`before-equipment-${Date.now()}.sqlite`);
    mkdirSync(dirname(backup),{recursive:true});db.prepare('VACUUM INTO ?').run(backup);console.log(JSON.stringify({backup}));
  }
  console.log(JSON.stringify(applyEquipment(db,undefined,{rebuild})));
  writeFileSync('database/equipment/schema.sqlite.sql',equipmentDdl);
}finally{db.close();}
