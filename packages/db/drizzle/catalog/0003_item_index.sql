CREATE TABLE `item_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_index` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`kind_id` text NOT NULL,
	`category_id` text,
	`cost_cp` integer,
	`weight_lb` real,
	`optional_rule` integer NOT NULL,
	`damage_type_id` text,
	FOREIGN KEY (`entity_id`) REFERENCES `content_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kind_id`) REFERENCES `item_kinds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `item_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`damage_type_id`) REFERENCES `damage_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `item_index_kind` ON `item_index` (`kind_id`);--> statement-breakpoint
CREATE INDEX `item_index_category` ON `item_index` (`category_id`);--> statement-breakpoint
CREATE TABLE `item_index_properties` (
	`entity_id` text NOT NULL,
	`property_id` text NOT NULL,
	PRIMARY KEY(`entity_id`, `property_id`),
	FOREIGN KEY (`entity_id`) REFERENCES `item_index`(`entity_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `weapon_properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `item_index_properties_property` ON `item_index_properties` (`property_id`);--> statement-breakpoint
CREATE TABLE `item_kinds` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weapon_properties` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ru` text NOT NULL,
	`name_en` text NOT NULL
);
