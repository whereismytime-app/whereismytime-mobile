ALTER TABLE `events` ADD `categoryId` text REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `events` ADD `isManuallyCategorized` integer;--> statement-breakpoint
CREATE INDEX `events_category_idx` ON `events` (`categoryId`);