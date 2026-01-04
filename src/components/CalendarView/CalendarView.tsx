import type { ViewMode } from '@/components/drawer/CustomDrawerContent';
import { Canvas, Group, Path, Skia, useFont } from '@shopify/react-native-skia';
import { useContextBridge } from 'its-fine';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  scrollTo,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CalendarDayColumns } from './CalendarDayColumns';
import { CalendarViewEventsProvider, useCalendarViewData } from './CalendarViewEventsProvider';
import {
  DAY_HEADER_HEIGHT,
  DEFAULT_HOUR_HEIGHT,
  EventBlockData,
  HOURS_IN_DAY,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  SCROLL_TODAY_INDEX,
  SCROLL_TOTAL_DAYS,
  TIME_AXIS_WIDTH,
  SelectedEvent,
} from './common';
import {
  SkiaEventReschedulerRenderer,
  SkiaEventReschedulerGestureOverlay,
} from './SkiaEventRescheduler';
import { TimeAxis, TimeAxisHeaderMask } from './TimeAxis';

interface CalendarViewProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function CalendarView(props: CalendarViewProps) {
  return (
    <CalendarViewEventsProvider>
      <CalendarViewContent {...props} />
    </CalendarViewEventsProvider>
  );
}

const CalendarViewContent = memo(function CalendarViewContent({ viewMode }: CalendarViewProps) {
  console.info('Rendering CalendarView with viewMode:', viewMode);
  const Bridge = useContextBridge();
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();

  // Shared values for pinch-to-zoom
  const hourHeight = useSharedValue(DEFAULT_HOUR_HEIGHT);
  const savedScale = useSharedValue(1);
  const columnWidth = useSharedValue(0);
  const scrollX = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const selectedEventShared = useSharedValue<SelectedEvent | null>(null);

  // Pinch state values
  const startScrollY = useSharedValue(0);
  const startFocalY = useSharedValue(0);
  const startHourHeight = useSharedValue(0);

  // Event rescheduler state (shared between Skia renderer and gesture overlay)
  const reschedulerStartMinutes = useSharedValue(0);
  const reschedulerDurationMinutes = useSharedValue(0);
  const reschedulerDragMode = useSharedValue<'none' | 'move' | 'resize-top' | 'resize-bottom'>(
    'none'
  );

  // const { selectedEvent, setSelectedEvent } = useCalendarViewData();
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [columnWidthReact, setColumnWidthReact] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [isColumnWidthSet, setIsColumnWidthSet] = useState(false);

  // Get number of days to display based on view mode
  const numDays = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return 1;
      case '3day':
        return 3;
      case '5day':
        return 5;
      default:
        return 1;
    }
  }, [viewMode]);

  // Calculate column width once container is measured
  useEffect(() => {
    if (containerWidth === null) return;
    const newColumnWidth = PixelRatio.roundToNearestPixel(
      (containerWidth - TIME_AXIS_WIDTH) / numDays
    );
    columnWidth.value = newColumnWidth;
    setColumnWidthReact(newColumnWidth);
    setIsColumnWidthSet(true);
  }, [containerWidth, numDays, columnWidth]);

  // Sync selectedEventShared AFTER React has rendered the rescheduler
  // This ensures EventBlock hides only when the rescheduler is already visible
  useEffect(() => {
    if (selectedEvent) {
      // Rescheduler values already set in checkEventClick
      // Now that React has rendered SkiaEventReschedulerRenderer, hide the original EventBlock
      selectedEventShared.value = selectedEvent;
    } else {
      selectedEventShared.value = null;
    }
  }, [selectedEvent, selectedEventShared]);

  // Update visible index to trigger React re-renders for the "Window"
  const onScrollX = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onScrollY = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Pinch gesture handler
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = hourHeight.value / DEFAULT_HOUR_HEIGHT;
      startScrollY.value = scrollY.value;
      startFocalY.value = e.focalY;
      startHourHeight.value = hourHeight.value;
    })
    .onUpdate((e) => {
      // 1. Update zoom level
      const newHeight = clamp(
        e.scale * savedScale.value * DEFAULT_HOUR_HEIGHT,
        MIN_HOUR_HEIGHT,
        MAX_HOUR_HEIGHT
      );
      hourHeight.value = newHeight;

      // 2. Adjust scroll to keep focal point stable
      // Calculate time at the focal point (relative to content start)
      // timeAtFocal = (distance from top of content to finger) / totalHeight
      // But simpler: (scrollY + focalY - HEADER) is the pixel distance in the "time" area
      const relativeYAtStart = startScrollY.value + startFocalY.value - DAY_HEADER_HEIGHT;

      // Calculate the "time ratio" (how far down the day we are at the focal point)
      // using the START height
      const timeRatio = relativeYAtStart / startHourHeight.value;

      // Now calculate where that same time point is with the NEW height
      const newRelativeY = timeRatio * newHeight;

      // The new scrollY should position that point back under the focalY
      // newScrollY + focalY - HEADER = newRelativeY
      // newScrollY = newRelativeY - focalY + HEADER
      const targetScrollY = newRelativeY - e.focalY + DAY_HEADER_HEIGHT;

      scrollTo(scrollViewRef, 0, targetScrollY, false);
    })
    .onEnd(() => {
      // Animate to nearest 5px for hour height
      const snappedHeight = Math.round(hourHeight.value / 5) * 5;
      hourHeight.value = withTiming(snappedHeight, { duration: 1000 });
      hourHeight.value = withTiming(snappedHeight, { duration: 1000 });
    });

  const { getEventsForDate, updateEvent } = useCalendarViewData();

  const handleEventUpdate = useCallback(
    async (id: string, start: Date, end: Date) => {
      console.info(
        'Updating Event',
        id,
        start.toDateString(),
        start.toTimeString(),
        end.toTimeString()
      );
      // await updateEvent(id, start, end);
      // Keep selected? Update local state if needed or deselect.
      // Ideally we update the selected event data to match new position so it doesn't jump back
      // But since the render cycle will refresh the data, we might just need to rely on that.
      // However, if we deselect, the overlay goes away.
      // Let's keep selected but we'd need to update the `data` in `selectedEvent`.
      // For now, let's just log and rely on props change?
      // Actually, if we update DB, the query hooks run, the underlying Skia view updates.
      // The `selectedEvent` state holds a SNAPSHOT of the event at tap time.
      // If we want the overlay to persist at the new position, we should update the snapshot.
      // setSelectedEvent((prev) => {
      //   if (!prev || prev.data.id !== id) return prev;
      //   return {
      //     ...prev,
      //     data: {
      //       ...prev.data,
      //       start,
      //       end,
      //       // width stays same? calculated width might change if overlaps change...
      //       // This is tricky. If we drop it, it might now overlap with something else.
      //       // Recalculating layout is complex here.
      //       // Simplest UX: Deselect on drop.
      //     },
      //   };
      // });
      // Actually, let's deselect for now to avoid layout sync issues until we have a better way
      // to re-select the updated event from the fresh layout data.
      // setSelectedEvent(null);
    },
    [updateEvent]
  );

  const checkEventClick = useCallback(
    (dateKey: string, minutes: number, normalizedColumnX: number, dayIndex: number) => {
      try {
        console.info(
          'checkEventClick / Trying to get events on',
          dateKey,
          minutes,
          normalizedColumnX,
          dayIndex
        );
        const events = getEventsForDate(dateKey);
        console.info('checkEventClick / Got events:', 0);
        if (!events) return;

        // Create base date for the clicked day to match usage in CalendarViewEventsProvider
        const baseDate = new Date(dateKey);
        baseDate.setHours(0, 0, 0, 0);

        // Calculate timestamp of the tap
        const tapTime = baseDate.getTime() + minutes * 60 * 1000;

        // Search in reverse order to find the "top-most" event (rendered last)
        let clickedEvent: EventBlockData | undefined;
        for (let i = events.length - 1; i >= 0; i--) {
          const e = events[i];
          if (!e.start || !e.end) continue;

          // Check time overlap
          const start = e.start.getTime();
          const end = e.end.getTime();
          const matchesTime = tapTime >= start && tapTime < end;

          // Check horizontal overlap
          // Events are rendered from (1 - width) to 1 (ignoring padding)
          const startX = 1 - e.width;
          const endX = 1;
          const matchesX = normalizedColumnX >= startX && normalizedColumnX <= endX;

          if (matchesTime && matchesX) {
            clickedEvent = e;
            break;
          }
        }

        if (clickedEvent) {
          console.log(
            'Clicked Event:',
            clickedEvent.title,
            clickedEvent.start?.toLocaleTimeString(),
            clickedEvent.end?.toLocaleTimeString()
          );

          // Initialize rescheduler shared values IMMEDIATELY (before React state update)
          // This ensures Skia renders the editing block without waiting for JS thread
          const start = clickedEvent.start!;
          const end = clickedEvent.end!;
          reschedulerStartMinutes.value = start.getHours() * 60 + start.getMinutes();
          reschedulerDurationMinutes.value = (end.getTime() - start.getTime()) / 60000;
          reschedulerDragMode.value = 'none';

          const value = {
            data: clickedEvent,
            dateKey,
            dayIndex,
          };
          // Don't set selectedEventShared here - let useEffect do it after React renders
          // This ensures SkiaEventReschedulerRenderer is visible before EventBlock hides
          setSelectedEvent(value);
        } else {
          // Deselect if clicked empty space
          setSelectedEvent(null);
        }
      } catch (e) {
        console.error('Error handling event click:', e);
      }
    },
    [
      getEventsForDate,
      setSelectedEvent,
      reschedulerStartMinutes,
      reschedulerDurationMinutes,
      reschedulerDragMode,
    ]
  );

  const handleTap = (x: number, y: number) => {
    'worklet';
    // 1. Calculate "Grid" coordinates (relative to the scrollable content)
    // The canvas is translated by -scrollX and -scrollY
    // So worldX = localX + scrollX
    // However, the touch event is already in the coordinate space of the container (GestureDetector view)
    // The "TimeAxis" takes up space on the left.

    // Adjust for TimeAxis
    const gridX = x - TIME_AXIS_WIDTH + scrollX.value;
    const gridY = y + scrollY.value;

    // Check bounds
    if (gridX < 0 || gridY < DAY_HEADER_HEIGHT || columnWidth.value <= 0) return;

    // 2. Find Day Index
    const dayIndex = Math.floor(gridX / columnWidth.value);

    // 3. Find normalizedColumnX
    const normalizedColumnX = (gridX % columnWidth.value) / columnWidth.value;

    // Safety check for invalid calculations
    if (!Number.isFinite(dayIndex)) return;

    // 4. Find Time (Minutes from start of day)
    // y = (minutes / 60) * hourHeight + HEADER
    // minutes = (y - HEADER) / hourHeight * 60
    const minutes = ((gridY - DAY_HEADER_HEIGHT) / hourHeight.value) * 60;

    // 5. Get Date Key
    // Day Index 0 is "Today" (SCROLL_TODAY_INDEX)
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + (dayIndex - SCROLL_TODAY_INDEX));
    const dateKey = targetDate.toISOString().split('T')[0];

    console.log(
      `Tap at Day: ${dateKey} (${dayIndex}), Minutes: ${minutes}, normalizedColumnX: ${normalizedColumnX}`
    );

    // 6. Check Events on JS Thread
    scheduleOnRN(checkEventClick, dateKey, minutes, normalizedColumnX, dayIndex);
  };

  const tapGesture = Gesture.Tap().onEnd((e) => {
    handleTap(e.x, e.y);
  });

  const composedGesture = Gesture.Race(pinchGesture, tapGesture);

  const contentWidthStyle = useAnimatedStyle(() => ({
    width: columnWidth.value * SCROLL_TOTAL_DAYS,
  }));

  const contentOffset = useAnimatedProps(() => ({
    contentOffset: {
      x: SCROLL_TODAY_INDEX * columnWidth.value,
      y: 0,
    },
  }));

  const contentHeightStyle = useAnimatedStyle(() => ({
    height: HOURS_IN_DAY * hourHeight.value + DAY_HEADER_HEIGHT,
  }));

  // Canvas moves with both X and Y scroll
  const canvasTransform = useDerivedValue(() => [
    { translateX: -scrollX.value },
    { translateY: -scrollY.value },
  ]);

  // Build grid lines path
  const gridPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const totalWidth = columnWidth.value * SCROLL_TOTAL_DAYS;
    // Don't draw if width is 0 or not ready
    if (totalWidth <= 0) return path;

    for (let i = 0; i < HOURS_IN_DAY; i++) {
      const y = i * hourHeight.value + DAY_HEADER_HEIGHT;
      path.moveTo(0, y);
      path.lineTo(totalWidth, y);
    }
    return path;
  }, [columnWidth, hourHeight]);

  // Load font once at parent level to prevent flickering during virtualization
  const font = useFont(require('@/assets/fonts/Inter.ttf'), 12);
  const headerFont = useFont(require('@/assets/fonts/Inter.ttf'), 16);

  return (
    <GestureHandlerRootView className="flex-1">
      <View
        className="relative flex-1 bg-white"
        onLayout={(e) => {
          setContainerWidth(e.nativeEvent.layout.width);
          setContainerHeight(e.nativeEvent.layout.height);
        }}>
        {!isColumnWidthSet || !font || !headerFont || !containerHeight ? null : (
          <>
            <GestureDetector gesture={composedGesture}>
              <View className="flex-1">
                {/* Layer 1: Fixed Viewport Canvas */}
                <View
                  style={{
                    position: 'absolute',
                    left: TIME_AXIS_WIDTH,
                    right: 0,
                    bottom: 0,
                    height: containerHeight,
                  }}
                  pointerEvents="none">
                  <Canvas style={{ flex: 1 }}>
                    <Bridge>
                      <Group transform={canvasTransform}>
                        <Path path={gridPath} color="#F3F4F6" style="stroke" strokeWidth={1} />
                        <CalendarDayColumns
                          scrollX={scrollX}
                          scrollY={scrollY}
                          columnWidth={columnWidth}
                          numDays={numDays}
                          hourHeight={hourHeight}
                          font={font}
                          headerFont={headerFont}
                          selectedEvent={selectedEventShared}
                        />
                        {/* Render Skia-based event rescheduler */}
                        {selectedEvent && (
                          <SkiaEventReschedulerRenderer
                            event={selectedEvent.data}
                            dayIndex={selectedEvent.dayIndex}
                            columnWidth={columnWidth}
                            hourHeight={hourHeight}
                            startMinutes={reschedulerStartMinutes}
                            durationMinutes={reschedulerDurationMinutes}
                            dragMode={reschedulerDragMode}
                            font={font}
                          />
                        )}
                      </Group>
                    </Bridge>
                  </Canvas>
                </View>

                {/* Layer 2: Scroll Interaction */}
                <Animated.ScrollView
                  ref={scrollViewRef}
                  className="flex-1"
                  onScroll={onScrollY}
                  scrollEventThrottle={16}>
                  <View className="relative flex-row">
                    <TimeAxis hourHeight={hourHeight} marginTop={DAY_HEADER_HEIGHT} />

                    <Animated.View style={[{ flex: 1 }, contentHeightStyle]}>
                      <Animated.ScrollView
                        horizontal
                        onScroll={onScrollX}
                        scrollEventThrottle={16}
                        animatedProps={contentOffset}
                        style={StyleSheet.absoluteFill}
                        snapToInterval={columnWidthReact}
                        decelerationRate="fast"
                        snapToAlignment="start">
                        <Animated.View style={contentWidthStyle} />
                      </Animated.ScrollView>
                    </Animated.View>
                  </View>
                </Animated.ScrollView>

                {/* Layer 3: Fixed Overlays */}
                {/* Time Axis Header Mask - Masks the time axis when scrolling up */}
                <TimeAxisHeaderMask />
              </View>
            </GestureDetector>

            {/* Layer 4: Event Rescheduler Gesture Overlay - OUTSIDE parent GestureDetector */}
            {selectedEvent && (
              <View
                style={{
                  position: 'absolute',
                  left: TIME_AXIS_WIDTH,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
                pointerEvents="box-none">
                <SkiaEventReschedulerGestureOverlay
                  event={selectedEvent.data}
                  dayIndex={selectedEvent.dayIndex}
                  columnWidth={columnWidth}
                  hourHeight={hourHeight}
                  scrollX={scrollX}
                  scrollY={scrollY}
                  startMinutes={reschedulerStartMinutes}
                  durationMinutes={reschedulerDurationMinutes}
                  dragMode={reschedulerDragMode}
                  onUpdate={handleEventUpdate}
                  onCancel={() => setSelectedEvent(null)}
                />
              </View>
            )}
          </>
        )}
      </View>
    </GestureHandlerRootView>
  );
});
