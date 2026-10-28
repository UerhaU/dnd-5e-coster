import type {
  Automation,
  BackgroundData,
  BackgroundRules,
  ClassData,
  ClassRules,
  Edition,
  FeatData,
  FeatRules,
  ConditionData,
  ItemData,
  LanguageData,
  ItemRules,
  RaceData,
  RaceRules,
  ReviewStatus,
  SpellData,
  SkillData,
  SpellRules,
  SubclassData,
  SubclassRules,
} from '@koster/shared';
import type { NormalizedSource } from '../spells/normalize-spell.ts';

// Объект, готовый к записи в catalog.db: общий для всех категорий.

export type LinkKind =
  | 'contains'
  | 'uses_ammunition'
  | 'material_component'
  | 'variant_of'
  /** Раса владеет оружием: «Дварфийская боевая тренировка» → боевой топор. */
  | 'weapon_proficiency'
  /** Раса владеет инструментом или выбирает из них: «инструменты кузнеца, пивовара или каменщика». */
  | 'tool_proficiency'
  /** Раса или предыстория владеет навыком или выбирает его (этап 3). */
  | 'skill_proficiency'
  /** Раса или предыстория знает язык или выбирает его из списка. */
  | 'language'
  /** Диалект языка: Акван → Первичный. */
  | 'dialect_of'
  /** Предмет стартового снаряжения предыстории. */
  | 'starting_equipment'
  /** Умение предыстории даёт черту: «Студент Призмари» → «Поступивший в Стриксхейвен». */
  | 'grants_feat'
  /** Требование черты: другая черта, раса, предыстория, класс. */
  | 'prerequisite'
  /** Заклинание, которое черта даёт по названию или упоминает (таблицы заклинаний). */
  | 'feat_spell'
  /** Подкласс класса: «Путь берсерка» → «Варвар». */
  | 'subclass_of'
  /** Дополнительное заклинание подкласса: домен, клятва, расширенный список покровителя. */
  | 'subclass_spell'
  /** Класс владеет оружием (простое и воинское — категориями, остальное — предметами). */
  | 'class_weapon'
  /** Заклинание в списке класса (обычном или дополнительном TCE): «Огненный шар» → «Волшебник». */
  | 'spell_class'
  /** Заклинание доступно через подкласс (фильтр DnD.su, Р53): «Огненный шар» → «Домен света». */
  | 'spell_subclass';

interface CatalogEntityBase {
  id: string;
  nameRu: string;
  nameEn: string;
  aliases: string[];
  edition: Edition;
  reviewStatus: ReviewStatus;
  automation: Automation;
  schemaVersion: string;
  /** У «компонента заклинания» (Р60) страницы нет: `dndsuId` и `url` — `null`. */
  sources: { source: NormalizedSource; dndsuId: number | null; url: string | null }[];
  /** Связи с другими объектами; цели без объекта сборка отбрасывает с предупреждением. */
  links: { toId: string; kind: LinkKind }[];
  /** Плоский текст для полнотекстового поиска. */
  searchBody: string;
}

export type CatalogEntity =
  | (CatalogEntityBase & { category: 'spell'; data: SpellData; rules: SpellRules | null })
  | (CatalogEntityBase & { category: 'item'; data: ItemData; rules: ItemRules | null })
  | (CatalogEntityBase & { category: 'race'; data: RaceData; rules: RaceRules })
  | (CatalogEntityBase & { category: 'skill'; data: SkillData; rules: null })
  | (CatalogEntityBase & { category: 'language'; data: LanguageData; rules: null })
  | (CatalogEntityBase & { category: 'condition'; data: ConditionData; rules: null })
  | (CatalogEntityBase & { category: 'background'; data: BackgroundData; rules: BackgroundRules })
  | (CatalogEntityBase & { category: 'feat'; data: FeatData; rules: FeatRules })
  | (CatalogEntityBase & { category: 'class'; data: ClassData; rules: ClassRules })
  | (CatalogEntityBase & { category: 'subclass'; data: SubclassData; rules: SubclassRules });
