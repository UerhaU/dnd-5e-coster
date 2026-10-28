import type { NormalizedSource } from '../spells/normalize-spell.ts';
import type { RawSourceMark } from './parse-article.ts';

// Источники снаряжения и рас. Статья DnD.su называет книгу полностью («Источник:
// «Player's Handbook»»), а отдельные строки — меткой «(RLW)». Коды — как на
// плашках DnD.su (`PH14`, `DMG14`, `OTA`), чтобы источник был одной строкой
// таблицы `sources` для всех категорий (Р12).

/** Книги, которые страницы называют полностью: «Источник: Mordenkainen’s Tome of Foes». */
const BOOKS: [code: string, title: string][] = [
  ['PH14', "Player's Handbook"],
  ['DMG14', "Dungeon Master's Guide"],
  ['VGM', "Volo's Guide to Monsters"],
  ['MTF', "Mordenkainen's Tome of Foes"],
  ['MPMM', 'Mordenkainen Presents: Monsters of the Multiverse'],
  ['SAS', 'Spelljammer: Adventures in Space'],
  ['RLW', 'Eberron: Rising from the Last War'],
  ['GGR', "Guildmasters' Guide to Ravnica"],
  ['AI', 'Acquisition Incorporated'],
  ['POA', 'Princes of the Apocalypse'],
  ['POA', 'Принцы Апокалипсиса'],
  ['OGA', 'One Grung Above'],
  ['EGW', "Explorer's Guide to Wildemount"],
  ['FTD', "Fizban's Treasury of Dragons"],
  ['WBW', 'The Wild Beyond The Witchlight: A Feywild Adventure'],
  ['SDQ', 'Dragonlance: Shadow of the Dragon Queen'],
  ['MOT', 'Mythic Odysseys of Theros'],
  ['LR', 'Locathah Rising'],
  ['SCAG', "Sword Coast Adventurer's Guide"],
  ['SCC', 'Strixhaven: A Curriculum of Chaos'],
  ['TTP', 'The Tortle Package'],
  ['VRGR', "Van Richten's Guide to Ravenloft"],
  ['TCE', "Tasha's Cauldron of Everything"],
  ['AWM', 'Adventure with Muk'],
];
const BOOKS_BY_TITLE = new Map(BOOKS.map(([code, title]) => [titleKey(title), code]));
/** Название книги для метки без подсказки: «(MOT)» → «Mythic Odysseys of Theros». */
const TITLE_BY_CODE = new Map([...BOOKS].reverse().map(([code, title]) => [code, title]));

/** «Mordenkainen’s Tome of Foes» и «Mordenkainen's tome of foes» — одна книга. */
export function titleKey(title: string): string {
  return title
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»"]/g, '')
    .trim()
    .toLowerCase();
}

/** В тексте страниц метки иногда отличаются от плашек сайта. */
const CODE_ALIASES: Record<string, string> = {
  OOTA: 'OTA',
  ERLW: 'RLW',
  EGTW: 'EGW',
  MOOT: 'MOT',
  MTOF: 'MTF',
  AM: 'AWM',
};

export class ItemSources {
  /** Уже известные источники (из заклинаний той же сборки): с номерами фильтра DnD.su. */
  private readonly known: Map<string, NormalizedSource>;

  constructor(known: Iterable<NormalizedSource>) {
    this.known = new Map([...known].map((source) => [source.code, source]));
  }

  /** Источник статьи по названию книги; `null` — книга не известна. */
  fromTitle(title: string): NormalizedSource | null {
    const code = BOOKS_BY_TITLE.get(titleKey(title));
    return code ? this.make(code, title) : null;
  }

  fromMark(mark: RawSourceMark): NormalizedSource {
    const upper = mark.code.toUpperCase();
    const code = CODE_ALIASES[upper] ?? upper;
    return this.make(code, mark.title ?? TITLE_BY_CODE.get(code) ?? code);
  }

  private make(code: string, title: string): NormalizedSource {
    const known = this.known.get(code);
    if (known) {
      return known;
    }
    const made: NormalizedSource = {
      id: code.toLowerCase(),
      code,
      nameEn: title,
      dndsuSourceId: null,
      edition: /24$/.test(code) ? '5e_2024' : '5e_2014',
    };
    // Метка без подсказки («Каноэ (TOA)») — после метки с названием книги: одна строка
    // `sources`. Подсказку берёт первая встреченная метка с названием.
    if (title !== code) {
      this.known.set(code, made);
    }
    return made;
  }
}
