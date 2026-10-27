import type { NormalizedSource } from '../spells/normalize-spell.ts';
import type { RawSourceMark } from './parse-article.ts';

// Источники снаряжения. Статья DnD.su называет книгу полностью («Источник:
// «Player's Handbook»»), а отдельные строки — меткой «(RLW)». Коды — как на
// плашках DnD.su (`PH14`, `DMG14`, `OTA`), чтобы источник был одной строкой
// таблицы `sources` для всех категорий (Р12).

/** Книги, которые статьи называют без метки. */
const BOOKS_BY_TITLE: Record<string, string> = {
  "Player's Handbook": 'PH14',
  "Dungeon Master's Guide": 'DMG14',
};

/** В тексте статей метки иногда отличаются от плашек сайта. */
const CODE_ALIASES: Record<string, string> = { OOTA: 'OTA' };

export class ItemSources {
  /** Уже известные источники (из заклинаний той же сборки): с номерами фильтра DnD.su. */
  private readonly known: Map<string, NormalizedSource>;

  constructor(known: Iterable<NormalizedSource>) {
    this.known = new Map([...known].map((source) => [source.code, source]));
  }

  /** Источник статьи по названию книги; `null` — книга не известна. */
  fromTitle(title: string): NormalizedSource | null {
    const code = BOOKS_BY_TITLE[title];
    return code ? this.make(code, title) : null;
  }

  fromMark(mark: RawSourceMark): NormalizedSource {
    const upper = mark.code.toUpperCase();
    return this.make(CODE_ALIASES[upper] ?? upper, mark.title ?? upper);
  }

  private make(code: string, title: string): NormalizedSource {
    return (
      this.known.get(code) ?? {
        id: code.toLowerCase(),
        code,
        nameEn: title,
        dndsuSourceId: null,
        edition: /24$/.test(code) ? '5e_2024' : '5e_2014',
      }
    );
  }
}
