import { DrizzleDB } from '@/db/SQLiteProvider';
import { calendars, events } from '@/db/schema';
import { GoogleCalendarClient } from '@/integrations/google_calendar';
import { eq } from 'drizzle-orm';

export interface SyncProgress {
  status: 'idle' | 'syncing_calendars' | 'syncing_events';
  currentCalendar?: string;
  totalCalendars?: number;
  processedCalendars?: number;
  totalEvents?: number;
  processedEvents?: number;
  percentage: number;
}

export interface LastSyncInfo {
  timestamp: Date;
  calendarsSynced: number;
  eventsSynced: number;
  errors: string[];
}

export class CalendarSyncService {
  private googleClient: GoogleCalendarClient;
  private drizzle: DrizzleDB;
  private progressCallback?: (progress: SyncProgress) => void;
  private lastSyncInfo?: LastSyncInfo;

  constructor(
    googleClient: GoogleCalendarClient,
    drizzle: DrizzleDB,
    progressCallback?: (progress: SyncProgress) => void
  ) {
    this.googleClient = googleClient;
    this.drizzle = drizzle;
    this.progressCallback = progressCallback;
  }

  setProgressCallback(callback: (progress: SyncProgress) => void) {
    this.progressCallback = callback;
  }

  getLastSyncInfo(): LastSyncInfo | undefined {
    return this.lastSyncInfo;
  }

  private updateProgress(progress: SyncProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  async syncAllCalendars(): Promise<void> {
    const errors: string[] = [];
    let calendarsSynced = 0;
    let totalEventsSynced = 0;

    try {
      this.updateProgress({
        status: 'syncing_calendars',
        percentage: 0,
      });

      // Fetch all calendars
      const googleCalendars = await this.googleClient.client.calendar.calendarList.list();

      this.updateProgress({
        status: 'syncing_calendars',
        totalCalendars: googleCalendars.length,
        processedCalendars: 0,
        percentage: 10,
      });

      // Sync each calendar and its events
      for (let i = 0; i < googleCalendars.length; i++) {
        const calendar = googleCalendars[i];

        try {
          this.updateProgress({
            status: 'syncing_calendars',
            currentCalendar: calendar.summary,
            totalCalendars: googleCalendars.length,
            processedCalendars: i,
            percentage: 10 + (i / googleCalendars.length) * 20,
          });

          // Upsert calendar
          await this.drizzle
            .insert(calendars)
            .values({
              id: calendar.id,
              title: calendar.summary,
              timeZone: calendar.timeZone || 'UTC',
              syncToken: null, // Will be updated after events sync
              lastSyncAt: null, // Will be updated after events sync
            })
            .onConflictDoUpdate({
              target: calendars.id,
              set: {
                title: calendar.summary,
                timeZone: calendar.timeZone || 'UTC',
              },
            });

          calendarsSynced++;

          // Sync events for this calendar
          const eventsSynced = await this.syncCalendarEvents(
            calendar.id,
            i,
            googleCalendars.length
          );
          totalEventsSynced += eventsSynced;
        } catch (error) {
          const errorMsg = `Failed to sync calendar ${calendar.summary}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      this.updateProgress({
        status: 'idle',
        percentage: 100,
      });

      this.lastSyncInfo = {
        timestamp: new Date(),
        calendarsSynced,
        eventsSynced: totalEventsSynced,
        errors,
      };
    } catch (error) {
      const errorMsg = `Failed to sync calendars: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);

      this.updateProgress({
        status: 'idle',
        percentage: 0,
      });

      this.lastSyncInfo = {
        timestamp: new Date(),
        calendarsSynced,
        eventsSynced: totalEventsSynced,
        errors,
      };

      throw new Error(`Sync failed: ${errors.join(', ')}`);
    }
  }

  private async syncCalendarEvents(
    calendarId: string,
    calendarIndex: number,
    totalCalendars: number,
    syncToken?: string
  ): Promise<number> {
    let eventsSynced = 0;
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    // Get current sync token from database if not provided
    if (!syncToken) {
      const existingCalendar = await this.drizzle
        .select()
        .from(calendars)
        .where(eq(calendars.id, calendarId))
        .limit(1);

      syncToken = existingCalendar[0]?.syncToken || undefined;
    }

    this.updateProgress({
      status: 'syncing_events',
      currentCalendar: calendarId,
      totalCalendars,
      processedCalendars: calendarIndex,
      totalEvents: 0,
      processedEvents: 0,
      percentage: 30 + (calendarIndex / totalCalendars) * 60,
    });

    do {
      const response = await this.googleClient.client.calendar.events.list({
        calendarId,
        pageToken,
        syncToken: !pageToken ? syncToken : undefined, // Only use syncToken on first request
        maxResults: 2500,
      });

      // Process events in batches
      for (const googleEvent of response.items) {
        if (googleEvent.status === 'cancelled') {
          // Delete cancelled events
          await this.drizzle.delete(events).where(eq(events.id, googleEvent.id));
        } else {
          // Calculate event duration
          const startTime = this.parseEventTime(googleEvent.start);
          const endTime = this.parseEventTime(googleEvent.end);
          const effectiveDuration =
            endTime && startTime
              ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)) // duration in minutes
              : 0;

          // Upsert event
          await this.drizzle
            .insert(events)
            .values({
              id: googleEvent.id,
              calendarId,
              title: googleEvent.summary || 'Untitled Event',
              description: googleEvent.description,
              eventType: googleEvent.eventType,
              isAllDay: !googleEvent.start?.dateTime, // If no dateTime, it's an all-day event
              start: startTime,
              end: endTime,
              effectiveDuration,
            })
            .onConflictDoUpdate({
              target: events.id,
              set: {
                title: googleEvent.summary || 'Untitled Event',
                description: googleEvent.description,
                eventType: googleEvent.eventType,
                isAllDay: !googleEvent.start?.dateTime,
                start: startTime,
                end: endTime,
                effectiveDuration,
              },
            });
        }

        eventsSynced++;
      }

      pageToken = response.nextPageToken;
      nextSyncToken = response.nextSyncToken;

      this.updateProgress({
        status: 'syncing_events',
        currentCalendar: calendarId,
        totalCalendars,
        processedCalendars: calendarIndex,
        totalEvents: eventsSynced,
        processedEvents: eventsSynced,
        percentage: 30 + (calendarIndex / totalCalendars) * 60,
      });
    } while (pageToken);

    // Update calendar with new sync token and last sync timestamp
    if (nextSyncToken) {
      await this.drizzle
        .update(calendars)
        .set({
          syncToken: nextSyncToken,
          lastSyncAt: new Date(),
        })
        .where(eq(calendars.id, calendarId));
    }

    return eventsSynced;
  }

  async syncSelectedCalendars(calendarIds: string[]): Promise<void> {
    // Implementation deferred as per requirements
    throw new Error('syncSelectedCalendars is not yet implemented');
  }

  private parseEventTime(timeObj?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  }): Date | null {
    if (!timeObj) return null;

    if (timeObj.dateTime) {
      return new Date(timeObj.dateTime);
    } else if (timeObj.date) {
      // All-day event
      return new Date(timeObj.date + 'T00:00:00');
    }

    return null;
  }
}
