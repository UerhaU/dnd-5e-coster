import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Журнал ревизий в git (Р51): по одной строке на ревизию, без текстов DnD.su.
// Если catalog.db потерян, сборка берёт из журнала номера ревизий, их ID и даты,
// и ссылки персонажей на каталог (Р21) остаются действительными.
//
//   data/catalog-ledger/catalog.json   версия каталога, хеш, дата сборки
//   data/catalog-ledger/spell.jsonl    ревизии заклинаний, по порядку ID

export const ledgerRevisionSchema = z.strictObject({
  /** `content_revisions.id` — на него ссылается `current_revision_id`. */
  revisionId: z.number().int().positive(),
  entityId: z.string().min(1),
  revision: z.number().int().positive(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  schemaVersion: z.string().min(1),
  importerVersion: z.string().min(1),
  createdAt: z.string().min(1),
});

export const ledgerInfoSchema = z.strictObject({
  catalogVersion: z.number().int().positive(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  builtAt: z.string().min(1),
});

export type LedgerRevision = z.infer<typeof ledgerRevisionSchema>;
export type LedgerInfo = z.infer<typeof ledgerInfoSchema>;

export interface Ledger {
  info: LedgerInfo | null;
  revisions: LedgerRevision[];
}

const INFO_FILE = 'catalog.json';

function categoryOf(entityId: string): string {
  return entityId.slice(0, entityId.indexOf(':'));
}

/** Читает журнал; пустая или отсутствующая папка — пустой журнал. */
export function readLedger(folder: string): Ledger {
  if (!fs.existsSync(folder)) {
    return { info: null, revisions: [] };
  }
  const infoFile = path.join(folder, INFO_FILE);
  const info = fs.existsSync(infoFile)
    ? ledgerInfoSchema.parse(JSON.parse(fs.readFileSync(infoFile, 'utf8')))
    : null;

  const revisions: LedgerRevision[] = [];
  for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.jsonl'))) {
    const lines = fs.readFileSync(path.join(folder, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!line.trim()) {
        return;
      }
      const parsed = ledgerRevisionSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`${file}, строка ${index + 1}: ${parsed.error.message}`);
      }
      revisions.push(parsed.data);
    });
  }
  revisions.sort((a, b) => a.revisionId - b.revisionId);
  return { info, revisions };
}

/** Перезаписывает журнал целиком: строки по порядку ID, по файлу на категорию. */
export function writeLedger(folder: string, ledger: Ledger): void {
  fs.mkdirSync(folder, { recursive: true });
  const byCategory = new Map<string, LedgerRevision[]>();
  for (const revision of [...ledger.revisions].sort((a, b) => a.revisionId - b.revisionId)) {
    const category = categoryOf(revision.entityId);
    byCategory.set(category, [...(byCategory.get(category) ?? []), revision]);
  }
  for (const [category, revisions] of byCategory) {
    // Ключи в постоянном порядке схемы: строки журнала не «прыгают» в git diff.
    const lines = revisions.map((revision) => JSON.stringify(ledgerRevisionSchema.parse(revision)));
    fs.writeFileSync(path.join(folder, `${category}.jsonl`), `${lines.join('\n')}\n`);
  }
  if (ledger.info) {
    fs.writeFileSync(
      path.join(folder, INFO_FILE),
      `${JSON.stringify(ledgerInfoSchema.parse(ledger.info), null, 2)}\n`,
    );
  }
}
