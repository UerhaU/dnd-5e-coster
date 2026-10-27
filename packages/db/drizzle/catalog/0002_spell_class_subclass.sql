PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_spell_index_classes` (
	`entity_id` text NOT NULL,
	`class_id` text NOT NULL,
	`access` text NOT NULL,
	PRIMARY KEY(`entity_id`, `class_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `spell_index`(`entity_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "spell_index_classes_access" CHECK("__new_spell_index_classes"."access" IN ('standard', 'optional', 'subclass'))
);
--> statement-breakpoint
INSERT INTO `__new_spell_index_classes`("entity_id", "class_id", "access") SELECT "entity_id", "class_id", "access" FROM `spell_index_classes`;--> statement-breakpoint
DROP TABLE `spell_index_classes`;--> statement-breakpoint
ALTER TABLE `__new_spell_index_classes` RENAME TO `spell_index_classes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `spell_index_classes_class` ON `spell_index_classes` (`class_id`);