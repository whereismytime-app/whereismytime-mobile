import { Circle, Group, Rect, SkFont, Text as SkiaText } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { groupEvents, useCalendarViewEvents } from './CalendarViewEventsProvider';
import { DAY_HEADER_HEIGHT, SelectedEvent } from './common';
import { EventBlock } from './EventBlock';

interface DayColumnProps {
  index: number;
  dateKey: string;
  columnWidth: SharedValue<number>;
  hourHeight: SharedValue<number>;
  scrollY: SharedValue<number>;
  selectedEvent: SharedValue<SelectedEvent | null>;
  font: SkFont;
  headerFont: SkFont;
}

export const DayColumn = memo(function DayColumn({
  index,
  dateKey,
  columnWidth,
  hourHeight,
  scrollY,
  selectedEvent,
  font,
  headerFont,
}: DayColumnProps) {
  // Hook only runs for visible/buffered days
  const { events: rawEvents } = useCalendarViewEvents(dateKey);
  const events = useMemo(() => groupEvents(rawEvents), [rawEvents]);

  const transform = useDerivedValue(() => [{ translateX: index * columnWidth.value }]);
  /*
   * Header should counter-act the Y scroll of the canvas group to appear "sticky".
   * Canvas group has translateY: -scrollY.
   * So we apply translateY: scrollY to the header.
   */
  const headerTransform = useDerivedValue(() => [{ translateY: scrollY.value }]);
  const rectWidth = useDerivedValue(() => columnWidth.value);

  const date = new Date(dateKey);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayDate = date.getDate().toString();
  const isToday = dateKey === new Date().toISOString().split('T')[0];

  return (
    <Group transform={transform}>
      {events.map((event) => (
        <EventBlock
          key={event.id}
          event={event}
          hourHeight={hourHeight}
          columnWidth={columnWidth}
          font={font}
          selectedEvent={selectedEvent}
        />
      ))}

      {/* Header (Sticky) - Rendered last to be on top */}
      <Group transform={headerTransform}>
        {/* Header Background */}
        <Rect x={-5} y={0} width={rectWidth} height={DAY_HEADER_HEIGHT} color="white" />

        {/* Header Content */}
        <Group>
          <SkiaText
            x={10}
            y={25}
            text={dayName}
            font={font}
            color={isToday ? '#3B82F6' : '#6B7280'}
            opacity={isToday ? 1 : 0.8}
          />
          {isToday && <Circle cx={20} cy={45} r={14} color="#3B82F6" />}
          <SkiaText
            x={isToday ? (dayDate.length === 1 ? 15 : 10) : 10}
            y={50}
            text={dayDate}
            font={headerFont}
            color={isToday ? 'white' : 'black'}
          />
        </Group>
      </Group>
    </Group>
  );
});
