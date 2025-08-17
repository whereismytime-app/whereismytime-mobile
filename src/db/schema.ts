import { nanoid } from 'nanoid';
import { sql, relations } from 'drizzle-orm';
import { sqliteTable as table, text, integer, index } from 'drizzle-orm/sqlite-core';
import { type CategoryRule } from '@/types/category_rule';

const timestamps = {
  updatedAt: integer({ mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
  createdAt: integer({ mode: 'timestamp' }).default(sql`(unixepoch())`),
};

export const calendars = table('calendars', {
  id: text().primaryKey(),
  title: text().notNull(),
  timeZone: text().notNull(),
  syncToken: text(),
  lastSyncAt: integer({ mode: 'timestamp' }),
  ...timestamps,
});

export const events = table(
  'events',
  {
    id: text().primaryKey(),
    calendarId: text()
      .notNull()
      .references(() => calendars.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    title: text().notNull(),
    description: text(),
    eventType: text(),
    isAllDay: integer({ mode: 'boolean' }),
    start: integer({ mode: 'timestamp' }),
    end: integer({ mode: 'timestamp' }),
    // Duration in minutes, distributed across overlapping events
    effectiveDuration: integer().notNull(),
    // Category mapping
    categoryId: text().references(() => categories.id, {
      onDelete: 'set null',
      onUpdate: 'restrict',
    }),
    isManuallyCategorized: integer({ mode: 'boolean' }),
    ...timestamps,
  },
  (t) => [
    index('events_start_idx').on(t.start),
    index('events_end_idx').on(t.end),
    index('events_category_idx').on(t.categoryId),
    // Add composite index if necessary
    // index('events_calendar_start_idx').on(t.calendarId, t.start),
  ]
);

export const categories = table('categories', {
  id: text()
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  name: text().notNull(),
  color: text().notNull(),
  priority: integer().default(0),
  rules: text({ mode: 'json' }).$type<CategoryRule[]>(),
  parentCategoryId: text().references((): any => categories.id, {
    onDelete: 'restrict',
    onUpdate: 'restrict',
  }),
});

export const eventsRelations = relations(events, ({ one }) => ({
  calendar: one(calendars, {
    fields: [events.calendarId],
    references: [calendars.id],
    relationName: 'calendarEvents',
  }),
  category: one(categories, {
    fields: [events.categoryId],
    references: [categories.id],
    relationName: 'categoryEvents',
  }),
}));

export const calendarsRelations = relations(calendars, ({ many }) => ({
  events: many(events, {
    relationName: 'calendarEvents',
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentCategoryId],
    references: [categories.id],
    relationName: 'parentCategory',
  }),
  children: many(categories, {
    relationName: 'parentCategory',
  }),
  events: many(events, {
    relationName: 'categoryEvents',
  }),
}));

export type DBCalendar = typeof calendars.$inferSelect;
export type DBEvent = typeof events.$inferSelect;
export type Category = typeof categories.$inferSelect;
