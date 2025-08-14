import { GoogleSignin } from '@react-native-google-signin/google-signin';

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  eventType?: string;
  status?: string;
}

interface CalendarEventsResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// Emulate gapi.client.calendar structure
interface CalendarList {
  list: () => Promise<GoogleCalendar[]>;
}

interface Events {
  list: (params: {
    calendarId: string;
    pageToken?: string;
    syncToken?: string;
    maxResults?: number;
  }) => Promise<CalendarEventsResponse>;
}

interface CalendarNamespace {
  calendarList: CalendarList;
  events: Events;
}

interface GoogleClient {
  calendar: CalendarNamespace;
}

export class GoogleCalendarClient {
  private accessToken: string | null = null;
  private baseURL: string = 'https://www.googleapis.com/calendar/v3';
  public client: GoogleClient;

  constructor() {
    // Mimic gapi.client.calendar namespace
    this.client = {
      calendar: {
        calendarList: {
          list: this.listCalendars.bind(this),
        },
        events: {
          list: this.listEvents.bind(this),
        },
      },
    };
  }

  // Initialize the client with the Firebase user's access token
  async initialize(): Promise<void> {
    const tokens = await GoogleSignin.getTokens();
    if (!tokens) {
      throw new Error('No user is signed in');
    }

    this.accessToken = tokens.accessToken;
  }

  // List all calendars for the authenticated user
  private async listCalendars(): Promise<GoogleCalendar[]> {
    if (!this.accessToken) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    try {
      const response = await fetch(`${this.baseURL}/users/me/calendarList`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch calendars: ${response.status} ${response.statusText} ${await response.text()}`
        );
      }

      const data = await response.json();
      return data.items;
    } catch (error) {
      console.error('Error listing calendars:', error);
      throw error;
    }
  }

  // List events for a specific calendar with pagination and sync token support
  private async listEvents(params: {
    calendarId: string;
    pageToken?: string;
    syncToken?: string;
    maxResults?: number;
  }): Promise<CalendarEventsResponse> {
    if (!this.accessToken) {
      throw new Error('Client not initialized. Call initialize() first.');
    }

    const { calendarId, pageToken, syncToken, maxResults = 2500 } = params;

    const urlParams = new URLSearchParams();
    if (pageToken) urlParams.set('pageToken', pageToken);
    if (syncToken) urlParams.set('syncToken', syncToken);
    if (maxResults) urlParams.set('maxResults', maxResults.toString());

    const url = `${this.baseURL}/calendars/${encodeURIComponent(calendarId)}/events${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch events for calendar ${calendarId}: ${response.status} ${response.statusText} ${await response.text()}`
        );
      }

      const data = await response.json();
      return {
        items: data.items || [],
        nextPageToken: data.nextPageToken,
        nextSyncToken: data.nextSyncToken,
      };
    } catch (error) {
      console.error(`Error listing events for calendar ${calendarId}:`, error);
      throw error;
    }
  }
}
