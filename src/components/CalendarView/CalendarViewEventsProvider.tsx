import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useDrizzle } from '@/db/SQLiteProvider';
import { events, categories } from '@/db/schema';
import { and, gte, lt, eq } from 'drizzle-orm';
import type { EventWithCategory } from '@/services/events/EventsService';

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

interface CalendarViewEventsContextValue {
  getEventsForDate: (dateKey: string) => EventWithCategory[] | undefined;
  fetchEventsForDate: (dateKey: string) => Promise<EventWithCategory[]>;
  invalidate: (dateKey?: string) => void;
  isLoading: (dateKey: string) => boolean;
}

const CalendarViewEventsContext = createContext<CalendarViewEventsContextValue | null>(null);

interface CalendarViewEventsProviderProps {
  children: React.ReactNode;
}

export function CalendarViewEventsProvider({ children }: CalendarViewEventsProviderProps) {
  const { drizzle: db } = useDrizzle();
  const cacheRef = useRef(new LRUCache<string, EventWithCategory[]>(CACHE_CAPACITY));
  const loadingRef = useRef(new Set<string>());
  const [, forceUpdate] = useState({});

  const getEventsForDate = useCallback((dateKey: string): EventWithCategory[] | undefined => {
    return cacheRef.current.get(dateKey);
  }, []);

  const isLoading = useCallback((dateKey: string): boolean => {
    return loadingRef.current.has(dateKey);
  }, []);

  const fetchEventsForDate = useCallback(
    async (dateKey: string): Promise<EventWithCategory[]> => {
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
          );

        const eventsList = results as EventWithCategory[];
        cacheRef.current.set(dateKey, eventsList);
        return eventsList;
      } finally {
        loadingRef.current.delete(dateKey);
        forceUpdate({});
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

  const contextValue: CalendarViewEventsContextValue = {
    getEventsForDate,
    fetchEventsForDate,
    invalidate,
    isLoading,
  };

  return (
    <CalendarViewEventsContext.Provider value={contextValue}>
      {children}
    </CalendarViewEventsContext.Provider>
  );
}

interface UseCalendarViewEventsResult {
  events: EventWithCategory[];
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
  const [localEvents, setLocalEvents] = useState<EventWithCategory[]>(() => {
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
