-- Полнотекстовый индекс каталога (FTS5). Drizzle не описывает виртуальные таблицы,
-- поэтому миграция написана вручную. Тексты кладутся уже нормализованными:
-- нижний регистр, «ё» заменена на «е» (normalizeSearchText в @koster/db).
CREATE VIRTUAL TABLE `content_search` USING fts5(
	`entity_id` UNINDEXED,
	`category` UNINDEXED,
	`name_ru`,
	`name_en`,
	`aliases`,
	`body`,
	tokenize = 'unicode61 remove_diacritics 2',
	prefix = '2 3'
);
