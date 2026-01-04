import { DrizzleDB } from '@/db/SQLiteProvider';
import { EventCursor, EventsService, EventWithCategory } from './EventsService';
import { DBEvent, events as eventsTable } from '~/src/db/schema';
import { eq } from 'drizzle-orm';

export class EventDurationService {
  private drizzleDB: DrizzleDB;
  private _progressCounter: number;

  constructor(drizzleDB: DrizzleDB) {
    this.drizzleDB = drizzleDB;
    this._progressCounter = 0;
  }

  async recalculateDurations(
    from: Date,
    to: Date,
    onProgress?: (phase: string, completed: number, total: number) => void
  ) {
    console.info('Recalculating Event Durations', {
      from: from.toISOString(),
      to: to.toISOString(),
    });
    ({ from, to } = this._pad_date_range(from, to));
    const events = await this._fetch_all_events(from, to);

    // update duration to zero for all
    for (const event of events) {
      event.effectiveDuration = 0;
    }

    const boundaries = this._getAllBoundaries(events);

    for (let i = 0; i < boundaries.length - 1; i++) {
      const slice_start = boundaries[i];
      const slice_end = boundaries[i + 1];
      const slice_events = this._get_events_in_range(events, slice_start, slice_end);
      let slice_duration = (slice_end.getTime() - slice_start.getTime()) / (1000 * 60);

      let eventIdx = 0;
      do {
        const event = slice_events[eventIdx];
        if (!event) break;

        event.effectiveDuration += 1;
        slice_duration -= 1;
        eventIdx = (eventIdx + 1) % slice_events.length;
      } while (slice_duration > 0);
      await this._updateProgress('splitting_boundaries', i + 1, boundaries.length - 1, onProgress);
    }

    // TODO: Update effectiveDuration back in to the DB
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      await this.drizzleDB
        .update(eventsTable)
        .set({ effectiveDuration: event.effectiveDuration })
        .where(eq(eventsTable.id, event.id));
      await this._updateProgress('updating_database', i + 1, events.length, onProgress);
    }
  }

  _pad_date_range(from: Date, to: Date) {
    // Add 1hr padding
    return {
      from: new Date(from.getTime() - 60 * 60 * 1000),
      to: new Date(to.getTime() + 60 * 60 * 1000),
    };
  }

  _get_events_in_range(events: DBEvent[], from: Date, to: Date) {
    return events.filter((event) => {
      if (!event.start || !event.end) {
        return false;
      }
      return event.start <= from && event.end >= to;
    });
  }

  async _fetch_all_events(from: Date, to: Date) {
    const eventsService = new EventsService(this.drizzleDB, 500);
    const events: EventWithCategory[] = [];

    let hasMore = true;
    let cursor: EventCursor | undefined = undefined;
    do {
      const r = await eventsService.getEventsPaginated(cursor, 'future', from);
      let gotOne = false;
      for (const event of r.events) {
        if (event.isAllDay || (event.start && event.start > to)) {
          continue;
        }

        events.push(event);
        gotOne = true;
      }

      hasMore = r.hasMore && gotOne;
      cursor = r.nextCursor;
    } while (hasMore);

    return events;
  }

  _getAllBoundaries(events: DBEvent[]) {
    const boundaries = new Set<string>();
    for (const event of events) {
      if (event.start) {
        boundaries.add(event.start.toISOString());
      }
      if (event.end) {
        boundaries.add(event.end.toISOString());
      }
    }

    const _boundaries = Array.from(boundaries);
    _boundaries.sort();

    return _boundaries.map((date) => new Date(date));
  }

  async _updateProgress(
    phase: string,
    completed: number,
    total: number,
    onProgress?: (phase: string, completed: number, total: number) => void
  ) {
    if (this._progressCounter < 10) {
      this._progressCounter++;
      return;
    }

    this._progressCounter = 0;

    await new Promise((r) => setTimeout(r, 0));
    onProgress?.(phase, completed, total);
  }
}
