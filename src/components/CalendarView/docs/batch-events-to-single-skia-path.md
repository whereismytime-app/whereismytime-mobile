# Batch Events to a Single Skia Path in CalendarView DayColumn Component

Sample

```tsx
import React, { memo } from 'react';
import { Canvas, Path, Text, useFont, useDerivedValue, Skia } from '@shopify/react-native-skia';
import { useCalendarViewEvents } from './CalendarViewEventsProvider';

const DEFAULT_HOUR_HEIGHT = 60;

export const DayColumnSkia = memo(({ dateKey, hourHeight, columnWidth }) => {
  const { events } = useCalendarViewEvents(dateKey);
  const font = useFont(require('@/assets/fonts/Inter.ttf'), 12);

  // 1. Create a single path for all event backgrounds
  const eventsPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    events.forEach((event) => {
      const startMin = event.start.getHours() * 60 + event.start.getMinutes();
      const duration = Math.max((event.end - event.start) / 60000, 15);

      const top = (startMin / 60) * hourHeight.value;
      const height = (duration / 60) * hourHeight.value;

      // Add a rounded rect to the path for each event
      path.addRoundRect(
        Skia.XYWHRect(2, top, columnWidth - 4, height),
        4,
        4 // Border radius
      );
    });
    return path;
  }, [events, columnWidth]); // Only re-run if data changes, not during zoom

  if (!font) return null;

  return (
    <Canvas style={{ width: columnWidth, flex: 1 }}>
      {/* 2. Draw all backgrounds in ONE command */}
      <Path path={eventsPath} color="#3B82F6" />

      {/* 3. Render labels (Text currently requires individual calls in Skia) */}
      {events.map((event) => (
        <EventText key={event.id} event={event} hourHeight={hourHeight} font={font} />
      ))}
    </Canvas>
  );
});

const EventText = ({ event, hourHeight, font }) => {
  const startMin = event.start.getHours() * 60 + event.start.getMinutes();
  const y = useDerivedValue(() => (startMin / 60) * hourHeight.value + 16);

  return <Text x={8} y={y} text={event.title} font={font} color="white" />;
};
```
