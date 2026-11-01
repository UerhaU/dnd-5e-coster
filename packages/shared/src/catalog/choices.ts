import { z } from 'zod';
import { entityIdSchema } from './entity.ts';

// Смешанный выбор владений: «один навык или инструмент на ваш выбор», «музыкальный
// инструмент или игровой набор». Общий вид для рас, предысторий и черт: `count` — сколько
// владений получает игрок, `from` — из чего, в любой комбинации.

/** Группы инструментов для выбора «один музыкальный инструмент» (коды категорий предметов). */
export const TOOL_GROUPS = ['artisans_tools', 'gaming_set', 'musical_instrument'] as const;

const amount = z.number().int().positive();

/** Вариант выбора: навык или инструмент (`id: null` — любой) либо группа инструментов. */
export const proficiencyOptionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('skill'), id: entityIdSchema.nullable() }),
  z.strictObject({ kind: z.literal('tool'), id: entityIdSchema.nullable() }),
  z.strictObject({ kind: z.literal('tool_group'), group: z.enum(TOOL_GROUPS) }),
]);

export const proficiencyChoiceSchema = z.strictObject({
  count: amount,
  from: z.array(proficiencyOptionSchema).min(2),
});

export type ProficiencyOption = z.infer<typeof proficiencyOptionSchema>;
export type ProficiencyChoice = z.infer<typeof proficiencyChoiceSchema>;
