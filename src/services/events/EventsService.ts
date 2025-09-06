import type { DrizzleDB } from '@/db/SQLiteProvider';
import { events, categories, type DBEvent, type Category } from '@/db/schema';
import { desc, gt, lt, gte, lte, and, eq, or, asc } from 'drizzle-orm';

export interface EventWithCategory extends DBEvent {
  category: Category | null;
}

export interface EventCursor {
  start: number;
  id: string;
}

export interface EventsPageResult {
  events: EventWithCategory[];
  hasMore: boolean;
  nextCursor?: EventCursor;
}

export type ScrollDirection = 'future' | 'past';

export interface EventsByDate {
  [dateKey: string]: EventWithCategory[];
}

export class EventsService {
  constructor(
    private db: DrizzleDB,
    private pageSize: number = 50
  ) {}

  async getEventsPaginated(
    cursor?: EventCursor,
    direction: ScrollDirection = 'future',
    referenceDate?: Date
  ): Promise<EventsPageResult> {
    let baseQuery = this.db
      .select({
        id: events.id,
        calendarId: events.calendarId,
        title: events.title,
        description: events.description,
        eventType: events.eventType,
        isAllDay: events.isAllDay,
        start: events.start,
        end: events.end,
        effectiveDuration: events.effectiveDuration,
        categoryId: events.categoryId,
        isManuallyCategorized: events.isManuallyCategorized,
        updatedAt: events.updatedAt,
        createdAt: events.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
          priority: categories.priority,
          rules: categories.rules,
          parentCategoryId: categories.parentCategoryId,
        },
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id));

    const conditions = [];
    const _refDate = referenceDate || new Date();

    if (direction === 'future') {
      // For future events, start from reference date or cursor
      if (cursor) {
        // (start > cursor.start) OR (start = cursor.start AND id > cursor.id)
        conditions.push(
          or(
            gt(events.start, this.getDateFromTimestamp(cursor.start)),
            and(eq(events.start, this.getDateFromTimestamp(cursor.start)), gt(events.id, cursor.id))
          )
        );
      } else {
        conditions.push(gt(events.start, _refDate));
      }
    } else {
      // For past events, go backwards from reference date or cursor
      if (cursor) {
        // (start < cursor.start) OR (start = cursor.start AND id < cursor.id)
        conditions.push(
          or(
            lt(events.start, this.getDateFromTimestamp(cursor.start)),
            and(eq(events.start, this.getDateFromTimestamp(cursor.start)), lt(events.id, cursor.id))
          )
        );
      } else {
        conditions.push(lt(events.start, _refDate));
      }
    }

    const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    // Order based on direction - always by start first, then by id for consistency
    const orderBy =
      direction === 'future'
        ? [asc(events.start), asc(events.id)]
        : [desc(events.start), desc(events.id)];
    const results = await query.orderBy(...orderBy).limit(this.pageSize + 1);

    const hasMore = results.length > this.pageSize;
    const eventsList = hasMore ? results.slice(0, this.pageSize) : results;

    let nextCursor: EventCursor | undefined;
    if (hasMore && eventsList.length > 0) {
      const lastEvent = eventsList[eventsList.length - 1];
      if (lastEvent.start) {
        nextCursor = {
          start: lastEvent.start.getTime(),
          id: lastEvent.id,
        };
      }
    }

    return {
      events: eventsList as EventWithCategory[],
      hasMore,
      nextCursor,
    };
  }

  async getInitialEventsAroundDate(referenceDate: Date = new Date()): Promise<{
    pastEvents: EventWithCategory[];
    futureEvents: EventWithCategory[];
  }> {
    // Get some past events (7 days back)
    const pastStartDate = new Date(referenceDate);
    pastStartDate.setDate(pastStartDate.getDate() - 7);

    // Get future events (7 days forward)
    const futureEndDate = new Date(referenceDate);
    futureEndDate.setDate(futureEndDate.getDate() + 7);

    const pastQuery = this.db
      .select({
        id: events.id,
        calendarId: events.calendarId,
        title: events.title,
        description: events.description,
        eventType: events.eventType,
        isAllDay: events.isAllDay,
        start: events.start,
        end: events.end,
        effectiveDuration: events.effectiveDuration,
        categoryId: events.categoryId,
        isManuallyCategorized: events.isManuallyCategorized,
        updatedAt: events.updatedAt,
        createdAt: events.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
          priority: categories.priority,
          rules: categories.rules,
          parentCategoryId: categories.parentCategoryId,
        },
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .where(and(gte(events.start, pastStartDate), lte(events.start, referenceDate)))
      .orderBy(asc(events.start), asc(events.id));

    const futureQuery = this.db
      .select({
        id: events.id,
        calendarId: events.calendarId,
        title: events.title,
        description: events.description,
        eventType: events.eventType,
        isAllDay: events.isAllDay,
        start: events.start,
        end: events.end,
        effectiveDuration: events.effectiveDuration,
        categoryId: events.categoryId,
        isManuallyCategorized: events.isManuallyCategorized,
        updatedAt: events.updatedAt,
        createdAt: events.createdAt,
        category: {
          id: categories.id,
          name: categories.name,
          color: categories.color,
          priority: categories.priority,
          rules: categories.rules,
          parentCategoryId: categories.parentCategoryId,
        },
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .where(and(gte(events.start, referenceDate), lte(events.start, futureEndDate)))
      .orderBy(asc(events.start), asc(events.id));

    const [pastResults, futureResults] = await Promise.all([pastQuery, futureQuery]);

    return {
      pastEvents: pastResults as EventWithCategory[],
      futureEvents: futureResults as EventWithCategory[],
    };
  }

  groupEventsByDate(events: EventWithCategory[]): EventsByDate {
    const grouped: EventsByDate = {};

    for (const event of events) {
      if (!event.start) continue;

      const dateKey = event.start.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    }

    // Sort events within each day by start time
    Object.keys(grouped).forEach((dateKey) => {
      grouped[dateKey].sort((a, b) => {
        if (!a.start || !b.start) return 0;
        return a.start.getTime() - b.start.getTime();
      });
    });

    return grouped;
  }

  formatEventTime(event: EventWithCategory): string {
    if (event.isAllDay) {
      return 'All Day';
    }

    if (!event.start || !event.end) {
      return '';
    }

    const startTime = event.start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const endTime = event.end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${startTime} - ${endTime}`;
  }

  formatDateHeader(dateKey: string): string {
    const date = new Date(dateKey + 'T00:00:00.000Z');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) {
      return 'Today';
    } else if (isYesterday) {
      return 'Yesterday';
    } else if (isTomorrow) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }

  getDateFromTimestamp(ts_millis: number): Date {
    return new Date(ts_millis);
  }
}
