import Database from 'better-sqlite3';

/**
 * Открывает базу в памяти и читает версию SQLite.
 * На этапе 0 это проверка, что нативный модуль работает в собранной программе.
 */
export function readSqliteVersion(): string {
  const db = new Database(':memory:');
  try {
    const row = db.prepare('SELECT sqlite_version() AS version').get() as { version: string };
    return row.version;
  } finally {
    db.close();
  }
}
