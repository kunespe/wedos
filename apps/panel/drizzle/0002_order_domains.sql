ALTER TABLE `orders` ADD `domains` json DEFAULT (json_array()) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `converted_at` datetime;