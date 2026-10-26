import { healthResponseSchema } from '@koster/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ServerOptions } from './app';
import { listenLocal } from './listen';

const options: ServerOptions = {
  appVersion: '2.0.0-alpha.0',
  sqliteVersion: '3.50.0',
  allowedOrigins: ['app://koster'],
};

describe('GET /api/health', () => {
  let server = createServer(options);
  beforeEach(() => {
    server = createServer(options);
  });
  afterEach(async () => {
    await server.close();
  });

  it('возвращает статус, версию программы и версию SQLite', async () => {
    const response = await server.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
      appVersion: '2.0.0-alpha.0',
      sqliteVersion: '3.50.0',
    });
  });

  it('разрешает чтение окну программы', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'app://koster' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('app://koster');
  });

  it('не разрешает чтение чужим страницам', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://example.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('listenLocal', () => {
  it('слушает только 127.0.0.1', async () => {
    const server = createServer(options);
    try {
      const url = await listenLocal(server);
      const address = server.server.address();

      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(typeof address === 'object' && address?.address).toBe('127.0.0.1');
    } finally {
      await server.close();
    }
  });
});
