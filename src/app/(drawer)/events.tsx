import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, SectionList, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { EventTile } from '@/components/EventTile';
import {
  EventsService,
  type EventWithCategory,
  type ScrollDirection,
  type EventCursor,
} from '@/services/events/EventsService';
import { useDrizzle } from '@/db/SQLiteProvider';

interface DateSection {
  date: string;
  title: string;
  data: EventWithCategory[];
}

export default function EventsScreen() {
  const { drizzle: drizzleDB } = useDrizzle();
  const [eventsService] = useState(() => new EventsService(drizzleDB));

  const [events, _setEvents] = useState<EventWithCategory[]>([]);
  const [sections, setSections] = useState<DateSection[]>([]);
  const [loading, setLoading] = useState(true);
  // TODO: Properly deal with refreshing state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [refreshing, _setRefreshing] = useState(false);
  const [loadingMoreFuture, setLoadingMoreFuture] = useState(false);
  const [loadingMorePast, setLoadingMorePast] = useState(false);
  const [hasMoreFuture, setHasMoreFuture] = useState(true);
  const [hasMorePast, setHasMorePast] = useState(true);
  const [futureCursor, setFutureCursor] = useState<EventCursor | undefined>();
  const [pastCursor, setPastCursor] = useState<EventCursor | undefined>();
  const [todaySectionIndex, setTodaySectionIndex] = useState<number>(0);

  const isInitialLoad = useRef(true);
  const sectionListRef = useRef<SectionList<EventWithCategory, DateSection>>(null);

  const createSectionsFromEvents = useCallback(
    (eventsList: EventWithCategory[]): { sections: DateSection[]; todaySectionIndex: number } => {
      const groupedEvents = eventsService.groupEventsByDate(eventsList);
      const sortedDates = Object.keys(groupedEvents).sort((a, b) => a.localeCompare(b)); // Chronological order

      const sections = sortedDates
        .map((date) => {
          const events = groupedEvents[date];
          if (!date || !events || !Array.isArray(events)) {
            console.warn('Invalid section data detected:', { date, events });
            return null;
          }
          return {
            date,
            title: eventsService.formatDateHeader(date),
            data: events,
          };
        })
        .filter((section): section is DateSection => section !== null);

      // Find today's section index for initial positioning
      const today = new Date().toISOString().split('T')[0];
      const todaySectionIndex = sections.findIndex((section) => section.date === today);

      return { sections, todaySectionIndex: Math.max(0, todaySectionIndex) };
    },
    [eventsService]
  );

  const setEventsDeduplicated = useCallback(
    (newEvents: EventWithCategory[]) => {
      // Deduplicate while preserving order using map-reduce
      const { deduplicatedEvents } = newEvents.reduce(
        (acc, event) => {
          if (!acc.seenIds.has(event.id)) {
            acc.seenIds.add(event.id);
            acc.deduplicatedEvents.push(event);
          }
          return acc;
        },
        {
          seenIds: new Set<string>(),
          deduplicatedEvents: [] as EventWithCategory[],
        }
      );

      _setEvents(deduplicatedEvents);
      const { sections, todaySectionIndex } = createSectionsFromEvents(deduplicatedEvents);
      setSections(sections);
      setTodaySectionIndex(todaySectionIndex);

      return deduplicatedEvents;
    },
    [createSectionsFromEvents]
  );

  const loadInitialEvents = useCallback(async () => {
    try {
      setLoading(true);
      const { pastEvents, futureEvents } = await eventsService.getInitialEventsAroundDate();

      const allEvents = [...pastEvents, ...futureEvents];
      setEventsDeduplicated(allEvents);

      // Set cursors for pagination
      if (pastEvents.length > 0) {
        const firstPastEvent = pastEvents[0];
        if (firstPastEvent.start) {
          setPastCursor({
            start: firstPastEvent.start.getTime(),
            id: firstPastEvent.id,
          });
        }
      }
      if (futureEvents.length > 0) {
        const lastFutureEvent = futureEvents[futureEvents.length - 1];
        if (lastFutureEvent.start) {
          setFutureCursor({
            start: lastFutureEvent.start.getTime(),
            id: lastFutureEvent.id,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load initial events:', error);
      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
      setTimeout(() => {
        isInitialLoad.current = false;
        console.info('Initial load complete');
      }, 1000);
    }
  }, [eventsService, setEventsDeduplicated]);

  const loadMoreEvents = useCallback(
    async (direction: ScrollDirection) => {
      if (isInitialLoad.current) return;
      if (direction === 'future' && (!hasMoreFuture || loadingMoreFuture || !futureCursor)) return;
      if (direction === 'past' && (!hasMorePast || loadingMorePast || !pastCursor)) return;
      console.info('loadingMore Events', direction);

      try {
        if (direction === 'future') {
          setLoadingMoreFuture(true);
        } else {
          setLoadingMorePast(true);
        }

        const cursor = direction === 'future' ? futureCursor : pastCursor;
        const result = await eventsService.getEventsPaginated(cursor, direction);

        let newEvents: EventWithCategory[];
        if (direction === 'future') {
          newEvents = [...events, ...result.events];
          setFutureCursor(result.nextCursor);
          setHasMoreFuture(result.hasMore);
        } else {
          newEvents = [...result.events, ...events];
          setPastCursor(result.nextCursor);
          setHasMorePast(result.hasMore);
        }

        setEventsDeduplicated(newEvents);
      } catch (error) {
        console.error(`Failed to load more ${direction} events:`, error);
        Alert.alert('Error', `Failed to load more ${direction} events`);
      } finally {
        if (direction === 'future') {
          setLoadingMoreFuture(false);
        } else {
          setLoadingMorePast(false);
        }
      }
    },
    [
      events,
      eventsService,
      setEventsDeduplicated,
      hasMoreFuture,
      hasMorePast,
      loadingMoreFuture,
      loadingMorePast,
      futureCursor,
      pastCursor,
    ]
  );

  const handleRefresh = useCallback(() => {
    loadInitialEvents();
  }, [loadInitialEvents]);

  const handleLoadMoreFuture = useCallback(() => {
    loadMoreEvents('future');
  }, [loadMoreEvents]);

  const handleLoadMorePast = useCallback(() => {
    loadMoreEvents('past');
  }, [loadMoreEvents]);

  const handleEventPress = useCallback((event: EventWithCategory) => {
    // TODO: Navigate to event details or show event actions
    console.log('Event pressed:', event.title);
  }, []);

  useEffect(() => {
    loadInitialEvents();
  }, [loadInitialEvents]);

  // Scroll to today after initial load
  useEffect(() => {
    if (
      !loading &&
      sections.length > 0 &&
      todaySectionIndex >= 0 &&
      todaySectionIndex < sections.length
    ) {
      setTimeout(() => {
        console.info('Scrolling to Today section', todaySectionIndex);
        sectionListRef.current?.scrollToLocation({
          sectionIndex: todaySectionIndex,
          itemIndex: 0,
          animated: false,
          viewPosition: 0.1, // Show today near the top
        });
      }, 100);
    }
  }, [loading, sections.length, todaySectionIndex]);

  const renderSectionHeader = useCallback(({ section }: { section: DateSection }) => {
    if (!section || !section.data || !Array.isArray(section.data)) {
      console.warn('Invalid section in renderSectionHeader:', section);
      return null;
    }
    return (
      <View className="bg-gray-50 px-4 py-3">
        <Text className="text-lg font-semibold text-gray-800">{section.title}</Text>
        <Text className="text-sm text-gray-500">
          {section.data.length} event{section.data.length !== 1 ? 's' : ''}
        </Text>
      </View>
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: EventWithCategory }) => (
      <EventTile event={item} onPress={handleEventPress} />
    ),
    [handleEventPress]
  );

  const renderFooter = useCallback(() => {
    if (loadingMoreFuture) {
      return (
        <View className="py-4">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-2 text-center text-sm text-gray-500">Loading future events...</Text>
        </View>
      );
    }

    if (!hasMoreFuture && events.length > 0) {
      return (
        <View className="py-8">
          <Text className="text-center text-gray-500">No more future events</Text>
        </View>
      );
    }

    return null;
  }, [loadingMoreFuture, hasMoreFuture, events.length]);

  const renderHeader = useCallback(() => {
    if (loadingMorePast) {
      return (
        <View className="py-4">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-2 text-center text-sm text-gray-500">Loading past events...</Text>
        </View>
      );
    }

    if (!hasMorePast && events.length > 0) {
      return (
        <View className="py-4">
          <Text className="text-center text-gray-500">No more past events</Text>
        </View>
      );
    }

    return null;
  }, [loadingMorePast, hasMorePast, events.length]);

  const keyExtractor = useCallback((item: EventWithCategory) => item.id, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-lg text-gray-600">Loading events...</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-8">
        <Text className="mb-2 text-2xl font-semibold text-gray-600">No Events Found</Text>
        <Text className="text-center text-gray-500">
          Your events will appear here once they&apos;re synced from your calendars.
        </Text>
      </View>
    );
  }

  // @ts-expect-error Debugging
  global.events = {
    sections,
    hasMorePast,
    hasMoreFuture,
    pastCursor,
    futureCursor,
    todaySectionIndex,
  };

  // Early return if sections contain invalid data
  const hasValidSections = sections.every(
    (section) => section && section.data && Array.isArray(section.data)
  );
  if (!hasValidSections && sections.length > 0) {
    console.error('Invalid sections detected, preventing render:', sections);
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-lg text-gray-600">Loading events...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <SectionList
        ref={sectionListRef}
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#3B82F6']} />
        }
        onEndReached={handleLoadMoreFuture}
        onStartReached={handleLoadMorePast}
        onEndReachedThreshold={0.25}
        onStartReachedThreshold={0.25}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        disableVirtualization={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 1,
          autoscrollToTopThreshold: 10,
        }}
        onScrollToIndexFailed={(info) => {
          // Fallback if scrollToLocation fails - use scrollToOffset instead
          console.warn('ScrollToLocation failed, falling back to scrollToOffset:', info);
          setTimeout(() => {
            sectionListRef.current?.getScrollResponder()?.scrollTo({
              x: 0,
              y: info.averageItemLength * info.index,
              animated: false,
            });
          }, 100);
        }}
      />
    </View>
  );
}
