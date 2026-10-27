CREATE TABLE `race_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`variant_of` text,
	`size_id` text,
	`speed_walk_ft` integer,
	`flying` integer NOT NULL,
	`darkvision_ft` integer,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_of`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`size_id`) REFERENCES `sizes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `race_index_variant_of` ON `race_index` (`variant_of`);--> statement-breakpoint
CREATE TABLE `sizes` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL
);
