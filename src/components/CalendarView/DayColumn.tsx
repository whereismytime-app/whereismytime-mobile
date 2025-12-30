import { memo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { EventBlock } from './EventBlock';
import { useCalendarViewEvents } from './CalendarViewEventsProvider';

interface DayColumnProps {
  dateKey: string;
  hourHeight: SharedValue<number>;
  isToday: boolean;
  columnWidth: number;
}

export const DAY_HEADER_HEIGHT = 60;

export const DayColumn = memo(function DayColumn({
  dateKey,
  hourHeight,
  isToday,
  columnWidth,
}: DayColumnProps) {
  // console.log('Rendering DayColumn for dateKey:', dateKey);
  const { events, isLoading } = useCalendarViewEvents(dateKey);
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

      <View className="relative">
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
});
