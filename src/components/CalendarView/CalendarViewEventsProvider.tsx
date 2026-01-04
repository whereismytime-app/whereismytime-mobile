import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useDrizzle } from '@/db/SQLiteProvider';
import { events, categories } from '@/db/schema';
import { and, gte, lt, eq, asc, desc } from 'drizzle-orm';
import type { EventWithCategory } from '@/services/events/EventsService';

import { EventBlockData } from './common';

/**
 * Simple LRU Cache implementation for caching events by date key
 */
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Delete oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Cache capacity - covers roughly a month of navigation
const CACHE_CAPACITY = 50;

export const groupEvents = (events: EventWithCategory[]): EventBlockData[] => {
  if (!events || events.length === 0) return [];

  const groupedEvents: EventWithCategory[][] = [];
  let currentGroup: EventWithCategory[] = [];
  for (const event of events) {
    // Check overlap with current group
    const overlaps = currentGroup.some(
      (e) => event.start! < e.end! && event.end! > e.start! // Overlap condition
    );

    if (overlaps) {
      currentGroup.push(event);
    } else {
      currentGroup = [event];
      groupedEvents.push(currentGroup);
    }
  }

  function layDownEqualDurationEvents(group: EventWithCategory[]) {
    const _events = [];
    let width = 1;
    for (const event of group) {
      _events.push({
        ...event,
        width,
      });
      width -= 1 / group.length;
    }

    return _events;
  }

  // Now assign widths based on group size
  const eventBlockData: EventBlockData[] = [];
  for (const group of groupedEvents) {
    if (group.length === 1) {
      eventBlockData.push({
        ...group[0],
        width: 1,
      });
      continue;
    }

    const startTimes = new Set(group.map((e) => e.start!.getTime()));
    const endTimes = new Set(group.map((e) => e.end!.getTime()));

    // If all events have the same start and end times, lay them out side by side
    if (startTimes.size === 1 && endTimes.size === 1) {
      eventBlockData.push(...layDownEqualDurationEvents(group));
      continue;
    }

    const eventIdToWidthMap: Map<string, number> = new Map();
    const boundaryMap: Map<string, { start: string[]; end: string[] }> = new Map();
    for (const event of group) {
      const start = event.start!.toISOString();
      const end = event.end!.toISOString();
      if (!boundaryMap.has(start)) {
        boundaryMap.set(start, { start: [], end: [] });
      }
      if (!boundaryMap.has(end)) {
        boundaryMap.set(end, { start: [], end: [] });
      }
      boundaryMap.get(start)?.start.push(event.id);
      boundaryMap.get(end)?.end.push(event.id);
    }

    const activeIds = new Set<string>();

    for (const boundary of Array.from(boundaryMap.keys()).sort()) {
      const map = boundaryMap.get(boundary) || { start: [], end: [] };

      // Clear the ending ones first.
      for (const eventId of map.end) {
        activeIds.delete(eventId);
      }
      for (const eventId of map.start) {
        // Calculate Width based on activeIds
        if (activeIds.size < 4) {
          eventIdToWidthMap.set(eventId, 1 - activeIds.size * 0.25);
        } else {
          eventIdToWidthMap.set(eventId, 0.25);
        }

        activeIds.add(eventId);
      }
    }

    if (activeIds.size !== 0) {
      // throw new Error(`Invalid Width Calculation: ${group.length} / ${activeIds.size}`);
      // Fallback for safety instead of crashing
      console.warn(`Invalid Width Calculation for group size ${group.length}`);
    }

    eventBlockData.push(
      ...group.map((e) => ({
        ...e,
        width: eventIdToWidthMap.get(e.id) || 1,
      }))
    );
  }

  return eventBlockData;
};

interface CalendarViewEventsContextValue {
  getEventsForDate: (dateKey: string) => EventBlockData[] | undefined;
  fetchEventsForDate: (dateKey: string) => Promise<EventBlockData[]>;
  updateEvent: (id: string, start: Date, end: Date) => Promise<void>;
  invalidate: (dateKey?: string) => void;
  isLoading: (dateKey: string) => boolean;
}

const CalendarViewEventsContext = createContext<CalendarViewEventsContextValue | null>(null);

interface CalendarViewEventsProviderProps {
  children: React.ReactNode;
}

