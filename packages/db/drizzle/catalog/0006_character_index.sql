CREATE TABLE `background_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`grants_feat` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feat_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`has_prerequisite` integer NOT NULL,
	`ability_increase` integer NOT NULL,
	`race_required` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action
);
