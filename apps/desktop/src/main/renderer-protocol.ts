import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';

/**
 * Собранный интерфейс открывается по адресу `app://koster/`, а не `file://`:
 * у окна свой постоянный адрес, и сервер разрешает чтение только ему.
 */
export const APP_SCHEME = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://koster`;

/** Вызывать до `app.whenReady()`. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Отдаёт файлы только из папки собранного интерфейса. */
export function serveRenderer(rendererDir: string): void {
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = path.resolve(rendererDir, `.${relative}`);

    if (path.relative(rendererDir, file).startsWith('..')) {
      return new Response('Не найдено', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}
