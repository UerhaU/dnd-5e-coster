import { describe, expect, it } from 'vitest';
import { originOf } from './origin';

describe('originOf', () => {
  it('понимает адрес собранного окна app://koster', () => {
    expect(originOf('app://koster/index.html')).toBe('app://koster');
  });

  it('понимает адрес dev-сервера с портом', () => {
    expect(originOf('http://localhost:5173/')).toBe('http://localhost:5173');
  });

  it('отличает чужой адрес', () => {
    expect(originOf('https://example.com/app://koster')).not.toBe('app://koster');
  });
});
