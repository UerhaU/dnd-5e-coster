import type { FastifyInstance } from 'fastify';

/**
 * Разрешает чтение ответов только окну самой программы.
 * Остальные источники (например, страницы в браузере) ответ не прочитают.
 */
export function registerCors(server: FastifyInstance, allowedOrigins: readonly string[]): void {
  server.addHook('onSend', async (request, reply) => {
    const origin = request.headers.origin;

    if (origin !== undefined && allowedOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
    }
    reply.header('Vary', 'Origin');
  });
}
