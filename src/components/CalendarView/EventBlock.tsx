import React, { memo, useMemo } from 'react';
import { Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { type EventWithCategory } from '@/services/events/EventsService';

import { DEFAULT_HOUR_HEIGHT, EVENT_HORIZONTAL_PADDING, MIN_EVENT_HEIGHT } from './constants';

interface EventBlockProps {
  event: EventWithCategory;
  hourHeight: SharedValue<number>;
  columnWidth: number;
}

export const EventBlock = memo(function EventBlock({
  event,
  hourHeight,
  columnWidth,
}: EventBlockProps) {
  // Pre-calculate time values outside worklet (Date objects can't be accessed in UI runtime)
  const startMinutes = useMemo(
    () => (event.start != null ? event.start.getHours() * 60 + event.start.getMinutes() : 0),
    [event.start]
  );
  const endMinutes = useMemo(
    () =>
      event.end != null ? event.end.getHours() * 60 + event.end.getMinutes() : startMinutes + 30,
    [event.end, startMinutes]
  );
  const durationMinutes = useMemo(
    () => Math.max(endMinutes - startMinutes, 15),
    [endMinutes, startMinutes]
  ); // Minimum 15 min for visibility

  const animatedStyle = useAnimatedStyle(() => {
    // 1. Calculate the scale factor relative to our static baseline
    const scaleY = hourHeight.value / DEFAULT_HOUR_HEIGHT;

    // 2. Static layout positions (never changes, so no layout pass)
    const staticTop = (startMinutes / 60) * DEFAULT_HOUR_HEIGHT;
    const staticHeight = Math.max((durationMinutes / 60) * DEFAULT_HOUR_HEIGHT, MIN_EVENT_HEIGHT);

    return {
      position: 'absolute',
      top: staticTop,
      height: staticHeight,
      left: EVENT_HORIZONTAL_PADDING,
      // right: EVENT_HORIZONTAL_PADDING,
      width: columnWidth - EVENT_HORIZONTAL_PADDING * 2,
      // 3. Apply GPU-accelerated transforms
      transform: [
        // Move the block to account for the scaling of everything above it
        { translateY: staticTop * (scaleY - 1) },
        // Scale the block itself
        { scaleY: scaleY },
        // Correct the origin to the top (default is center)
        { translateY: (staticHeight / 2) * (scaleY - 1) },
      ],
    };
  });

  const handlePress = () => {
    // TODO: Enter reschedule mode
    console.log('Event pressed:', event.title);
  };

  // Get category color or default
  const backgroundColor = event.category?.color || '#3B82F6';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        className="h-full overflow-hidden rounded-md px-2 py-1"
        style={{ backgroundColor }}>
        <Text className="text-xs font-medium text-white" numberOfLines={1}>
          {event.title}
        </Text>
        {event.start && (
          <Text className="text-xs text-white/80" numberOfLines={1}>
            {formatTime(event.start)}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
});

function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minuteStr = minutes.toString().padStart(2, '0');
  return `${hour12}:${minuteStr} ${ampm}`;
}
