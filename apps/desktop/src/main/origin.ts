/**
 * Источник адреса: `протокол://хост[:порт]`.
 * `new URL(url).origin` в Node для `app://koster/…` возвращает `"null"`,
 * потому что Node не знает, что схема `app` зарегистрирована как стандартная.
 */
export function originOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}
