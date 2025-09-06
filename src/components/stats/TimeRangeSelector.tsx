import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface TimeRangeSelectorProps {
  timeRangeType: 'weekly' | 'monthly' | 'annually' | 'period';
  displayText: string;
  customStart: Date;
  customEnd: Date;
  onTypeChange: (type: 'weekly' | 'monthly' | 'annually' | 'period') => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onCustomDatesChange: (start: Date, end: Date) => void;
}

export function TimeRangeSelector({
  timeRangeType,
  displayText,
  customStart,
  customEnd,
  onTypeChange,
  onNavigate,
  onCustomDatesChange,
}: TimeRangeSelectorProps) {
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const timeRangeOptions = [
    { value: 'weekly' as const, label: 'Weekly' },
    { value: 'monthly' as const, label: 'Monthly' },
    { value: 'annually' as const, label: 'Annually' },
    { value: 'period' as const, label: 'Period' },
  ];

  const handleTypeSelect = (type: 'weekly' | 'monthly' | 'annually' | 'period') => {
    onTypeChange(type);
    setShowTypeSelector(false);
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      onCustomDatesChange(selectedDate, customEnd);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      onCustomDatesChange(customStart, selectedDate);
    }
  };

  const getCurrentTypeLabel = () => {
    return timeRangeOptions.find((option) => option.value === timeRangeType)?.label || 'Monthly';
  };

  const showNavigationButtons = timeRangeType !== 'period';

  return (
    <View className="space-y-4">
      {/* Time Range Type Selector */}
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-700">Time Range</Text>
        <TouchableOpacity
          onPress={() => setShowTypeSelector(true)}
          className="flex-row items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <Text className="text-sm font-medium text-gray-900">{getCurrentTypeLabel()}</Text>
          <Ionicons name="chevron-down" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Navigation Controls */}
      {showNavigationButtons && (
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => onNavigate('prev')}
            className="rounded-lg bg-gray-50 p-2">
            <Ionicons name="chevron-back" size={20} color="#374151" />
          </TouchableOpacity>

          <Text className="flex-1 text-center text-lg font-semibold text-gray-900">
            {displayText}
          </Text>

          <TouchableOpacity
            onPress={() => onNavigate('next')}
            className="rounded-lg bg-gray-50 p-2">
            <Ionicons name="chevron-forward" size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      )}

      {/* Period Date Selectors */}
      {timeRangeType === 'period' && (
        <View className="space-y-3">
          {/* <Text className="text-lg font-semibold text-gray-900 text-center">
            {displayText}
          </Text> */}

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="mb-2 text-sm font-medium text-gray-700">From</Text>
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(true)}
                className="rounded-lg bg-gray-50 p-3">
                <Text className="text-sm text-gray-900">
                  {customStart.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-1">
              <Text className="mb-2 text-sm font-medium text-gray-700">To</Text>
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(true)}
                className="rounded-lg bg-gray-50 p-3">
                <Text className="text-sm text-gray-900">
                  {customEnd.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Type Selector Modal */}
      <Modal
        visible={showTypeSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeSelector(false)}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="m-4 min-w-[250px] max-w-[300px] rounded-lg bg-white">
            <View className="border-b border-gray-200 p-4">
              <Text className="text-lg font-semibold text-gray-900">Select Time Range</Text>
            </View>

            <View className="p-2">
              {timeRangeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleTypeSelect(option.value)}
                  className={`rounded-lg p-3 ${
                    timeRangeType === option.value ? 'bg-blue-50' : 'bg-transparent'
                  }`}>
                  <Text
                    className={`text-base ${
                      timeRangeType === option.value ? 'font-medium text-blue-600' : 'text-gray-900'
                    }`}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="border-t border-gray-200 p-4">
              <TouchableOpacity
                onPress={() => setShowTypeSelector(false)}
                className="rounded-lg bg-gray-50 p-2">
                <Text className="text-center text-base text-gray-700">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={customStart}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={customEnd}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
        />
      )}
    </View>
  );
}
