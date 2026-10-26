import type { HealthResponse } from '@koster/shared';
import type { FastifyInstance } from 'fastify';

export interface HealthInfo {
  appVersion: string;
  sqliteVersion: string;
}

export function registerHealthRoute(server: FastifyInstance, info: HealthInfo): void {
  server.get('/api/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      appVersion: info.appVersion,
      sqliteVersion: info.sqliteVersion,
    };
  });
}
