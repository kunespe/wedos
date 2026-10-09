CREATE TABLE `audit_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`actor_id` int,
	`action` varchar(60) NOT NULL,
	`subject` varchar(120) NOT NULL DEFAULT '',
	`details` text,
	`ip` varchar(64) NOT NULL DEFAULT '',
	`created_at` datetime NOT NULL,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`company` varchar(160) NOT NULL DEFAULT '',
	`ico` varchar(16) NOT NULL DEFAULT '',
	`dic` varchar(20) NOT NULL DEFAULT '',
	`address` varchar(255) NOT NULL DEFAULT '',
	`email` varchar(254) NOT NULL,
	`phone` varchar(32) NOT NULL DEFAULT '',
	`note` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`name` varchar(253) NOT NULL,
	`registrar` varchar(60) NOT NULL DEFAULT 'Subreg',
	`managed_by_us` boolean NOT NULL DEFAULT true,
	`expires_at` date,
	`note` text,
	`created_at` datetime NOT NULL,
	CONSTRAINT `domains_id` PRIMARY KEY(`id`),
	CONSTRAINT `domains_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`purpose` enum('invite','reset') NOT NULL DEFAULT 'invite',
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `invites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_failures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ip` varchar(64) NOT NULL,
	`email` varchar(254) NOT NULL DEFAULT '',
	`at` datetime NOT NULL,
	CONSTRAINT `login_failures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`host` varchar(120) NOT NULL,
	`provider` varchar(40) NOT NULL DEFAULT 'Hetzner',
	`location` varchar(40) NOT NULL DEFAULT '',
	`local` boolean NOT NULL DEFAULT false,
	`note` text,
	`created_at` datetime NOT NULL,
	CONSTRAINT `nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`author_id` int,
	`body` text NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `order_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('new','contacted','provisioning','done','cancelled') NOT NULL DEFAULT 'new',
	`plan_code` varchar(40) NOT NULL,
	`period` enum('month','year') NOT NULL,
	`domain` varchar(253) NOT NULL DEFAULT '',
	`domain_mode` enum('own','register','none') NOT NULL DEFAULT 'none',
	`name` varchar(160) NOT NULL,
	`email` varchar(254) NOT NULL,
	`phone` varchar(32) NOT NULL DEFAULT '',
	`company` varchar(160) NOT NULL DEFAULT '',
	`ico` varchar(16) NOT NULL DEFAULT '',
	`dic` varchar(20) NOT NULL DEFAULT '',
	`address` varchar(255) NOT NULL DEFAULT '',
	`note` text,
	`price_monthly` int,
	`assignee_id` int,
	`customer_id` int,
	`ip` varchar(64) NOT NULL DEFAULT '',
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`code` varchar(40) NOT NULL,
	`category` varchar(40) NOT NULL,
	`kind` enum('web','wp','app','vps','management','domain') NOT NULL,
	`name` varchar(80) NOT NULL,
	`monthly` int,
	`price_from` boolean NOT NULL DEFAULT false,
	`features` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `plans_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`plan_code` varchar(40),
	`kind` enum('web','wp','app','vps','management','domain') NOT NULL,
	`label` varchar(160) NOT NULL,
	`domain` varchar(253) NOT NULL DEFAULT '',
	`node_id` int,
	`status` enum('pending','active','suspended','cancelled') NOT NULL DEFAULT 'pending',
	`period` enum('month','year') NOT NULL DEFAULT 'year',
	`price_monthly` int,
	`cloudpanel_site` varchar(253) NOT NULL DEFAULT '',
	`fakturor_subscription_id` int,
	`expires_at` date,
	`manual_hold` boolean NOT NULL DEFAULT false,
	`monitored` boolean NOT NULL DEFAULT true,
	`order_id` int,
	`note` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`verified` boolean NOT NULL DEFAULT false,
	`ip` varchar(64) NOT NULL DEFAULT '',
	`created_at` datetime NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticket_id` int NOT NULL,
	`author_id` int,
	`internal` boolean NOT NULL DEFAULT false,
	`body` text NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`service_id` int,
	`subject` varchar(200) NOT NULL,
	`status` enum('open','waiting','closed') NOT NULL DEFAULT 'open',
	`created_by_id` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(254) NOT NULL,
	`name` varchar(160) NOT NULL,
	`role` enum('admin','client') NOT NULL,
	`customer_id` int,
	`password_hash` varchar(255),
	`totp_secret` varchar(64),
	`disabled` boolean NOT NULL DEFAULT false,
	`last_login_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `domains` ADD CONSTRAINT `domains_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invites` ADD CONSTRAINT `invites_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_notes` ADD CONSTRAINT `order_notes_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_notes` ADD CONSTRAINT `order_notes_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_assignee_id_users_id_fk` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_plan_code_plans_code_fk` FOREIGN KEY (`plan_code`) REFERENCES `plans`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_node_id_nodes_id_fk` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticket_id_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `login_failures_ip_at` ON `login_failures` (`ip`,`at`);--> statement-breakpoint
CREATE INDEX `orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `services_customer` ON `services` (`customer_id`);--> statement-breakpoint
CREATE INDEX `services_status` ON `services` (`status`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `tickets_customer` ON `tickets` (`customer_id`);--> statement-breakpoint
CREATE INDEX `tickets_status` ON `tickets` (`status`);