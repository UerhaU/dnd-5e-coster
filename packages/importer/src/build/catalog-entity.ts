import type {
  Automation,
  Edition,
  ItemData,
  ItemRules,
  RaceData,
  RaceRules,
  ReviewStatus,
  SpellData,
  SpellRules,
} from '@koster/shared';
import type { NormalizedSource } from '../spells/normalize-spell.ts';

// Объект, готовый к записи в catalog.db: общий для всех категорий.

export type LinkKind = 'contains' | 'uses_ammunition' | 'material_component' | 'variant_of';

interface CatalogEntityBase {
  id: string;
  nameRu: string;
  nameEn: string;
  aliases: string[];
  edition: Edition;
  reviewStatus: ReviewStatus;
  automation: Automation;
  schemaVersion: string;
  sources: { source: NormalizedSource; dndsuId: number; url: string }[];
  /** Связи с другими объектами; цели без объекта сборка отбрасывает с предупреждением. */
  links: { toId: string; kind: LinkKind }[];
  /** Плоский текст для полнотекстового поиска. */
  searchBody: string;
}

export type CatalogEntity =
  | (CatalogEntityBase & { category: 'spell'; data: SpellData; rules: SpellRules | null })
  | (CatalogEntityBase & { category: 'item'; data: ItemData; rules: ItemRules | null })
  | (CatalogEntityBase & { category: 'race'; data: RaceData; rules: RaceRules });
