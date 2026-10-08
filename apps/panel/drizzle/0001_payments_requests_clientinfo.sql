CREATE TABLE `payment_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vs` varchar(10) NOT NULL,
	`customer_id` int NOT NULL,
	`service_id` int,
	`description` varchar(200) NOT NULL,
	`net` int NOT NULL,
	`vat_rate` int NOT NULL DEFAULT 0,
	`amount` int NOT NULL,
	`due_date` date NOT NULL,
	`covers_until` date,
	`status` enum('unpaid','paid','cancelled') NOT NULL DEFAULT 'unpaid',
	`paid_at` datetime,
	`invoice_ref` varchar(60) NOT NULL DEFAULT '',
	`reminded_at` datetime,
	`created_by_id` int,
	`note` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `payment_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_requests_vs` UNIQUE(`vs`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `source` enum('web','panel') DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `client_info` json;--> statement-breakpoint
ALTER TABLE `tickets` ADD `category` enum('general','dns','database','php','access','restore','change_plan','cancel','billing','incident') DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `details` json;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_requests` ADD CONSTRAINT `payment_requests_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payment_requests_customer` ON `payment_requests` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payment_requests_status` ON `payment_requests` (`status`);