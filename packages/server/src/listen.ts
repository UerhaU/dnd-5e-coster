import type { FastifyInstance } from 'fastify';

/**
 * Сервер слушает только этот компьютер (Р19).
 * Открытие наружу появится на этапе 7 вместе с защитой.
 */
export const LOCAL_HOST = '127.0.0.1';

/** Запускает сервер на свободном порту и возвращает его адрес. */
export async function listenLocal(server: FastifyInstance): Promise<string> {
  await server.listen({ host: LOCAL_HOST, port: 0 });

  const address = server.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Сервер запустился, но не сообщил порт');
  }

  return `http://${LOCAL_HOST}:${address.port}`;
}
