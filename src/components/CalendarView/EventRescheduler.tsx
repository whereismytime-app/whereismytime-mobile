import { StyleSheet, View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DAY_HEADER_HEIGHT, EventBlockData } from './common';
import { useCallback } from 'react';

interface EventReschedulerProps {
  event: EventBlockData;
  dayIndex: number;
  columnWidth: SharedValue<number>;
  hourHeight: SharedValue<number>;
  onUpdate: (id: string, start: Date, end: Date) => void;
  onCancel: () => void;
}

const HANDLE_SIZE = 24;
const SNAP_MINUTES = 5;
const MIN_DURATION = 0;

export function EventRescheduler({
  event,
  dayIndex,
  columnWidth,
  hourHeight,
  onUpdate,
  onCancel,
}: EventReschedulerProps) {
  // Initialize shared values with event time
  const startMinutes = useSharedValue(event.start!.getHours() * 60 + event.start!.getMinutes());
  const durationMinutes = useSharedValue(event.effectiveDuration || 60);

  // Track drag state
  const isDragging = useSharedValue(false);
  const isResizing = useSharedValue(false);

  // Derived layout values
  // These stay in sync with pinch-to-zoom because they depend on hourHeight
  const top = useDerivedValue(() => {
    return (startMinutes.value / 60) * hourHeight.value + DAY_HEADER_HEIGHT;
  });

  const height = useDerivedValue(() => {
    return (durationMinutes.value / 60) * hourHeight.value;
  });

  const width = useDerivedValue(() => {
    // Only use the event's specific width portion of the column
    // The event.width is a fraction (0 to 1)
    // We also need to account for horizontal positioning (rendered via padding usually?)
    // In Skia EventBlock: x = columnWidth - rectWidth - 2
    // rectWidth = width * event.width
    // So we need to replicate that logic.
    const w = columnWidth.value * event.width;
    return Math.max(w - 2, 0);
  });

  const left = useDerivedValue(() => {
    // Replicating EventBlock logic:
    // x = columnWidth - rectWidth - 2
    // rectWidth is what we calculated above.
    const rectWidth = width.value;
    // We need the offset for the specific day
    const dayOffset = dayIndex * columnWidth.value;
    // Plus the offset inside the column
    const internalX = columnWidth.value - rectWidth - 2;
    return dayOffset + internalX;
  });

  const triggerUpdate = useCallback(
    (startMinutes: number, durationMinutes: number) => {
      const newStartDate = new Date(event.start!);
      newStartDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

      const newEndDate = new Date(newStartDate);
      const endMinutes = startMinutes + durationMinutes;
      newEndDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

      onUpdate(event.id, newStartDate, newEndDate);
    },
    [event.start, event.id, onUpdate]
  );

  // Gestures
  const context = useSharedValue({ startMinutes: 0, durationMinutes: 0 });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = {
        startMinutes: startMinutes.value,
        durationMinutes: durationMinutes.value,
      };
      isDragging.value = true;
    })
    .onUpdate((e) => {
      // Calculate delta in minutes
      const minuteDelta = (e.translationY / hourHeight.value) * 60;
      const newStart = context.value.startMinutes + minuteDelta;

      // Snap logic could be here or onEnd.
      // Let's snap visually during drag for better feedback?
      // Or just raw move and snap on end. Raw move feels smoother.
      startMinutes.value = newStart;
    })
    .onEnd(() => {
      // Snap to nearest SNAP_MINUTES
      const snappedStart = Math.round(startMinutes.value / SNAP_MINUTES) * SNAP_MINUTES;
      const validStart = Math.max(0, Math.min(24 * 60 - durationMinutes.value, snappedStart));

      startMinutes.value = withTiming(validStart, {}, () => {
        isDragging.value = false;
        scheduleOnRN(triggerUpdate, startMinutes.value, durationMinutes.value);
      });
    });

  const resizeTopGesture = Gesture.Pan()
    .onStart(() => {
      context.value = {
        startMinutes: startMinutes.value,
        durationMinutes: durationMinutes.value,
      };
      isResizing.value = true;
    })
    .onUpdate((e) => {
      const minuteDelta = (e.translationY / hourHeight.value) * 60;
      const newStart = context.value.startMinutes + minuteDelta;
      // When moving top, end time stays fixed, so duration changes inversely
      // EndTime = OldStart + OldDuration
      // NewDuration = EndTime - NewStart
      const endTime = context.value.startMinutes + context.value.durationMinutes;
      const newDuration = endTime - newStart;

      if (newDuration >= MIN_DURATION) {
        startMinutes.value = newStart;
        durationMinutes.value = newDuration;
      }
    })
    .onEnd(() => {
      const snappedStart = Math.round(startMinutes.value / SNAP_MINUTES) * SNAP_MINUTES;
      const validStart = Math.max(0, snappedStart);

      const snappedDuration = Math.max(
        SNAP_MINUTES,
        Math.round(durationMinutes.value / SNAP_MINUTES) * SNAP_MINUTES
      );

      startMinutes.value = withTiming(validStart);
      durationMinutes.value = withTiming(snappedDuration, {}, () => {
        isResizing.value = false;
        scheduleOnRN(triggerUpdate, validStart, durationMinutes.value);
      });
    });

  const resizeBottomGesture = Gesture.Pan()
    .onStart(() => {
      context.value = {
        startMinutes: startMinutes.value,
        durationMinutes: durationMinutes.value,
      };
      isResizing.value = true;
    })
    .onUpdate((e) => {
      const minuteDelta = (e.translationY / hourHeight.value) * 60;
      const newDuration = context.value.durationMinutes + minuteDelta;

      if (newDuration >= MIN_DURATION) {
        durationMinutes.value = newDuration;
      }
    })
    .onEnd(() => {
      const snappedDuration = Math.max(
        SNAP_MINUTES,
        Math.round(durationMinutes.value / SNAP_MINUTES) * SNAP_MINUTES
      );

      durationMinutes.value = withTiming(snappedDuration, {}, () => {
        isResizing.value = false;
        scheduleOnRN(triggerUpdate, startMinutes.value, durationMinutes.value);
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    top: top.value,
    left: left.value,
    height: height.value,
    width: width.value,
    opacity: isDragging.value ? 0.8 : 1,
    zIndex: isDragging.value || isResizing.value ? 100 : 10,
  }));

  return (
    <Animated.View
      className="absolute overflow-visible rounded-[4] border-2 border-blue-400"
      style={[animatedStyle, { backgroundColor: event.category?.color || '#3B82F6' }]}>
      <GestureDetector gesture={panGesture}>
        <Animated.View className="absolute inset-0 p-1">
          <Text className="text-xs text-white">{event.title}</Text>
        </Animated.View>
      </GestureDetector>

      {/* Resize Handles */}
      <GestureDetector gesture={resizeTopGesture}>
        <View className="absolute left-0 right-0 top-[-10] flex h-[20] flex-row items-center justify-start">
          <View className="ms-[4] h-[12] w-[12] rounded-full bg-blue-500" />
        </View>
      </GestureDetector>

      <GestureDetector gesture={resizeBottomGesture}>
        <View className="absolute bottom-[-10] left-0 right-0 flex h-[20] flex-row items-center justify-end">
          <View className="me-[4] h-[12] w-[12] rounded-full bg-blue-500" />
        </View>
      </GestureDetector>

      {/* Close/Deselect Button could be external or a small x here */}
    </Animated.View>
  );
}
