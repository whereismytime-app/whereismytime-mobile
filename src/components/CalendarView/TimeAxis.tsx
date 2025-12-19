import React from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';

interface TimeAxisProps {
  hourHeight: SharedValue<number>;
  marginTop: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const TIME_AXIS_WIDTH = 50;

export function TimeAxis({ hourHeight, marginTop }: TimeAxisProps) {
  return (
    <View
      style={{ width: TIME_AXIS_WIDTH, marginTop }}
      className="border-r border-gray-200 bg-gray-50">
      {HOURS.map((hour) => (
        <TimeSlot key={hour} hour={hour} hourHeight={hourHeight} />
      ))}
    </View>
  );
}

interface TimeSlotProps {
  hour: number;
  hourHeight: SharedValue<number>;
}

function TimeSlot({ hour, hourHeight }: TimeSlotProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    height: hourHeight.value,
  }));

  const formatHour = (h: number) => {
    if (h === 0) return ''; // 12 AM label is omitted for cleaner look
    if (h === 12) return '12 PM';
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  };

  return (
    <Animated.View style={animatedStyle} className="justify-start border-b border-gray-100 px-1">
      <Text className="-mt-2 text-right text-xs text-gray-400">{formatHour(hour)}</Text>
    </Animated.View>
  );
}
