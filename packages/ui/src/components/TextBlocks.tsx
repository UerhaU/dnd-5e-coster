import type { TextBlock } from '@koster/shared';

/**
 * Описание из DnD.su — только как текст (раздел 4.5): блоки рисуются обычными
 * элементами React, чужой HTML не вставляется.
 */
export function TextBlocks({ blocks }: { blocks: readonly TextBlock[] }) {
  return (
    <div className="text-blocks">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: TextBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p>{block.text}</p>;
    case 'heading':
      return <h3>{block.text}</h3>;
    case 'list': {
      const items = block.items.map((item, index) => <li key={index}>{item}</li>);
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case 'table':
      return (
        <table>
          {block.caption && <caption>{block.caption}</caption>}
          {block.header && (
            <thead>
              <tr>
                {block.header.map((cell, index) => (
                  <th key={index}>{cell}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, index) => (
                  <td key={index}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'quote':
      return (
        <blockquote>
          <p>{block.text}</p>
          {block.attribution && <footer>{block.attribution}</footer>}
        </blockquote>
      );
  }
}
