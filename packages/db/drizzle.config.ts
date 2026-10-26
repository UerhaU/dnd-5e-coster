import { defineConfig } from 'drizzle-kit';

// Миграции схемы catalog.db. Сборка каталога применяет их к новому файлу.
// Новая миграция: `npm run db:generate -w @koster/db`.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/catalog/schema.ts',
  out: './drizzle/catalog',
});
