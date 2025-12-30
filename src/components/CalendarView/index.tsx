import type { ViewMode } from '@/components/drawer/CustomDrawerContent';
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import { useContextBridge } from 'its-fine';
import { memo, useEffect, useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedProps,
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
  SCROLL_INITIAL_INDEX,
  SCROLL_TOTAL_DAYS,
  TIME_AXIS_WIDTH,
} from './constants';
import { TimeAxis } from './TimeAxis';

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

  // Shared values for pinch-to-zoom
  const hourHeight = useSharedValue(DEFAULT_HOUR_HEIGHT);
  const savedScale = useSharedValue(1);
  const columnWidth = useSharedValue(0);
  const scrollX = useSharedValue(0);
  const scrollY = useSharedValue(0);
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
    columnWidth.value = PixelRatio.roundToNearestPixel(
      (containerWidth - TIME_AXIS_WIDTH) / numDays
    );
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
    .onStart(() => {
      savedScale.value = hourHeight.value / DEFAULT_HOUR_HEIGHT;
    })
    .onUpdate((e) => {
      hourHeight.value = clamp(
        e.scale * savedScale.value * DEFAULT_HOUR_HEIGHT,
        MIN_HOUR_HEIGHT,
        MAX_HOUR_HEIGHT
      );
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
      x: SCROLL_INITIAL_INDEX * columnWidth.value,
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

  // Load font once at parent level to prevent flickering during virtualization
  const font = useFont(require('@/assets/fonts/Inter.ttf'), 12);

  return (
    <GestureHandlerRootView className="flex-1">
      <View
        className="relative flex-1 bg-white"
        onLayout={(e) => {
          setContainerWidth(e.nativeEvent.layout.width);
          setContainerHeight(e.nativeEvent.layout.height);
        }}>
        {!isColumnWidthSet || !font || !containerHeight ? null : (
          <GestureDetector gesture={pinchGesture}>
            <View className="flex-1">
              {/* Layer 1: Fixed Viewport Canvas */}
              <View
                style={{
                  position: 'absolute',
                  left: TIME_AXIS_WIDTH,
                  top: DAY_HEADER_HEIGHT,
                  right: 0,
                  bottom: 0,
                  height: containerHeight,
                }}
                pointerEvents="none">
                <Canvas style={{ flex: 1 }}>
                  <Bridge>
                    <Group transform={canvasTransform}>
                      <CalendarDayColumns
                        scrollX={scrollX}
                        columnWidth={columnWidth}
                        numDays={numDays}
                        hourHeight={hourHeight}
                        font={font}
                      />
                    </Group>
                  </Bridge>
                </Canvas>
              </View>

              {/* Layer 2: Scroll Interaction */}
              <Animated.ScrollView className="flex-1" onScroll={onScrollY} scrollEventThrottle={16}>
                <View className="flex-row">
                  <TimeAxis hourHeight={hourHeight} marginTop={DAY_HEADER_HEIGHT} />

                  <Animated.View style={[{ flex: 1 }, contentHeightStyle]}>
                    <Animated.ScrollView
                      horizontal
                      onScroll={onScrollX}
                      scrollEventThrottle={16}
                      animatedProps={contentOffset}
                      style={StyleSheet.absoluteFill}>
                      <Animated.View style={contentWidthStyle} />
                    </Animated.ScrollView>
                  </Animated.View>
                </View>
              </Animated.ScrollView>
            </View>
          </GestureDetector>
        )}
      </View>
    </GestureHandlerRootView>
  );
});