export function CalendarViewEventsProvider({ children }: CalendarViewEventsProviderProps) {
  const { drizzle: db } = useDrizzle();
  const cacheRef = useRef(new LRUCache<string, EventBlockData[]>(CACHE_CAPACITY));
  const loadingRef = useRef(new Set<string>());
  const [, forceUpdate] = useState({});

  const getEventsForDate = useCallback((dateKey: string): EventBlockData[] | undefined => {
    return cacheRef.current.get(dateKey);
  }, []);

  const isLoading = useCallback((dateKey: string): boolean => {
    return loadingRef.current.has(dateKey);
  }, []);

  const fetchEventsForDate = useCallback(
    async (dateKey: string): Promise<EventBlockData[]> => {
      // Already cached
      const cached = cacheRef.current.get(dateKey);
      if (cached !== undefined) {
        return cached;
      }

      // Already loading
      if (loadingRef.current.has(dateKey)) {
        // Wait a bit and check again
        return new Promise((resolve) => {
          const checkCache = () => {
            const result = cacheRef.current.get(dateKey);
            if (result !== undefined) {
              resolve(result);
            } else if (loadingRef.current.has(dateKey)) {
              setTimeout(checkCache, 10);
            } else {
              resolve([]);
            }
          };
          setTimeout(checkCache, 10);
        });
      }

      // Start loading
      loadingRef.current.add(dateKey);
      forceUpdate({});

      try {
        // Parse date key to get start and end of day
        const startOfDay = new Date(dateKey);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateKey);
        endOfDay.setHours(23, 59, 59, 999);

        // console.info('[CalendarViewEventsProvider] Fetching events for:', dateKey);

        const results = await db
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
          .where(
            and(
              gte(events.start, startOfDay),
              lt(events.start, endOfDay),
              eq(events.isAllDay, false) // TODO: handle all-day events
            )
          )
          // Sort by start ASC, end DESC, createdAt ASC
          // DESC for end time to prioritize longer events when start times are the same
          .orderBy(asc(events.start), desc(events.end), asc(events.createdAt));

        const eventsList = groupEvents(results) as EventBlockData[];
        cacheRef.current.set(dateKey, eventsList);
        return eventsList;
      } finally {
        loadingRef.current.delete(dateKey);
        forceUpdate({});
      }
    },
    [db]
  );

  const updateEvent = useCallback(
    async (id: string, start: Date, end: Date) => {
      try {
        await db
          .update(events)
          .set({
            start,
            end,
            effectiveDuration: Math.round((end.getTime() - start.getTime()) / 60000),
            updatedAt: new Date(),
          })
          .where(eq(events.id, id));

        // Invalidate both start and end date keys (event might have moved days)
        // For simplicity, we just invalidate everything for now as moving across days is complex to track precisely
        // efficiently without more logic. Or we can just invalidate the keys associated with the original and new dates.
        const startKey = start.toISOString().split('T')[0];
        const endKey = end.toISOString().split('T')[0];

        // We also need to know the OLD date to invalidate it, but we don't have it easily here without fetching.
        // A simple approach is clear cache or smart invalidation.
        // Let's just invalidate the target dates for now. Ideally we should also invalidate the source date.
        // Since we are dragging, the source date was likely visible.

        cacheRef.current.delete(startKey);
        if (startKey !== endKey) {
          cacheRef.current.delete(endKey);
        }

        forceUpdate({});
      } catch (e) {
        console.error('Failed to update event:', e);
        throw e;
      }
    },
    [db]
  );

  const invalidate = useCallback((dateKey?: string) => {
    if (dateKey) {
      cacheRef.current.delete(dateKey);
    } else {
      cacheRef.current.clear();
    }
    forceUpdate({});
  }, []);

  const contextValue = React.useMemo<CalendarViewEventsContextValue>(
    () => ({
      getEventsForDate,
      fetchEventsForDate,
      updateEvent,
      invalidate,
      isLoading,
    }),
    [getEventsForDate, fetchEventsForDate, updateEvent, invalidate, isLoading]
  );

  return (
    <CalendarViewEventsContext.Provider value={contextValue}>
      {children}
    </CalendarViewEventsContext.Provider>
  );
}

interface UseCalendarViewEventsResult {
  events: EventBlockData[];
  isLoading: boolean;
}

/**
 * Hook to get events for a specific date.
 * Returns cached data immediately if available, otherwise triggers a fetch.
 */
export function useCalendarViewEvents(dateKey: string): UseCalendarViewEventsResult {
  const context = useContext(CalendarViewEventsContext);
  if (!context) {
    throw new Error('useCalendarViewEvents must be used within a CalendarViewEventsProvider');
  }

  const { getEventsForDate, fetchEventsForDate, isLoading } = context;
  const [localEvents, setLocalEvents] = useState<EventBlockData[]>(() => {
    return getEventsForDate(dateKey) ?? [];
  });

  useEffect(() => {
    const cached = getEventsForDate(dateKey);
    if (cached !== undefined) {
      setLocalEvents(cached);
      return;
    }

    // Fetch if not cached
    fetchEventsForDate(dateKey).then((events) => {
      setLocalEvents(events);
    });
  }, [dateKey, getEventsForDate, fetchEventsForDate]);

  return {
    events: localEvents,
    isLoading: isLoading(dateKey),
  };
}

/**
 * Hook to access the invalidation function for cache busting
 */
export function useCalendarViewEventsInvalidate() {
  const context = useContext(CalendarViewEventsContext);
  if (!context) {
    throw new Error(
      'useCalendarViewEventsInvalidate must be used within a CalendarViewEventsProvider'
    );
  }
  return context.invalidate;
}

/**
 * Hook to access the raw context data (for hit testing etc)
 */
export function useCalendarViewData() {
  const context = useContext(CalendarViewEventsContext);
  if (!context) {
    throw new Error('useCalendarViewData must be used within a CalendarViewEventsProvider');
  }
  return context;
}
