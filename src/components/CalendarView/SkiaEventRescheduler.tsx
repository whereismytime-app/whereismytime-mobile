import { Group, SkFont } from '@shopify/react-native-skia';
import { memo } from 'react';
import Animated, {
  SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { DAY_HEADER_HEIGHT, EventBlockData } from './common';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { EventBlockCore } from './EventBlock';

interface SkiaEventReschedulerRendererProps {
  event: EventBlockData;
  dayIndex: number;
  columnWidth: SharedValue<number>;
  hourHeight: SharedValue<number>;
  startMinutes: SharedValue<number>;
  durationMinutes: SharedValue<number>;
  dragMode: SharedValue<'none' | 'move' | 'resize-top' | 'resize-bottom'>;
  font: SkFont;
}

/**
 * Pure Skia renderer component - renders inside Canvas
 * Reuses EventBlockCore with live drag values
 */
export const SkiaEventReschedulerRenderer = memo(function SkiaEventReschedulerRenderer({
  event,
  dayIndex,
  columnWidth,
  hourHeight,
  startMinutes,
  durationMinutes,
  dragMode,
  font,
}: SkiaEventReschedulerRendererProps) {
  // Position at the correct day column (matching DayColumn transform)
  const dayColumnTransform = useDerivedValue(() => [{ translateX: dayIndex * columnWidth.value }]);

  return (
    <Group transform={dayColumnTransform}>
      <EventBlockCore
        event={event}
        hourHeight={hourHeight}
        columnWidth={columnWidth}
        font={font}
        startMinutesOverride={startMinutes}
        durationMinutesOverride={durationMinutes}
        showHandles={true}
        isEditing={true}
      />
    </Group>
  );
});

interface SkiaEventReschedulerGestureOverlayProps {
  event: EventBlockData;
  dayIndex: number;
  columnWidth: SharedValue<number>;
  hourHeight: SharedValue<number>;
  scrollX: SharedValue<number>;
  scrollY: SharedValue<number>;
  startMinutes: SharedValue<number>;
  durationMinutes: SharedValue<number>;
  dragMode: SharedValue<'none' | 'move' | 'resize-top' | 'resize-bottom'>;
  onUpdate: (id: string, start: Date, end: Date) => void;
  onCancel: () => void;
}

const SNAP_MINUTES = 5;
const MIN_DURATION_MINUTES = 15;
const HANDLE_TOUCH_RADIUS = 30;

/**
 * Transparent gesture overlay - renders outside Canvas in the RN View hierarchy
 */
export const SkiaEventReschedulerGestureOverlay = memo(function SkiaEventReschedulerGestureOverlay({
  event,
  dayIndex,
  columnWidth,
  hourHeight,
  scrollX,
  scrollY,
  startMinutes,
  durationMinutes,
  dragMode,
  onUpdate,
  onCancel,
}: SkiaEventReschedulerGestureOverlayProps) {
  // Context for gesture tracking
  const dragContext = useSharedValue({
    initialStart: 0,
    initialDuration: 0,
  });

  // Layout calculations (matching Skia renderer)
  const width = useDerivedValue(() => columnWidth.value * event.width);
  const rectWidth = useDerivedValue(() => Math.min(width.value, columnWidth.value - 2));
  const height = useDerivedValue(() => (durationMinutes.value / 60) * hourHeight.value);

  const left = useDerivedValue(() => {
    return dayIndex * columnWidth.value + (columnWidth.value - rectWidth.value - 2) - scrollX.value;
  });

  const top = useDerivedValue(() => {
    return (startMinutes.value / 60) * hourHeight.value + DAY_HEADER_HEIGHT - scrollY.value;
  });

  const handleUpdateOnJS = (startMin: number, durationMin: number) => {
    const newStartDate = new Date(event.start!);
    newStartDate.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

    const newEndDate = new Date(newStartDate);
    const endMinutes = startMin + durationMin;
    newEndDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

    onUpdate(event.id, newStartDate, newEndDate);
  };

  // Gesture handler - configured to work with scroll views
  const panGesture = Gesture.Pan()
    .minDistance(5)
    .activeOffsetY([-10, 10])
    .onStart((e) => {
      'worklet';
      const localX = e.x;
      const localY = e.y;

      // Check if touching top handle (at top-left of the event)
      const distToTop = Math.sqrt(Math.pow(localX - 8, 2) + Math.pow(localY, 2));
      if (distToTop < HANDLE_TOUCH_RADIUS) {
        dragMode.value = 'resize-top';
        dragContext.value = {
          initialStart: startMinutes.value,
          initialDuration: durationMinutes.value,
        };
        return;
      }

      // Check if touching bottom handle (at bottom-right of the event)
      const bottomHandleX = rectWidth.value - 8;
      const distToBottom = Math.sqrt(
        Math.pow(localX - bottomHandleX, 2) + Math.pow(localY - height.value, 2)
      );
      if (distToBottom < HANDLE_TOUCH_RADIUS) {
        dragMode.value = 'resize-bottom';
        dragContext.value = {
          initialStart: startMinutes.value,
          initialDuration: durationMinutes.value,
        };
        return;
      }

      // Otherwise, move the entire event
      dragMode.value = 'move';
      dragContext.value = {
        initialStart: startMinutes.value,
        initialDuration: durationMinutes.value,
      };
    })
    .onUpdate((e) => {
      'worklet';
      const deltaMinutes = (e.translationY / hourHeight.value) * 60;

      switch (dragMode.value) {
        case 'move':
          const newStart = dragContext.value.initialStart + deltaMinutes;
          startMinutes.value = Math.max(0, Math.min(24 * 60 - durationMinutes.value, newStart));
          break;

        case 'resize-top':
          const newTopStart = dragContext.value.initialStart + deltaMinutes;
          const endTime = dragContext.value.initialStart + dragContext.value.initialDuration;
          const newTopDuration = endTime - newTopStart;

          if (newTopDuration >= MIN_DURATION_MINUTES) {
            startMinutes.value = Math.max(0, newTopStart);
            durationMinutes.value = Math.max(MIN_DURATION_MINUTES, newTopDuration);
          }
          break;

        case 'resize-bottom':
          const newBottomDuration = dragContext.value.initialDuration + deltaMinutes;
          if (newBottomDuration >= MIN_DURATION_MINUTES) {
            const maxDuration = 24 * 60 - startMinutes.value;
            durationMinutes.value = Math.min(
              maxDuration,
              Math.max(MIN_DURATION_MINUTES, newBottomDuration)
            );
          }
          break;
      }
    })
    .onEnd(() => {
      'worklet';
      // Snap to nearest interval
      const snappedStart = Math.round(startMinutes.value / SNAP_MINUTES) * SNAP_MINUTES;
      const snappedDuration = Math.round(durationMinutes.value / SNAP_MINUTES) * SNAP_MINUTES;

      startMinutes.value = withTiming(snappedStart);
      durationMinutes.value = withTiming(Math.max(SNAP_MINUTES, snappedDuration));

      runOnJS(handleUpdateOnJS)(snappedStart, Math.max(SNAP_MINUTES, snappedDuration));

      dragMode.value = 'none';
    });

  // Overlay style that matches the Skia rendering
  const overlayStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: left.value,
    top: top.value,
    width: rectWidth.value,
    height: height.value,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={overlayStyle} />
    </GestureDetector>
  );
});

/**
 * Main hook to create shared state for the rescheduler
 */
export function useEventReschedulerState(event: EventBlockData) {
  const initialStartMinutes = event.start!.getHours() * 60 + event.start!.getMinutes();
  const initialDuration = (event.end!.getTime() - event.start!.getTime()) / 60000;

  const startMinutes = useSharedValue(initialStartMinutes);
  const durationMinutes = useSharedValue(initialDuration);
  const dragMode = useSharedValue<'none' | 'move' | 'resize-top' | 'resize-bottom'>('none');

  return {
    startMinutes,
    durationMinutes,
    dragMode,
  };
}
