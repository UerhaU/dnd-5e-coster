import { DatabaseSync } from 'node:sqlite';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyRaceSamples,raceSamplesDdl } from './race-samples-model.mjs';
const path=resolve(process.argv[2]??'storage/spell-catalog.sqlite');
if(!existsSync(path))throw new Error('Catalog missing; run npm run spellbook:init.');
const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON');
try{
 let backup=null;
 if(!db.prepare("SELECT 1 FROM catalog_modules WHERE code='race_samples_2014'").get()){
  mkdirSync(resolve('storage/backups'),{recursive:true});backup=resolve('storage/backups',`spell-catalog-before-race-samples-${Date.now()}.sqlite`);db.prepare('VACUUM INTO ?').run(backup);
 }
 const changed=applyRaceSamples(db);
 if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Integrity check failed');
 writeFileSync(resolve('database/races/schema.sqlite.sql'),raceSamplesDdl);
 console.log(JSON.stringify({database:path,changed,backup,races:db.prepare('SELECT count(*) n FROM race_entries WHERE parent_id IS NULL').get().n,subraces:db.prepare('SELECT count(*) n FROM race_entries WHERE parent_id IS NOT NULL').get().n},null,2));
}finally{db.close();}
