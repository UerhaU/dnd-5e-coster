import Fastify, { type FastifyInstance } from 'fastify';
import { registerCors } from './cors';
import { registerHealthRoute } from './routes/health';

export interface ServerOptions {
  appVersion: string;
  sqliteVersion: string;
  /** Адреса окна программы, которым разрешено обращаться к серверу. */
  allowedOrigins: readonly string[];
}

/** Собирает сервер со всеми маршрутами, но не запускает его. */
export function createServer(options: ServerOptions): FastifyInstance {
  const server = Fastify({ logger: false });

  registerCors(server, options.allowedOrigins);
  registerHealthRoute(server, {
    appVersion: options.appVersion,
    sqliteVersion: options.sqliteVersion,
  });

  return server;
}
