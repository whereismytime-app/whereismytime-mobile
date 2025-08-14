CREATE TABLE `calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`timeZone` text NOT NULL,
	`syncToken` text,
	`updatedAt` integer DEFAULT (unixepoch()),
	`createdAt` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`priority` integer DEFAULT 0,
	`rules` text,
	`parentCategoryId` text,
	FOREIGN KEY (`parentCategoryId`) REFERENCES `categories`(`id`) ON UPDATE restrict ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`calendarId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`eventType` text,
	`isAllDay` integer,
	`start` integer,
	`end` integer,
	`effectiveDuration` integer NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()),
	`createdAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`calendarId`) REFERENCES `calendars`(`id`) ON UPDATE restrict ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `events_start_idx` ON `events` (`start`);--> statement-breakpoint
CREATE INDEX `events_end_idx` ON `events` (`end`);