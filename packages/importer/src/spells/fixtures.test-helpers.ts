import { openSpellCache } from '../dndsu/spell-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import { SpellNormalizer, type NormalizedSpell } from './normalize-spell.ts';
import { parseSpellPage, type RawSpellPage } from './parse-page.ts';

// Тестовые страницы data/fixtures/dndsu/spells: разбор и нормализация по номеру на DnD.su.

export const fixtures = openSpellCache(DEFAULT_PATHS.spellFixtures);
const normalizer = new SpellNormalizer(fixtures.list);

export function fixturePage(siteId: number): RawSpellPage {
  const html = fixtures.readPage(siteId);
  if (html === null) {
    throw new Error(`Нет тестовой страницы ${siteId}`);
  }
  return parseSpellPage(html);
}

export function fixtureSpell(siteId: number): { spell: NormalizedSpell; issues: ImportIssue[] } {
  const card = fixtures.list.cards.find((item) => item.siteId === siteId);
  if (!card) {
    throw new Error(`Нет карточки ${siteId} в тестовом index.json`);
  }
  const issues: ImportIssue[] = [];
  const spell = normalizer.normalize(fixturePage(siteId), card, issues);
  if (!spell) {
    throw new Error(`Заклинание ${siteId} не нормализовалось: ${JSON.stringify(issues)}`);
  }
  return { spell, issues };
}
