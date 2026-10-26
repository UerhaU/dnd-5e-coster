import { describe, expect, it } from 'vitest';
import { buildCsp } from './csp';

describe('buildCsp', () => {
  it('в собранной программе запрещает встроенные скрипты', () => {
    const csp = buildCsp('production');

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('разрешает обращения только к своему серверу на 127.0.0.1', () => {
    expect(buildCsp('production')).toContain("connect-src 'self' http://127.0.0.1:*");
  });

  it('запрещает плагины и подмену базового адреса', () => {
    const csp = buildCsp('production');

    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });
});
