import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import {
  backgroundLookup,
  collectBackgrounds,
  loadEquipmentPhrases,
} from './collect-backgrounds.ts';
import { collectReference, loadReferenceNames } from './collect-reference.ts';
import { parseTools } from './normalize-background.ts';

const folder = DEFAULT_PATHS.characterFixtures;
const names = loadReferenceNames(DEFAULT_PATHS.reviewedCharacter);

function collect() {
  const issues: ImportIssue[] = [];
  const reference = collectReference(
    openArticleCache(path.join(folder, 'reference')),
    names,
    issues,
    {
      knownSources: [],
    },
  );
  const result = collectBackgrounds(
    openArticleCache(path.join(folder, 'backgrounds')),
    backgroundLookup(reference.entities, loadEquipmentPhrases(DEFAULT_PATHS.reviewedCharacter)),
    names.backgrounds,
    issues,
    { knownSources: [] },
  );
  const get = (id: string) => {
    const entity = result.entities.find((candidate) => candidate.id === id);
    if (!entity) throw new Error(`нет ${id}`);
    return entity;
  };
  return { ...result, issues, get };
}

describe('предыстории', () => {
  it('без ошибок; адаптация — отдельный вид, название из names.json', () => {
    const { issues, stats, get } = collect();
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(stats).toMatchObject({ pages: 5, backgrounds: 4, adaptations: 1 });
    expect(get('background:ravenloft-background-adaptations').data.kind).toBe('adaptation');
  });

  it('артист: навыки и инструменты — ID, группа «музыкальный инструмент», разновидность', () => {
    const entertainer = collect().get('background:entertainer');
    expect(entertainer.rules.skills.fixed).toEqual(['skill:acrobatics', 'skill:performance']);
    expect(entertainer.rules.tools).toEqual({
      fixed: ['item:disguise-kit'],
      choices: [{ count: 1, from: null, group: 'musical_instrument' }],
    });
    expect(entertainer.data.feature?.name).toBe('По многочисленным просьбам');
    expect(entertainer.data.variants.map((variant) => variant.name)).toEqual(['Гладиатор']);
    expect(entertainer.data.personality.traits?.die).toBe('к8');
    expect(entertainer.links).toContainEqual({
      toId: 'skill:acrobatics',
      kind: 'skill_proficiency',
    });
  });

  it('народный герой: транспорт — вид; следователь: «Выберите два навыка»', () => {
    const { get } = collect();
    expect(get('background:folk-hero').rules.vehicles).toEqual(['land']);
    expect(get('background:investigator').rules.skills).toEqual({
      fixed: [],
      choices: [{ count: 2, from: expect.arrayContaining(['skill:perception']) as unknown }],
    });
  });

  it('утгардт: строки владений внутри раздела', () => {
    const uthgardt = collect().get('background:uthgardt-tribe-member');
    expect(uthgardt.rules.skills.fixed).toEqual(['skill:athletics', 'skill:survival']);
    expect(uthgardt.rules.languages.choices).toEqual([{ count: 1, from: null }]);
    // «Музыкальные инструменты или инструменты ремесленника одного типа» — смешанный выбор.
    expect(uthgardt.rules.mixed).toEqual([
      {
        count: 1,
        from: [
          { kind: 'tool_group', group: 'artisans_tools' },
          { kind: 'tool_group', group: 'musical_instrument' },
        ],
      },
    ]);
  });
});

describe('владение инструментами', () => {
  it('число — вне скобок: «один игровой набор (… ставка трёх драконов)» — один (Награждённый)', () => {
    const rules = { tools: { fixed: [], choices: [] }, mixed: [], vehicles: [] };
    parseTools(
      {
        label: 'Владение инструментами',
        text: 'один игровой набор на ваш выбор (например, игральные карты или ставка трёх драконов)',
        tooltips: [],
        links: [],
      },
      rules as unknown as Parameters<typeof parseTools>[1],
    );
    expect(rules.tools.choices).toEqual([{ count: 1, from: null, group: 'gaming_set' }]);
  });
});
