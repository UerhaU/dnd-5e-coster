import fs from 'node:fs';
import path from 'node:path';
import {
  entityIdSchema,
  materialLeaves,
  materialNodeSchema,
  spellComponentsSchema,
  spellRulesSchema,
  type SpellRules,
} from '@koster/shared';
import { z } from 'zod';
import type { ImportIssue } from '../report/issues.ts';
import type { NormalizedSpell } from '../spells/normalize-spell.ts';

// Шаг review (раздел 6): ручные исправления из data/reviewed/spells/*.json.
// Один файл — одно заклинание; имя файла — ID без `spell:`.

export const reviewedSpellSchema = z.strictObject({
  id: entityIdSchema,
  /** Для человека и для сверки: номер на DnD.su и русское название. */
  dndsuId: z.number().int().positive(),
  nameRu: z.string().min(1),
  /** Проверенная механика → rules_json, review_status: rules_verified. */
  rules: spellRulesSchema.optional(),
  /** Состав материального компонента → data_json.components.material.recipe. */
  materials: materialNodeSchema.optional(),
  /** Число целей → data_json.targets. */
  targets: z
    .strictObject({
      maxCount: z.number().int().positive(),
      extraPerSlot: z.number().int().min(0),
    })
    .optional(),
  /** Исправление ошибки на странице DnD.su: заменяет разобранное поле целиком. */
  fixes: z
    .strictObject({
      components: spellComponentsSchema.optional(),
      reason: z.string().min(1),
    })
    .optional(),
  /** Откуда взяты данные. */
  provenance: z.array(z.string().min(1)).min(1),
});

export type ReviewedSpell = z.infer<typeof reviewedSpellSchema>;

export interface ReviewedSpellSet {
  byId: Map<string, ReviewedSpell>;
  /** Файлы, которые не прошли проверку схемы. */
  invalid: { file: string; message: string }[];
}

export function loadReviewedSpells(folder: string): ReviewedSpellSet {
  const byId = new Map<string, ReviewedSpell>();
  const invalid: ReviewedSpellSet['invalid'] = [];
  if (!fs.existsSync(folder)) {
    return { byId, invalid };
  }

  for (const name of fs
    .readdirSync(folder)
    .filter((file) => file.endsWith('.json'))
    .sort()) {
    const file = path.join(folder, name);
    let parsed: z.ZodSafeParseResult<ReviewedSpell>;
    try {
      parsed = reviewedSpellSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (error) {
      invalid.push({ file: name, message: String(error) });
      continue;
    }
    if (!parsed.success) {
      invalid.push({ file: name, message: z.prettifyError(parsed.error) });
      continue;
    }
    if (`spell:${name.replace(/\.json$/, '')}` !== parsed.data.id) {
      invalid.push({ file: name, message: `Имя файла не совпадает с ID ${parsed.data.id}` });
      continue;
    }
    byId.set(parsed.data.id, parsed.data);
  }
  return { byId, invalid };
}

export interface ReviewedResult {
  rules: SpellRules | null;
}

/**
 * Накладывает исправления на нормализованное заклинание (меняет `spell.data`).
 * Несовпадение с данными страницы — ошибка в отчёте, а не молчаливая замена.
 */
export function applyReviewed(
  spell: NormalizedSpell,
  reviewed: ReviewedSpell | undefined,
  issues: ImportIssue[],
): ReviewedResult {
  if (!reviewed) {
    return { rules: null };
  }
  const issue = (field: string, message: string) =>
    issues.push({
      severity: 'warning',
      entityId: spell.id,
      dndsuId: spell.dndsuId,
      field,
      message,
    });

  if (reviewed.dndsuId !== spell.dndsuId) {
    issue('reviewed', `В исправлении номер ${reviewed.dndsuId}, на DnD.su ${spell.dndsuId}`);
  }
  if (reviewed.fixes?.components) {
    spell.data.components = structuredClone(reviewed.fixes.components);
  }
  if (reviewed.materials) {
    const material = spell.data.components.material;
    if (!material) {
      issue(
        'reviewed.materials',
        'Состав материалов есть, а материального компонента на странице нет',
      );
    } else if (materialLeaves(reviewed.materials).length === 0) {
      issue('reviewed.materials', 'В составе материалов нет ни одного предмета');
    } else {
      material.recipe = reviewed.materials;
    }
  }
  if (reviewed.targets) {
    spell.data.targets = reviewed.targets;
  }
  return { rules: reviewed.rules ?? null };
}
