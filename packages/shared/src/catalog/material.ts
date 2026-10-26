import { z } from 'zod';

// Состав материального компонента — дерево «всё вместе» / «один из».
// Данные перенесены из v0.1 (scripts/spell-materials.mjs). Ссылок на предметы
// каталога пока нет: предметы появятся на этапе 2, тогда к листьям добавятся itemId.

export const MATERIAL_UNITS = [
  'piece',
  'drop',
  'handful',
  'pinch',
  'portion',
  'cubic_inch',
  'cup',
  'foot',
] as const;

const copper = z.number().positive();

export const materialItemSchema = z.strictObject({
  kind: z.literal('item'),
  /** Название по-русски, как в составе на DnD.su. */
  name: z.string().min(1),
  /** `null` — количество не указано. */
  quantity: z.number().positive().nullable(),
  unit: z.enum(MATERIAL_UNITS).nullable(),
  /** Количество считается на каждую цель или на каждый глаз. */
  quantityBasis: z.enum(['per_target', 'per_eye']).optional(),
  consumption: z.enum(['consumed', 'not_consumed', 'conditional']),
  consumptionCondition: z.string().min(1).optional(),
  /** Минимальная стоимость одного экземпляра, в медных монетах. */
  minimumValueCp: copper.optional(),
  /** Минимальная стоимость всего набора, в медных монетах. */
  minimumGroupValueCp: copper.optional(),
  /** Стоимость считается за кость хитов цели. */
  priceBasis: z.literal('target_hit_die').optional(),
  /** Подходит любой предмет этого вида (например, любое рукопашное оружие). */
  selector: z.enum(['melee_weapon', 'dagger']).optional(),
  special: z.string().min(1).optional(),
});

export const materialPrerequisiteSchema = z.strictObject({
  kind: z.literal('prerequisite'),
  code: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
});

export type MaterialItem = z.infer<typeof materialItemSchema>;
export type MaterialPrerequisite = z.infer<typeof materialPrerequisiteSchema>;
export interface MaterialGroup {
  kind: 'all' | 'any';
  children: MaterialNode[];
  minimumGroupValueCp?: number | undefined;
}
export type MaterialNode = MaterialItem | MaterialPrerequisite | MaterialGroup;

export const materialNodeSchema: z.ZodType<MaterialNode> = z.lazy(() =>
  z.union([
    materialItemSchema,
    materialPrerequisiteSchema,
    z.strictObject({
      kind: z.enum(['all', 'any']),
      children: z.array(materialNodeSchema).min(2),
      minimumGroupValueCp: copper.optional(),
    }),
  ]),
);

export function materialLeaves(node: MaterialNode): MaterialItem[] {
  switch (node.kind) {
    case 'item':
      return [node];
    case 'prerequisite':
      return [];
    default:
      return node.children.flatMap(materialLeaves);
  }
}
