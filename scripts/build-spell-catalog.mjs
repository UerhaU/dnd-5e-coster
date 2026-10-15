import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const schema = JSON.parse(readFileSync(resolve(root, 'database/spells/schema.json'), 'utf8'));
const rules = JSON.parse(readFileSync(resolve(root, 'database/spells/project-rules.json'), 'utf8'));
export const projectSchema = structuredClone(schema);
projectSchema.version = rules.version;
for (const table of projectSchema.tables) {
  table.fields = table.fields.filter((field) => !(rules.removeFields[table.technical] ?? []).includes(field.technical));
  for (const field of table.fields) if ((rules.requireFields[table.technical] ?? []).includes(field.technical)) field.required = true;
}
const typeMap = { counter: 'INTEGER', long: 'INTEGER', boolean: 'INTEGER', currency: 'INTEGER', double: 'REAL', text: 'TEXT', memo: 'TEXT', datetime: 'TEXT' };

function expression(rule, table, field) {
  let sql = rule.replace(/"([^"]*)"/g, (_, value) => `'${value.replaceAll("'", "''")}'`);
  sql = sql.replace(/\[([^\]]+)\]/g, (_, name) => {
    const target = table.fields.find((item) => item.name === name);
    if (!target) throw new Error(`Unknown rule field: ${table.name}.${name}`);
    return quote(target.technical);
  }).replace(/\bFalse\b/gi, '0').replace(/\bTrue\b/gi, '1');
  sql = sql.replace(/Fix\(([^)]+)\)/gi, 'CAST($1 AS INTEGER)');
  if (field) sql = sql.replace(/(^|\bAnd\b|\bOr\b|\()\s*(?=Between\b|In\b|Is\b|[<>=])/gi, `$1 ${quote(field.technical)} `);
  return sql;
}

export function catalogDdl() {
  const statements = ['PRAGMA foreign_keys = ON;'];
  for (const table of projectSchema.tables) {
    const definitions = [];
    for (const field of table.fields) {
      const column = quote(field.technical);
      if (!typeMap[field.type]) throw new Error(`Unsupported type: ${field.type}`);
      let definition = `${column} ${typeMap[field.type]}`;
      if (field.type === 'counter') definition += ' PRIMARY KEY AUTOINCREMENT';
      else if (field.required) definition += ' NOT NULL';
      if (field.default !== null) definition += ` DEFAULT ${expression(field.default, table)}`;
      if (field.type === 'boolean') definition += ` CHECK (${column} IN (0, 1))`;
      if (field.type === 'text') definition += ` CHECK (${column} IS NULL OR (length(${column}) BETWEEN 1 AND ${field.size}))`;
      if (field.rule) definition += ` CHECK (${expression(field.rule, table, field)})`;
      if (field.references) {
        const parent = schema.tables.find((item) => item.name === field.references);
        if (!parent) throw new Error(`Unknown parent: ${field.references}`);
        definition += ` REFERENCES ${quote(parent.technical)}(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED`;
      }
      definitions.push(definition);
    }
    for (const columns of table.unique) {
      definitions.push(`UNIQUE (${columns.map((name) => quote(table.fields.find((field) => field.name === name).technical)).join(', ')})`);
    }
    if (table.rule) definitions.push(`CHECK (${expression(table.rule, table)})`);
    statements.push(`CREATE TABLE ${quote(table.technical)} (\n  ${definitions.join(',\n  ')}\n) STRICT;`);
    for (const field of table.fields.filter((item) => item.references)) {
      statements.push(`CREATE INDEX ${quote(`ix_${table.technical}_${field.technical}`)} ON ${quote(table.technical)} (${quote(field.technical)});`);
    }
  }
  statements.push(`PRAGMA user_version = ${rules.userVersion};`);
  return statements.join('\n\n') + '\n';
}

export function createCatalog(output, { exportPath = resolve(root, 'database/spells/access-export.json') } = {}) {
  output = resolve(output);
  if (existsSync(output)) throw new Error(`Database already exists; nothing was overwritten: ${output}`);
  const source = JSON.parse(readFileSync(exportPath, 'utf8').replace(/^\uFEFF/, ''));
  if (source.schemaVersion !== schema.version) throw new Error('Export/schema version mismatch');
  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.building`;
  if (existsSync(temporary)) throw new Error(`Unfinished database exists: ${temporary}`);
  const database = new DatabaseSync(temporary);
  try {
    database.exec(catalogDdl());
    database.exec('BEGIN');
    for (const table of projectSchema.tables) {
      const rows = source.tables[table.technical];
      if (!Array.isArray(rows)) throw new Error(`Export is missing table: ${table.technical}`);
      const columns = table.fields.map((field) => field.technical);
      const insert = database.prepare(`INSERT INTO ${quote(table.technical)} (${columns.map(quote).join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
      for (const row of rows) {
        insert.run(...columns.map((column) => {
          if (!(column in row)) throw new Error(`Export is missing column: ${table.technical}.${column}`);
          const value = row[column];
          return typeof value === 'boolean' ? Number(value) : value;
        }));
      }
    }
    if (database.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Broken foreign keys');
    database.exec('COMMIT;');
    if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Database integrity check failed');
  } catch (error) {
    database.close();
    rmSync(temporary);
    throw error;
  }
  database.close();
  renameSync(temporary, output);
  return { database: output, tables: schema.tables.length, spells: source.tables.spells.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(resolve(root, 'database/spells/schema.sqlite.sql'), catalogDdl());
  const output = process.argv[2] ?? resolve(root, 'storage/spell-catalog.sqlite');
  console.log(JSON.stringify(createCatalog(output), null, 2));
}
