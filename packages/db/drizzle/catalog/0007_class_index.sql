CREATE TABLE `class_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`hit_die` integer NOT NULL,
	`spellcasting_ability` text,
	`caster_progression` text,
	`subclass_level` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subclass_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`has_spell_list` integer NOT NULL,
	`spellcaster` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action
);
