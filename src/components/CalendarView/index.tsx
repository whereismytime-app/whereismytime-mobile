import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, VirtualizedList, LayoutChangeEvent } from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, clamp } from 'react-native-reanimated';
import type { ViewMode } from '@/components/drawer/CustomDrawerContent';
import { TimeAxis, TIME_AXIS_WIDTH } from './TimeAxis';
import { DayColumn, DAY_HEADER_HEIGHT } from './DayColumn';
import { CalendarViewEventsProvider } from './CalendarViewEventsProvider';
import { HourLines } from './HourLines';

interface CalendarViewProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const HOURS_IN_DAY = 24;
const MIN_HOUR_HEIGHT = 40;
const MAX_HOUR_HEIGHT = 180;
const DEFAULT_HOUR_HEIGHT = 60;

const INFINITE_COUNT = 100000; // Effectively infinite
const TODAY_INDEX = Math.floor(INFINITE_COUNT / 2);

export function CalendarView({ viewMode }: CalendarViewProps) {
  console.info('Rendering CalendarView with viewMode:', viewMode);
  // Shared values for pinch-to-zoom
  const hourHeight = useSharedValue(DEFAULT_HOUR_HEIGHT);
  const savedScale = useSharedValue(1);

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

  // Container Layout Width
  const listRef = useRef<VirtualizedList<any>>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const handleContainerLayoutChange = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  // Calculate column width once container is measured
  const columnWidth = useMemo(() => {
    if (containerWidth === null) return 0;
    // Having it rounded improves VirtualizedList performance by alot
    return Math.ceil((containerWidth - TIME_AXIS_WIDTH) / numDays);
  }, [containerWidth, numDays]);

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
      // Optional: snap to nearest reasonable value
    });

  // Animated style for the calendar content
  const animatedContentStyle = useAnimatedStyle(() => ({
    height: HOURS_IN_DAY * hourHeight.value,
  }));

  const renderDayColumn = useCallback(
    ({ item: dateKey }: { item: string }) => {
      return (
        <DayColumn
          key={dateKey}
          dateKey={dateKey}
          hourHeight={hourHeight}
          isToday={dateKey === new Date().toISOString().split('T')[0]}
          columnWidth={columnWidth}
        />
      );
    },
    [columnWidth, hourHeight]
  );

  useEffect(() => {
    if (columnWidth === 0) return;
    // Use setTimeout to ensure the list is mounted and measured
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: TODAY_INDEX,
        animated: false,
      });
    }, 0);
    console.info('CalendarView mounted, scrolling to today index', { TODAY_INDEX, columnWidth });
    return () => clearTimeout(timer);
  }, [columnWidth]);

  return (
    <CalendarViewEventsProvider>
      <GestureHandlerRootView className="flex-1">
        <View className="flex-1 bg-gray-50">
          {/* Calendar Content */}
          <GestureDetector gesture={pinchGesture}>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={true} bounces={true}>
              <Animated.View
                style={animatedContentStyle}
                className="flex-row"
                onLayout={handleContainerLayoutChange}>
                {/* Time Axis */}
                <TimeAxis hourHeight={hourHeight} marginTop={DAY_HEADER_HEIGHT} />

                {/* Hour Lines Overlay */}
                {containerWidth && (
                  <HourLines hourHeight={hourHeight} calendarWidth={containerWidth} />
                )}

                {/* Day Columns */}
                {columnWidth > 0 && (
                  <VirtualizedList
                    ref={listRef}
                    horizontal
                    initialNumToRender={5}
                    maxToRenderPerBatch={3}
                    windowSize={numDays + 3}
                    showsHorizontalScrollIndicator={false}
                    getItemCount={() => INFINITE_COUNT}
                    getItem={(data: unknown, index: number) => {
                      const daysFromToday = index - TODAY_INDEX;
                      const date = new Date();
                      date.setDate(date.getDate() + daysFromToday);
                      return date.toISOString().split('T')[0];
                    }}
                    keyExtractor={(item, _) => item}
                    initialScrollIndex={TODAY_INDEX}
                    getItemLayout={(_, index) => ({
                      length: columnWidth,
                      offset: columnWidth * index,
                      index,
                    })}
                    renderItem={renderDayColumn}
                  />
                )}
              </Animated.View>
            </ScrollView>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </CalendarViewEventsProvider>
  );
}
