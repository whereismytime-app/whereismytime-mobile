import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { TIME_AXIS_WIDTH, DAY_HEADER_HEIGHT } from './common';

interface TimeAxisProps {
  hourHeight: SharedValue<number>;
  marginTop: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const TimeAxis = memo(function TimeAxis({ hourHeight, marginTop }: TimeAxisProps) {
  return (
    <View
      style={{ width: TIME_AXIS_WIDTH, marginTop }}
      className="border-r border-gray-200 bg-gray-50">
      {HOURS.map((hour) => (
        <TimeSlot key={hour} hour={hour} hourHeight={hourHeight} />
      ))}
    </View>
  );
});

interface TimeSlotProps {
  hour: number;
  hourHeight: SharedValue<number>;
}

function TimeSlot({ hour, hourHeight }: TimeSlotProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    height: hourHeight.value,
  }));

  const formattedHour = useMemo(() => {
    if (hour === 0) return ''; // 12 AM label is omitted for cleaner look
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }, [hour]);

  return (
    <Animated.View style={animatedStyle} className="justify-start px-1">
      <Text className="-mt-2 text-right text-xs text-gray-400">{formattedHour}</Text>
    </Animated.View>
  );
}

export function TimeAxisHeaderMask() {
  /* Time Axis Header Mask - Masks the time axis when scrolling up */
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: TIME_AXIS_WIDTH,
        height: DAY_HEADER_HEIGHT,
        zIndex: 50,
      }}
      className="border-r border-gray-200 bg-white"
    />
  );
}
