import React from 'react';
import { View, Text, useWindowDimensions, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { EventBlock } from './EventBlock';
import { useCalendarViewEvents } from './CalendarViewEventsProvider';

interface DayColumnProps {
  dateKey: string;
  hourHeight: SharedValue<number>;
  isToday: boolean;
  numDays: number;
}

export const DAY_HEADER_HEIGHT = 60;
const TIME_AXIS_WIDTH = 50;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayColumn({ dateKey, hourHeight, isToday, numDays }: DayColumnProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { events, isLoading } = useCalendarViewEvents(dateKey);
  const date = new Date(dateKey);
  // Calculate column width based on number of days
  const columnWidth = (screenWidth - TIME_AXIS_WIDTH) / numDays;

  const formatDayHeader = (d: Date) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[d.getDay()];
    const dayNum = d.getDate();
    return { dayName, dayNum };
  };

  const { dayName, dayNum } = formatDayHeader(date);

  return (
    <View style={{ width: columnWidth }} className="relative flex-1">
      {/* Day Header */}
      <View
        style={{ height: DAY_HEADER_HEIGHT }}
        className={`items-center py-2 ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
        <Text className={`text-xs ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{dayName}</Text>
        <View
          className={`mt-1 h-8 w-8 items-center justify-center rounded-full ${
            isToday ? 'bg-blue-600' : ''
          }`}>
          <Text className={`text-sm font-semibold ${isToday ? 'text-white' : 'text-gray-800'}`}>
            {dayNum}
          </Text>
        </View>
      </View>

      <View className="relative">
        {/* Hour Grid Lines */}
        {HOURS.map((hour) => (
          <HourLine key={hour} hourHeight={hourHeight} />
        ))}

        {/* Event Blocks */}
        {events.map((event) => (
          <EventBlock
            key={event.id}
            event={event}
            hourHeight={hourHeight}
            columnWidth={columnWidth}
          />
        ))}

        {isLoading && (
          <View className="absolute inset-0 items-center justify-center bg-white/70">
            <ActivityIndicator size="small" color="#3B82F6" />
          </View>
        )}
      </View>
    </View>
  );
}

interface HourLineProps {
  hourHeight: SharedValue<number>;
}

function HourLine({ hourHeight }: HourLineProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    height: hourHeight.value,
  }));

  return <Animated.View style={animatedStyle} className="border-b border-gray-100" />;
}
