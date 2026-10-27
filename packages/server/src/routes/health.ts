import { readCatalogInfo, type CatalogConnection } from '@koster/db';
import type { HealthResponse } from '@koster/shared';
import type { FastifyInstance } from 'fastify';

export interface HealthInfo {
  appVersion: string;
  sqliteVersion: string;
  catalog: CatalogConnection | null;
}

function catalogVersion(catalog: CatalogConnection | null): HealthResponse['catalog'] {
  if (!catalog) {
    return null;
  }
  const info = readCatalogInfo(catalog);
  return {
    version: Number(info['catalog_version']),
    contentHash: info['content_hash'] ?? '',
    builtAt: info['built_at'] ?? '',
    sourceKind: info['source_kind'] ?? 'full',
  };
}

export function registerHealthRoute(server: FastifyInstance, info: HealthInfo): void {
  // Каталог не меняется, пока программа работает (Р21): версию достаточно прочитать раз.
  const catalog = catalogVersion(info.catalog);

  server.get('/api/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      appVersion: info.appVersion,
      sqliteVersion: info.sqliteVersion,
      catalog,
    };
  });
}
