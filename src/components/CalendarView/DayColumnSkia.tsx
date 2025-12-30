import React, { memo } from 'react';
import { Canvas, Rect, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { useCalendarViewEvents } from './CalendarViewEventsProvider';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { EventWithCategory } from '@/services/events/EventsService';
import { View, Text } from 'react-native';
import { DAY_HEADER_HEIGHT } from './constants';

interface DayColumnProps {
  dateKey: string;
  hourHeight: SharedValue<number>;
  isToday: boolean;
  columnWidth: number;
}

export const DayColumn = memo(function DayColumn({
  dateKey,
  hourHeight,
  columnWidth,
  isToday,
}: DayColumnProps) {
  const { events } = useCalendarViewEvents(dateKey);
  // Load a font once for the canvas
  const font = useFont(require('@/assets/fonts/Inter.ttf'), 12);
  if (!font) return null;

  const date = new Date(dateKey);
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
      <Canvas style={{ width: columnWidth, flex: 1 }}>
        {events.map((event) => (
          <EventDrawing
            key={event.id}
            event={event}
            hourHeight={hourHeight}
            font={font}
            columnWidth={columnWidth}
          />
        ))}
      </Canvas>
    </View>
  );
});

interface EventDrawingProps {
  event: EventWithCategory;
  hourHeight: SharedValue<number>;
  font: any;
  columnWidth: number;
}

// Create a sub-component to isolate the "Reactive" properties
const EventDrawing = ({ event, hourHeight, font, columnWidth }: EventDrawingProps) => {
  const startMin = event.start!.getHours() * 60 + event.start!.getMinutes();
  const duration = Math.max((event.end!.getTime() - event.start!.getTime()) / 60000, 15);

  // useDerivedValue creates a "listener" on the UI thread
  // This value updates at 60fps without triggering a React render
  const y = useDerivedValue(() => (startMin / 60) * hourHeight.value);
  const height = useDerivedValue(() => (duration / 60) * hourHeight.value);
  const textY = useDerivedValue(() => y.value + 16);

  return (
    <>
      <Rect
        x={2}
        y={y}
        width={columnWidth - 4}
        height={height}
        color={event.category?.color || '#3B82F6'}
        // r={4}
      />
      <SkiaText x={8} y={textY} text={event.title} font={font} color="white" />
    </>
  );
};
