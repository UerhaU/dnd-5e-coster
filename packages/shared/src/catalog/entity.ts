import { z } from 'zod';

// Общие поля объекта каталога (раздел 5.1, 5.4).

export const CATEGORIES = ['spell'] as const;
export const categorySchema = z.enum(CATEGORIES);

/** Статусы проверки: raw → parsed → reviewed → rules_verified. */
export const reviewStatusSchema = z.enum(['raw', 'parsed', 'reviewed', 'rules_verified']);
export const automationSchema = z.enum(['full', 'assisted', 'display_only']);
/** Р12: 5e 2014 и общие для 2014 и 2024; неизвестная редакция ждёт решения. */
export const editionSchema = z.enum(['5e_2014', 'unknown']);

/** ID объекта по Р11: `spell:fireball`. */
export const entityIdSchema = z.string().regex(/^[a-z]+:[a-z0-9]+(-[a-z0-9]+)*$/);

export type Category = z.infer<typeof categorySchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type Automation = z.infer<typeof automationSchema>;
export type Edition = z.infer<typeof editionSchema>;

/**
 * Часть ID из английского названия: «Tasha's Hideous Laughter» → `tashas-hideous-laughter`.
 * Апострофы выбрасываются, остальное, кроме букв и цифр, становится дефисом.
 */
export function slugFromName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
