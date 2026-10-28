import type { ProficiencyChoice } from '@koster/shared';
import type { CatalogEntity } from '../build/catalog-entity.ts';

// Смешанный выбор владений (`proficiencyChoiceSchema`) — общий для рас, предысторий и черт.

/** «одним навыком или инструментом по вашему выбору» — выбор из любых навыков и инструментов. */
const SKILL_OR_TOOL =
  /(?:любой комбинацией из |одним )?(\S+)?\s*навык[а-яё]* или (?:одним )?инструмент[а-яё]*/;

/** Постоянный выбор «навык или инструмент»; «каждый раз после отдыха» — не постоянное владение. */
export function skillOrToolChoice(
  sentence: string,
  count: number | null,
): ProficiencyChoice | null {
  if (!SKILL_OR_TOOL.test(sentence) || !/выбор/.test(sentence)) return null;
  if (/отдых|транс|[Кк]аждый раз|[Вв]сякий раз/.test(sentence)) return null;
  return {
    count: count ?? 1,
    from: [
      { kind: 'skill', id: null },
      { kind: 'tool', id: null },
    ],
  };
}

/** Связи смешанного выбора: навык — `skill_proficiency`, инструмент — `tool_proficiency`. */
export function mixedLinks(choices: readonly ProficiencyChoice[]): CatalogEntity['links'] {
  return choices.flatMap((choice) =>
    choice.from.flatMap((option) => {
      if (option.kind === 'tool_group' || option.id === null) return [];
      const kind = option.kind === 'skill' ? 'skill_proficiency' : 'tool_proficiency';
      return [{ toId: option.id, kind } as const];
    }),
  );
}
