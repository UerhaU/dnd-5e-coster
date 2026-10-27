import { z } from 'zod';
import { entityIdSchema } from './entity.ts';
import { textBlockSchema } from './text-blocks.ts';

// Данные расы или разновидности (`content_revisions.data_json`, схема race/v1).
// Механика — в rules_json (race-rules/v1). Тексты особенностей — как на DnD.su.

export const RACE_SCHEMA_VERSION = 'race/v1';

export const raceFeatureSchema = z.strictObject({
  /** «Тёмное зрение», «Наследие фей». */
  name: z.string().min(1),
  blocks: z.array(textBlockSchema),
});

export const raceDataSchema = z.strictObject({
  schemaVersion: z.literal(RACE_SCHEMA_VERSION),
  /** `variant` — разновидность (холмовой дварф): её особенности добавляются к особенностям расы. */
  kind: z.enum(['race', 'variant']),
  /** Раса разновидности; у расы `null`. Та же связь — `variant_of` в content_links. */
  variantOf: entityIdSchema.nullable(),
  /** Вступление: описание расы в начале страницы или абзацы раздела разновидности. */
  intro: z.array(textBlockSchema),
  /**
   * Особенности. У разновидности — только свои: общее с расой хранится у расы (без
   * дублей). Особенность с тем же названием, что у расы, заменяет её («Скорость»).
   */
  features: z.array(raceFeatureSchema),
});

export type RaceData = z.infer<typeof raceDataSchema>;
export type RaceFeature = z.infer<typeof raceFeatureSchema>;
