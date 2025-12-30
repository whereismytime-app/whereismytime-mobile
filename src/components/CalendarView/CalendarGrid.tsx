import { Group, Rect, SkFont, Skia, Text as SkiaText } from '@shopify/react-native-skia';
import { memo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { EventWithCategory } from '~/src/services/reporting/CategoryReportService';
import { useCalendarViewEvents } from './CalendarViewEventsProvider';

interface DayDataWrapperProps {
  index: number;
  dateKey: string;
  columnWidth: SharedValue<number>;
  hourHeight: SharedValue<number>;
  font: SkFont;
}

export const DayDataWrapper = memo(function DayDataWrapper({
  index,
  dateKey,
  columnWidth,
  hourHeight,
  font,
}: DayDataWrapperProps) {
  // Hook only runs for visible/buffered days
  const { events } = useCalendarViewEvents(dateKey);
  // Font is passed from parent to avoid loading on mount (flicker)
  const transform = useDerivedValue(() => [{ translateX: index * columnWidth.value }]);
  const rectWidth = useDerivedValue(() => columnWidth.value);

  return (
    <Group transform={transform}>
      {/* Header Background */}
      <Rect x={0} y={0} width={rectWidth} height={60} color="white" />

      {events.map((event) => (
        <SkiaEventBlock
          key={event.id}
          event={event}
          hourHeight={hourHeight}
          columnWidth={columnWidth}
          font={font}
        />
      ))}
    </Group>
  );
});

interface SkiaEventBlockProps {
  event: EventWithCategory;
  hourHeight: SharedValue<number>;
  columnWidth: SharedValue<number>;
  font: SkFont;
}

const SkiaEventBlock = ({ event, hourHeight, columnWidth, font }: SkiaEventBlockProps) => {
  const startMin = event.start!.getHours() * 60 + event.start!.getMinutes();
  const duration = (event.end!.getTime() - event.start!.getTime()) / 60000;

  const y = useDerivedValue(() => (startMin / 60) * hourHeight.value + 60);
  const height = useDerivedValue(() => (duration / 60) * hourHeight.value);
  const rectWidth = useDerivedValue(() => Math.max(0, columnWidth.value - 4));

  const clipPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.addRect(Skia.XYWHRect(4, 0, Math.max(0, columnWidth.value - 8), 10000));
    return path;
  });

  return (
    <>
      <Rect
        x={2}
        y={y}
        width={rectWidth}
        height={height}
        color={event.category?.color || '#3B82F6'}
      // r={4}
      />
      {/* Skia Text with simple clipping */}
      <Group clip={clipPath}>
        <SkiaText
          x={8}
          y={useDerivedValue(() => y.value + 16)}
          text={event.title}
          font={font}
          color="white"
        />
      </Group>
    </>
  );
};
