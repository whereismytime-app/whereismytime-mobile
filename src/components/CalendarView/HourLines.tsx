import React, { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';

interface HourLinesProps {
  hourHeight: SharedValue<number>;
  calendarWidth: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const HourLines = memo(function HourLines({ hourHeight, calendarWidth }: HourLinesProps) {
  return (
    <View
      className="pointer-events-none absolute bottom-0 left-0 right-0 top-0"
      style={{ left: 50, top: 60 }} // Offset by TIME_AXIS_WIDTH and DAY_HEADER_HEIGHT
    >
      {HOURS.map((hour) => (
        <HourLine key={hour} hourHeight={hourHeight} />
      ))}
    </View>
  );
});

interface HourLineProps {
  hourHeight: SharedValue<number>;
}

const HourLine = memo(function HourLine({ hourHeight }: HourLineProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    height: hourHeight.value,
  }));

  return <Animated.View style={animatedStyle} className="border-b border-gray-100" />;
});
