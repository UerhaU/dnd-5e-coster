import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogDdl, projectSchema } from './build-spell-catalog.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export function migrateMaterials(path) {
  path = resolve(path);
  if (!existsSync(path)) throw new Error(`Database not found: ${path}`);
  const db = new DatabaseSync(path, { timeout: 5000 });
  try {
    const version = Number(db.prepare('PRAGMA user_version').get().user_version);
    if (version === 102) return { changed: false };
    if (version !== 101) throw new Error(`Unsupported schema version: ${version}`);
    const legacy = JSON.parse(readFileSync(resolve(root, 'database/spells/access-export.json'), 'utf8').replace(/^\uFEFF/, ''));
    const oldRows = db.prepare('SELECT * FROM spell_material_requirements ORDER BY id').all();
    const byId = new Map(legacy.tables.spell_material_requirements.map((row) => [row.id, row]));
    for (const row of oldRows) {
      if (row.item_id === null) throw new Error(`Material ${row.id} needs an item_id before migration`);
    }
    const backup = resolve(dirname(path), 'backups', `spell-materials-before-1.2-${Date.now()}.sqlite`);
    mkdirSync(dirname(backup), { recursive: true });
    db.prepare('VACUUM INTO ?').run(backup);
    const ddl = catalogDdl();
    const tableSql = ddl.match(/CREATE TABLE "spell_material_requirements" \([\s\S]*?\n\) STRICT;/)?.[0];
    if (!tableSql) throw new Error('Material table definition not found');
    const columns = projectSchema.tables.find((table) => table.technical === 'spell_material_requirements').fields.map((field) => field.technical);
    const indexes = ddl.split('\n').filter((line) => line.startsWith('CREATE INDEX ') && line.includes(' ON "spell_material_requirements" '));
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(tableSql.replace('CREATE TABLE "spell_material_requirements"', 'CREATE TABLE "spell_material_requirements_next"'));
      const insert = db.prepare(`INSERT INTO spell_material_requirements_next (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
      for (const original of oldRows) {
        const row = { ...original };
        if (row.requirement_text && row.requirement_text !== byId.get(row.id)?.requirement_text) {
          row.special_requirements = [row.special_requirements, row.requirement_text].filter(Boolean).join('\n');
        }
        insert.run(...columns.map((column) => row[column]));
      }
      db.exec('DROP TABLE spell_material_requirements; ALTER TABLE spell_material_requirements_next RENAME TO spell_material_requirements;');
      for (const index of indexes) db.exec(index);
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Broken foreign keys');
      db.exec('PRAGMA user_version = 102; COMMIT;');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { changed: true, rows: oldRows.length, backup };
  } finally { db.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(migrateMaterials(process.argv[2] ?? resolve(root, 'storage/spell-catalog.sqlite')), null, 2));
}
