import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CategoryReportService,
  type EventWithCategory,
} from '@/services/reporting/CategoryReportService';

interface EventsListProps {
  events: EventWithCategory[];
  emptyMessage: string;
}

interface EventListItemProps {
  event: EventWithCategory;
  index: number;
}

function EventListItem({ event, index }: EventListItemProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const duration = CategoryReportService.formatDuration(event.effectiveDuration);

  return (
    <View className="border-b border-gray-100 bg-white px-4 py-4">
      {/* Event Title */}
      <View className="mb-2 flex-row items-start justify-between">
        <Text className="mr-3 flex-1 text-base font-medium text-gray-900" numberOfLines={2}>
          {event.title || 'Untitled Event'}
        </Text>
        <Text className="text-sm font-medium text-blue-600">{duration}</Text>
      </View>

      {/* Event Time */}
      <View className="mb-2 flex-row items-center gap-4">
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text className="ml-1 text-sm text-gray-600">
            {event.isAllDay ? 'All Day' : `${formatTime(event.start!)} - ${formatTime(event.end!)}`}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text className="ml-1 text-sm text-gray-600">{formatDate(event.start!)}</Text>
        </View>
      </View>

      {/* Event Details */}
      <View className="flex-row items-center gap-4">
        {/* Category */}
        {event.category && (
          <View className="flex-row items-center">
            <View
              className="mr-2 h-3 w-3 rounded-full"
              style={{ backgroundColor: event.category.color }}
            />
            <Text className="text-sm text-gray-500" numberOfLines={1}>
              {event.category.name}
            </Text>
          </View>
        )}

        {/* Calendar */}
        {event.calendar && (
          <View className="flex-row items-center">
            <Ionicons name="calendar" size={12} color="#9CA3AF" />
            <Text className="ml-1 text-sm text-gray-500" numberOfLines={1}>
              {event.calendar.title}
            </Text>
          </View>
        )}
      </View>

      {/* Description */}
      {event.description && (
        <Text className="mt-2 text-sm text-gray-600" numberOfLines={2}>
          {event.description}
        </Text>
      )}
    </View>
  );
}

export function EventsList({ events, emptyMessage }: EventsListProps) {
  // Sort events by start time descending (most recent first)
  const sortedEvents = [...events].sort(
    (a, b) => (b.start?.getTime() || 0) - (a.start?.getTime() || 0)
  );

  if (sortedEvents.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4 py-16">
        <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
        <Text className="mt-4 text-center text-base leading-6 text-gray-500">{emptyMessage}</Text>
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: EventWithCategory; index: number }) => (
    <EventListItem event={item} index={index} />
  );

  const getTotalDuration = () => {
    return sortedEvents.reduce((sum, event) => sum + event.effectiveDuration, 0);
  };

  const getDateRange = () => {
    if (sortedEvents.length === 0) return '';

    const earliest = new Date(Math.min(...sortedEvents.map((e) => e.start?.getTime() || 0)));
    const latest = new Date(Math.max(...sortedEvents.map((e) => e.end?.getTime() || 0)));

    const earliestStr = earliest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const latestStr = latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return earliestStr === latestStr ? earliestStr : `${earliestStr} - ${latestStr}`;
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <Text className="text-base font-semibold text-gray-900">Events</Text>
        <Text className="mt-1 text-sm text-gray-600">
          {sortedEvents.length} {sortedEvents.length === 1 ? 'event' : 'events'} •{' '}
          {CategoryReportService.formatDuration(getTotalDuration())} total
          {getDateRange() && ` • ${getDateRange()}`}
        </Text>
      </View>

      {/* Events List */}
      <FlatList
        data={sortedEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}
