import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { materialLeaves } from '@koster/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import { fixtureSpell } from '../spells/fixtures.test-helpers.ts';
import { applyReviewed, loadReviewedSpells } from './reviewed-spells.ts';

describe('data/reviewed/spells', () => {
  const reviewed = loadReviewedSpells(DEFAULT_PATHS.reviewedSpells);
  const all = [...reviewed.byId.values()];

  it('все файлы проходят схему', () => {
    expect(reviewed.invalid).toEqual([]);
  });

  it('перенесено из v0.1: 47 проверенных правил, 280 составов материалов, 25 записей о целях', () => {
    expect(all.filter((spell) => spell.rules)).toHaveLength(47);
    expect(all.filter((spell) => spell.materials)).toHaveLength(280);
    expect(all.filter((spell) => spell.targets)).toHaveLength(25);
  });

  it('в составах 461 требование к материалам, как в v0.1', () => {
    const leaves = all.flatMap((spell) => (spell.materials ? materialLeaves(spell.materials) : []));
    expect(leaves).toHaveLength(461);
  });

  it('накладываются на заклинание: состав, цели и правила', () => {
    const { spell } = fixtureSpell(2);
    const issues: ImportIssue[] = [];

    const { rules } = applyReviewed(spell, reviewed.byId.get('spell:antipathy-sympathy'), issues);

    expect(issues).toEqual([]);
    expect(rules).toBeNull();
    expect(spell.data.components.material?.recipe).toMatchObject({ kind: 'any' });
  });

  it('состав материалов у заклинания без материального компонента — предупреждение', () => {
    const { spell } = fixtureSpell(2341);
    const issues: ImportIssue[] = [];

    applyReviewed(
      spell,
      {
        id: spell.id,
        dndsuId: spell.dndsuId,
        nameRu: spell.nameRu,
        materials: {
          kind: 'item',
          name: 'Монета',
          quantity: 1,
          unit: 'piece',
          consumption: 'consumed',
        },
        provenance: ['тест'],
      },
      issues,
    );

    expect(issues).toEqual([expect.objectContaining({ field: 'reviewed.materials' })]);
    expect(spell.data.components.material).toBeNull();
  });

  it('файл с ошибкой схемы или чужим именем не загружается', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'koster-reviewed-'));
    fs.writeFileSync(path.join(folder, 'bad.json'), '{"id":"spell:bad"}');
    fs.writeFileSync(
      path.join(folder, 'other.json'),
      JSON.stringify({
        id: 'spell:fireball',
        dndsuId: 205,
        nameRu: 'Огненный шар',
        provenance: ['тест'],
      }),
    );

    const result = loadReviewedSpells(folder);

    expect(result.byId.size).toBe(0);
    expect(result.invalid.map((item) => item.file)).toEqual(['bad.json', 'other.json']);
    fs.rmSync(folder, { recursive: true, force: true });
  });
});
