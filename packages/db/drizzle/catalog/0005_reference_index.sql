CREATE TABLE `language_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`kind` text,
	`dialect_of` text,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dialect_of`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `language_index_kind` ON `language_index` (`kind`);--> statement-breakpoint
CREATE TABLE `skill_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`ability_id` text NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ability_id`) REFERENCES `abilities`(`id`) ON UPDATE no action ON DELETE no action
);
