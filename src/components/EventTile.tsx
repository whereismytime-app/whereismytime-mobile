import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EventWithCategory } from '@/services/events/EventsService';

interface EventTileProps {
  event: EventWithCategory;
  onPress?: (event: EventWithCategory) => void;
}

export const EventTile: React.FC<EventTileProps> = React.memo(({ event, onPress }) => {
  const formattedTime = useMemo((): string => {
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
  }, [event.isAllDay, event.start, event.end]);

  const categoryStyle = useMemo(() => {
    if (event.category) {
      return {
        borderLeftColor: event.category.color,
        borderLeftWidth: 4,
      };
    }
    return {
      borderLeftColor: '#D1D5DB',
      borderLeftWidth: 4,
      borderStyle: 'dashed' as const,
    };
  }, [event.category?.color]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(event);
    }
  }, [onPress, event]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="mx-4 mb-2 rounded-lg bg-white p-4 shadow-sm"
      style={[
        {
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 1,
          },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        },
        categoryStyle,
      ]}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-lg font-semibold text-gray-900" numberOfLines={2}>
            {event.title}
          </Text>
          
          <View className="mt-1 flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text className="ml-1 text-sm text-gray-600">
              {formattedTime}
            </Text>
          </View>

          {event.description && (
            <Text className="mt-2 text-sm text-gray-500" numberOfLines={2}>
              {event.description}
            </Text>
          )}
        </View>

        <View className="items-end">
          {event.category ? (
            <View className="flex-row items-center">
              <View 
                className="mr-2 h-3 w-3 rounded-full" 
                style={{ backgroundColor: event.category.color }} 
              />
              <Text className="text-xs text-gray-600" numberOfLines={1}>
                {event.category.name}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="help-circle-outline" size={14} color="#9CA3AF" />
              <Text className="ml-1 text-xs text-gray-400">
                Uncategorized
              </Text>
            </View>
          )}

          {event.effectiveDuration > 0 && (
            <Text className="mt-1 text-xs text-gray-400">
              {Math.round(event.effectiveDuration)} min
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});