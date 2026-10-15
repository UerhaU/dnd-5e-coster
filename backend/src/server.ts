import { buildServer } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const server = await buildServer();

async function shutdown(signal: string) {
  server.log.info({ signal }, 'Stopping backend server');
  await server.close();
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await server.listen({ port, host });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
