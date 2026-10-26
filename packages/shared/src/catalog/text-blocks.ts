import { z } from 'zod';

// Текст описания хранится блоками простого текста, без HTML (раздел 4.5):
// интерфейс сам решает, как показать абзац, список или таблицу.

const text = z.string().min(1);

export const textBlockSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paragraph'), text }),
  z.strictObject({ type: z.literal('heading'), text }),
  z.strictObject({ type: z.literal('list'), ordered: z.boolean(), items: z.array(text).min(1) }),
  z.strictObject({
    type: z.literal('table'),
    caption: text.nullable(),
    header: z.array(z.string()).nullable(),
    rows: z.array(z.array(z.string())).min(1),
  }),
  z.strictObject({ type: z.literal('quote'), text, attribution: text.nullable() }),
]);

export type TextBlock = z.infer<typeof textBlockSchema>;

/** Плоский текст блоков: для поиска и сверки. */
export function textBlocksToPlain(blocks: readonly TextBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
        case 'heading':
          return block.text;
        case 'list':
          return block.items.join('\n');
        case 'table':
          return [block.caption, block.header?.join(' | '), ...block.rows.map((r) => r.join(' | '))]
            .filter((line) => line)
            .join('\n');
        case 'quote':
          return block.attribution ? `${block.text}\n${block.attribution}` : block.text;
      }
    })
    .join('\n\n');
}
