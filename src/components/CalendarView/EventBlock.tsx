import {
  Circle,
  Group,
  Paint,
  Paragraph,
  Rect,
  SkFont,
  Skia,
  rect,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { DAY_HEADER_HEIGHT, EventBlockData, SelectedEvent } from './common';

/**
 * Core props for rendering an event block (shared between EventBlock and Rescheduler)
 */
export interface EventBlockCoreProps {
  event: EventBlockData;
  hourHeight: SharedValue<number>;
  columnWidth: SharedValue<number>;
  font: SkFont;
  // Optional overrides for rescheduling (live drag values)
  startMinutesOverride?: SharedValue<number>;
  durationMinutesOverride?: SharedValue<number>;
  // Visual state
  showHandles?: boolean;
  isEditing?: boolean;
}

/**
 * Core event block renderer - reusable between static and editing modes
 */
export const EventBlockCore = memo(function EventBlockCore({
  event,
  hourHeight,
  columnWidth,
  font,
  startMinutesOverride,
  durationMinutesOverride,
  showHandles = false,
  isEditing = false,
}: EventBlockCoreProps) {
  // Use overrides if provided, otherwise calculate from event
  const defaultStartMin = event.start!.getHours() * 60 + event.start!.getMinutes();
  const defaultDuration = (event.end!.getTime() - event.start!.getTime()) / 60000;

  const startMin = useDerivedValue(() => startMinutesOverride?.value ?? defaultStartMin);
  const duration = useDerivedValue(() => durationMinutesOverride?.value ?? defaultDuration);

  const width = useDerivedValue(() => columnWidth.value * event.width);
  const height = useDerivedValue(() => (duration.value / 60) * hourHeight.value);
  const rectWidth = useDerivedValue(() => Math.min(width.value, columnWidth.value - 2));
  const paragraphWidth = useDerivedValue(() => Math.max(0, rectWidth.value - 8));

  const groupTransform = useDerivedValue(() => [
    { translateX: columnWidth.value - rectWidth.value - 2 },
    { translateY: (startMin.value / 60) * hourHeight.value + DAY_HEADER_HEIGHT },
  ]);

  const paragraph = useMemo(() => {
    if (!font) return null;
    const paragraphStyle = {
      maxLines: 2,
      ellipsis: '...',
    };
    const textStyle = {
      fontSize: 10,
      color: Skia.Color('white'),
    };
    return Skia.ParagraphBuilder.Make(paragraphStyle)
      .pushStyle(textStyle)
      .addText(event.title)
      .build();
  }, [event.title, font]);

  const handleRadius = isEditing ? 8 : 6;
  const handleOpacity = useDerivedValue(() => (showHandles ? 1 : 0));
  const bottomHandleCx = useDerivedValue(() => rectWidth.value - 8);

  return (
    <Group transform={groupTransform}>
      {/* Event Rectangle */}
      <Rect
        x={0}
        y={0}
        width={rectWidth}
        height={height}
        color={event.category?.color || '#3B82F6'}>
        <Paint
          style="stroke"
          strokeJoin="round"
          strokeWidth={isEditing ? 3 : 1.5}
          color={isEditing ? 'cornflowerblue' : 'black'}
        />
      </Rect>

      {/* Event Text */}
      {paragraph && <Paragraph paragraph={paragraph} x={4} y={4} width={paragraphWidth} />}

      {/* Resize Handles */}
      <Circle r={handleRadius} cx={8} cy={0} color="cornflowerblue" opacity={handleOpacity} />
      <Circle
        r={handleRadius}
        cx={bottomHandleCx}
        cy={height}
        color="cornflowerblue"
        opacity={handleOpacity}
      />
    </Group>
  );
});

export interface SkiaEventBlockProps {
  event: EventBlockData;
  hourHeight: SharedValue<number>;
  columnWidth: SharedValue<number>;
  font: SkFont;
  selectedEvent: SharedValue<SelectedEvent | null>;
}

/**
 * Static event block - hides itself when selected (rescheduler takes over)
 * Uses clip rect to hide when selected (opacity causes issues with sibling groups)
 */
export const EventBlock = memo(function EventBlock({
  event,
  hourHeight,
  columnWidth,
  font,
  selectedEvent,
}: SkiaEventBlockProps) {
  // Clip to zero-size rect when selected to hide the event
  // Would have preferred opacity, but that causes issues with sibling groups in Skia
  // https://github.com/Shopify/react-native-skia/issues/3355#issuecomment-3515624162
  const clipRect = useDerivedValue(() => {
    const isSelected = selectedEvent.value?.data?.id === event.id;
    // When selected, clip to empty rect (hides content); otherwise clip to a huge rect (shows all)
    return isSelected ? rect(0, 0, 0, 0) : rect(-10000, -10000, 20000, 20000);
  });

  return (
    <Group clip={clipRect}>
      <EventBlockCore
        event={event}
        hourHeight={hourHeight}
        columnWidth={columnWidth}
        font={font}
        showHandles={false}
        isEditing={false}
      />
    </Group>
  );
});
