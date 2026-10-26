import { DatabaseSync } from 'node:sqlite';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyFullSpells,fullSpellDdl } from './full-spell-catalog.mjs';
const path=resolve(process.argv[2]??'storage/spell-catalog.sqlite');
if(!existsSync(path))throw new Error('Catalog is missing; run npm run spellbook:init.');
const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON');
try{
 let backup=null;
 if(!db.prepare("SELECT 1 FROM catalog_modules WHERE code='full_spells_2014'").get()){
  mkdirSync(resolve('storage/backups'),{recursive:true});backup=resolve('storage/backups',`spell-catalog-before-full-spells-${Date.now()}.sqlite`);
  db.prepare('VACUUM INTO ?').run(backup);
 }
 const changed=applyFullSpells(db);
 if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Integrity check failed');
 writeFileSync(resolve('database/spells/full-catalog.sqlite.sql'),fullSpellDdl);
 console.log(JSON.stringify({database:path,changed,backup,spells:db.prepare('SELECT count(*) n FROM spells').get().n,mechanics:db.prepare('SELECT mechanics_status,count(*) count FROM spell_catalog_entries GROUP BY 1').all()},null,2));
}finally{db.close();}
