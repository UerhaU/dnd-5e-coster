import { describe, expect, it } from 'vitest';
import { IMPORT_SOURCE } from './index';

describe('@koster/importer', () => {
  it('берёт данные с DnD.su по https', () => {
    expect(new URL(IMPORT_SOURCE).protocol).toBe('https:');
  });
});
