/**
 * Content-Security-Policy окна. Окно грузит только свои скрипты
 * и обращается только к встроенному серверу на 127.0.0.1.
 *
 * В режиме разработки Vite нужны встроенный скрипт горячей перезагрузки
 * и WebSocket к dev-серверу; в собранной программе этого нет.
 */
export function buildCsp(mode: 'production' | 'development'): string {
  const dev = mode === 'development';

  const directives = [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    dev
      ? "connect-src 'self' http://127.0.0.1:* ws://localhost:*"
      : "connect-src 'self' http://127.0.0.1:*",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ];

  return directives.join('; ');
}
