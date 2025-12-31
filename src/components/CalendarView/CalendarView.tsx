import type { ViewMode } from '@/components/drawer/CustomDrawerContent';
import { Canvas, Group, Path, Skia, useFont } from '@shopify/react-native-skia';
import { useContextBridge } from 'its-fine';
import { memo, useEffect, useMemo, useState } from 'react';
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
import { CalendarDayColumns } from './CalendarDayColumns';
import { CalendarViewEventsProvider } from './CalendarViewEventsProvider';
import {
  DAY_HEADER_HEIGHT,
  DEFAULT_HOUR_HEIGHT,
  HOURS_IN_DAY,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  SCROLL_TODAY_INDEX,
  SCROLL_TOTAL_DAYS,
  TIME_AXIS_WIDTH,
} from './constants';
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

  // Pinch state values
  const startScrollY = useSharedValue(0);
  const startFocalY = useSharedValue(0);
  const startHourHeight = useSharedValue(0);

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
    });

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
          <GestureDetector gesture={pinchGesture}>
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
                      />
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
        )}
      </View>
    </GestureHandlerRootView>
  );
});
