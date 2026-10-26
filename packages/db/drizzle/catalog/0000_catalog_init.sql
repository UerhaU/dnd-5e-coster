CREATE TABLE `abilities` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_info` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`edition` text NOT NULL,
	`current_revision_id` integer NOT NULL,
	`review_status` text NOT NULL,
	`automation` text NOT NULL,
	`withdrawn` integer DEFAULT false NOT NULL,
	CONSTRAINT "content_entities_review_status" CHECK("content_entities"."review_status" IN ('raw', 'parsed', 'reviewed', 'rules_verified')),
	CONSTRAINT "content_entities_automation" CHECK("content_entities"."automation" IN ('full', 'assisted', 'display_only'))
);
--> statement-breakpoint
CREATE INDEX `content_entities_category` ON `content_entities` (`category`);--> statement-breakpoint
CREATE TABLE `content_links` (
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`kind` text NOT NULL,
	PRIMARY KEY(`from_id`, `to_id`, `kind`),
	FOREIGN KEY (`from_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `content_links_to` ON `content_links` (`to_id`);--> statement-breakpoint
CREATE TABLE `content_revisions` (
	`id` integer PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`revision` integer NOT NULL,
	`schema_version` text NOT NULL,
	`data_json` text NOT NULL,
	`rules_json` text,
	`content_hash` text NOT NULL,
	`importer_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_revisions_entity_revision` ON `content_revisions` (`entity_id`,`revision`);--> statement-breakpoint
CREATE TABLE `damage_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entity_sources` (
	`entity_id` text NOT NULL,
	`source_id` text NOT NULL,
	`dndsu_id` integer,
	`url` text,
	PRIMARY KEY(`entity_id`, `source_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `magic_schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_ru` text,
	`name_en` text NOT NULL,
	`dndsu_source_id` integer,
	`edition` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_code_unique` ON `sources` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sources_dndsu_source_id_unique` ON `sources` (`dndsu_source_id`);--> statement-breakpoint
CREATE TABLE `spell_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`level` integer NOT NULL,
	`school_id` text NOT NULL,
	`ritual` integer NOT NULL,
	`concentration` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `magic_schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `spell_index_level` ON `spell_index` (`level`);--> statement-breakpoint
CREATE INDEX `spell_index_school` ON `spell_index` (`school_id`);--> statement-breakpoint
CREATE TABLE `spell_index_classes` (
	`entity_id` text NOT NULL,
	`class_id` text NOT NULL,
	`access` text NOT NULL,
	PRIMARY KEY(`entity_id`, `class_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `spell_index`(`entity_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "spell_index_classes_access" CHECK("spell_index_classes"."access" IN ('standard', 'optional'))
);
--> statement-breakpoint
CREATE INDEX `spell_index_classes_class` ON `spell_index_classes` (`class_id`);