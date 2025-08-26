import { DrizzleDB } from '@/db/SQLiteProvider';
import { calendars, type DBCalendar } from '@/db/schema';
import { eq } from 'drizzle-orm';

export class CalendarManagementService {
  private drizzle: DrizzleDB;

  constructor(drizzle: DrizzleDB) {
    this.drizzle = drizzle;
  }

  /**
   * Get all calendars with their enabled status
   */
  async getCalendars(): Promise<DBCalendar[]> {
    return await this.drizzle
      .select()
      .from(calendars)
      .orderBy(calendars.title);
  }

  /**
   * Update the enabled status of a specific calendar
   */
  async updateCalendarEnabled(calendarId: string, enabled: boolean): Promise<void> {
    await this.drizzle
      .update(calendars)
      .set({
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(calendars.id, calendarId));
  }

  /**
   * Toggle the enabled status of a specific calendar
   */
  async toggleCalendarEnabled(calendarId: string): Promise<boolean> {
    // First get the current status
    const [calendar] = await this.drizzle
      .select({ enabled: calendars.enabled })
      .from(calendars)
      .where(eq(calendars.id, calendarId))
      .limit(1);

    if (!calendar) {
      throw new Error(`Calendar with ID ${calendarId} not found`);
    }

    const newEnabledStatus = !calendar.enabled;
    await this.updateCalendarEnabled(calendarId, newEnabledStatus);
    return newEnabledStatus;
  }

  /**
   * Get only enabled calendars
   */
  async getEnabledCalendars(): Promise<DBCalendar[]> {
    return await this.drizzle
      .select()
      .from(calendars)
      .where(eq(calendars.enabled, true))
      .orderBy(calendars.title);
  }

  /**
   * Enable multiple calendars at once
   */
  async enableCalendars(calendarIds: string[]): Promise<void> {
    for (const calendarId of calendarIds) {
      await this.updateCalendarEnabled(calendarId, true);
    }
  }

  /**
   * Disable multiple calendars at once
   */
  async disableCalendars(calendarIds: string[]): Promise<void> {
    for (const calendarId of calendarIds) {
      await this.updateCalendarEnabled(calendarId, false);
    }
  }
}