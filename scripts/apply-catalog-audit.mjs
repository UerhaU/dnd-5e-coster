import { DatabaseSync } from 'node:sqlite';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { applyCatalogAudit,auditDdl } from './catalog-audit-model.mjs';
import { applyAuditCorrections,applyAuditSemantics,applyRuidiumTravel,applyDelayedOutcomes } from './catalog-audit-corrections.mjs';
const path=resolve(process.argv[2]??'storage/spell-catalog.sqlite');
if(!existsSync(path))throw new Error('Catalog is missing');
const db=new DatabaseSync(path,{timeout:5000});
try{
  const backup=resolve(dirname(path),'backups','before-rules-audit-'+Date.now()+'.sqlite');
  if(!db.prepare("SELECT 1 FROM catalog_modules WHERE code='delayed_outcomes_v6'").get()){mkdirSync(dirname(backup),{recursive:true});db.prepare('VACUUM INTO ?').run(backup);console.log(JSON.stringify({backup}));}
  console.log(JSON.stringify(applyCatalogAudit(db)));
  console.log(JSON.stringify(applyAuditCorrections(db)));
  console.log(JSON.stringify(applyAuditSemantics(db)));
  console.log(JSON.stringify(applyRuidiumTravel(db)));
  console.log(JSON.stringify(applyDelayedOutcomes(db)));
  const tables=[...auditDdl.matchAll(/CREATE TABLE (\w+)/g)].map(match=>match[1]);
  writeFileSync('database/equipment/audit-schema.sqlite.sql',tables.map(name=>db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name).sql+';').join('\n\n')+'\n');
}finally{db.close();}
