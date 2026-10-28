import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openArticleCache } from '../dndsu/article-cache.ts';
import { DEFAULT_PATHS } from '../paths.ts';
import type { ImportIssue } from '../report/issues.ts';
import { collectReference, loadReferenceNames } from './collect-reference.ts';
import {
  parseConditionsArticle,
  parseLanguagesArticle,
  parseSkillsArticle,
} from './parse-reference.ts';

const cache = openArticleCache(path.join(DEFAULT_PATHS.characterFixtures, 'reference'));
const page = (id: number) => {
  const html = cache.readPage(id);
  if (html === null) throw new Error(`нет тестовой страницы ${id}`);
  return html;
};

describe('навыки, языки, состояния (статьи-справочники)', () => {
  it('навыки: 18, характеристика из строки-заголовка таблицы, описание из термина', () => {
    const skills = parseSkillsArticle(page(468));
    expect(skills).toHaveLength(18);
    const by = (code: string) => skills.find((skill) => skill.code === code);
    expect(by('athletics')?.abilityRu).toBe('Сила');
    expect(by('sleight_of_hand')).toMatchObject({ nameRu: 'Ловкость рук', abilityRu: 'Ловкость' });
    expect(by('animal_handling')?.abilityRu).toBe('Мудрость');
    expect(by('persuasion')?.abilityRu).toBe('Харизма');
    // «<em><strong>Медицина.</strong></em>» и раздел «СКРЫТНОСТЬ» вместо термина.
    expect(by('medicine')?.description[0]).toMatchObject({ type: 'paragraph' });
    expect(by('stealth')?.description.length).toBeGreaterThan(0);
  });

  it('языки: таблицы по книгам и диалекты Первичного', () => {
    const { languages, dialects } = parseLanguagesArticle(page(209));
    const giant = languages.filter((language) => language.nameRu === 'Великаний');
    expect(giant.map((language) => language.script)).toEqual(['Дварфская', 'Минотавров']);
    expect(languages.find((language) => language.nameRu === 'Глубинная Речь')).toMatchObject({
      table: 'ЭКЗОТИЧЕСКИЕ ЯЗЫКИ',
      script: null,
    });
    expect(dialects.map((dialect) => dialect.nameRu)).toEqual([
      'Акван',
      'Ауран',
      'Игнан',
      'Терран',
    ]);
    expect(dialects[0]?.parentRu).toBe('Первичный');
  });

  it('состояния: 15 разделов, истощение с таблицей степеней', () => {
    const conditions = parseConditionsArticle(page(27));
    expect(conditions).toHaveLength(15);
    const exhaustion = conditions.find((condition) => condition.nameRu === 'Истощённый');
    expect(exhaustion?.description.some((block) => block.type === 'table')).toBe(true);
  });

  it('сборка: ID по английскому названию, повтор языка — письменность другой книги', () => {
    const issues: ImportIssue[] = [];
    const { entities, stats } = collectReference(
      cache,
      loadReferenceNames(DEFAULT_PATHS.reviewedCharacter),
      issues,
      { knownSources: [] },
    );
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(stats).toEqual({ skills: 18, languages: 65, conditions: 15 });
    const get = (id: string) => entities.find((entity) => entity.id === id);
    expect(get('skill:animal-handling')?.nameEn).toBe('Animal Handling');
    const giant = get('language:giant');
    expect(giant?.category === 'language' && giant.data.scripts).toEqual([
      { script: 'Дварфская', source: 'PH14' },
      { script: 'Минотавров', source: 'GGR' },
    ]);
    expect(get('language:aquan')?.links).toEqual([
      { toId: 'language:primordial', kind: 'dialect_of' },
    ]);
    expect(get('condition:prone')).toMatchObject({
      nameRu: 'Сбитый с ног',
      aliases: ['Лежащий ничком'],
    });
  });
});
