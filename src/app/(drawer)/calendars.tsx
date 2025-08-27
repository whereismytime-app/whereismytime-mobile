import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Checkbox } from 'expo-checkbox';
import { MaterialIcons } from '@expo/vector-icons';
import { useDrizzle } from '@/db/SQLiteProvider';
import { CalendarManagementService } from '@/services/CalendarManagementService';
import { useCalendarSync } from '@/components/CalendarSyncProvider';
import { type DBCalendar } from '@/db/schema';

export default function CalendarsScreen() {
  const { drizzle, isReady } = useDrizzle();
  const { isInitialized } = useCalendarSync();
  const [calendars, setCalendars] = useState<DBCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarService] = useState(() => new CalendarManagementService(drizzle));

  // Load calendars
  useEffect(() => {
    const loadCalendars = async () => {
      if (!calendarService) return;

      try {
        setLoading(true);
        const calendarList = await calendarService.getCalendars();
        setCalendars(calendarList);
      } catch (error) {
        console.error('Failed to load calendars:', error);
        Alert.alert('Error', 'Failed to load calendars');
      } finally {
        setLoading(false);
      }
    };

    loadCalendars();
  }, [calendarService]);

  const handleToggleCalendar = async (calendarId: string) => {
    if (!calendarService) return;

    try {
      const newEnabledStatus = await calendarService.toggleCalendarEnabled(calendarId);

      // Update local state
      setCalendars((prevCalendars) =>
        prevCalendars.map((calendar) =>
          calendar.id === calendarId ? { ...calendar, enabled: newEnabledStatus } : calendar
        )
      );
    } catch (error) {
      console.error('Failed to toggle calendar:', error);
      Alert.alert('Error', 'Failed to update calendar status');
    }
  };

  if (!isReady || !isInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <MaterialIcons name="sync" size={48} color="#9CA3AF" />
        <Text className="mt-4 px-4 text-center text-gray-600">
          Initializing calendar management...
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <MaterialIcons name="sync" size={48} color="#9CA3AF" className="animate-spin" />
        <Text className="mt-4 text-gray-600">Loading calendars...</Text>
      </View>
    );
  }

  if (calendars.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <MaterialIcons name="event-available" size={64} color="#9CA3AF" />
        <Text className="mt-6 text-center text-xl font-semibold text-gray-800">
          No Calendars Found
        </Text>
        <Text className="mt-2 text-center leading-6 text-gray-600">
          Sync your Google Calendars first to manage them here. Go to the Home screen to start
          syncing.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="mb-2 text-2xl font-bold text-gray-900">Manage Calendars</Text>
        <Text className="mb-6 text-gray-600">
          Enable or disable calendars to control which events are synced and tracked.
        </Text>

        <View className="space-y-3">
          {calendars.map((calendar) => (
            <View
              key={calendar.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="mb-1 text-lg font-semibold text-gray-900">{calendar.title}</Text>
                  <View className="flex-row items-center">
                    <MaterialIcons name="schedule" size={16} color="#6B7280" />
                    <Text className="ml-1 text-sm text-gray-600">{calendar.timeZone}</Text>
                  </View>
                  {calendar.lastSyncAt && (
                    <View className="mt-1 flex-row items-center">
                      <MaterialIcons name="sync" size={16} color="#6B7280" />
                      <Text className="ml-1 text-sm text-gray-600">
                        Last synced: {new Date(calendar.lastSyncAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="ml-4">
                  <Checkbox
                    value={calendar.enabled || false}
                    onValueChange={() => handleToggleCalendar(calendar.id)}
                    color={calendar.enabled ? '#10B981' : '#D1D5DB'}
                  />
                </View>
              </View>

              <View className="mt-3 border-t border-gray-100 pt-3">
                <View className="flex-row items-center">
                  <View
                    className={`mr-2 h-3 w-3 rounded-full ${
                      calendar.enabled ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <Text
                    className={`text-sm font-medium ${
                      calendar.enabled ? 'text-green-700' : 'text-gray-600'
                    }`}>
                    {calendar.enabled ? 'Events are being tracked' : 'Events are not tracked'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <View className="flex-row items-start">
            <MaterialIcons name="info" size={20} color="#3B82F6" className="mt-0.5" />
            <View className="ml-3 flex-1">
              <Text className="mb-1 text-sm font-medium text-blue-900">How it works</Text>
              <Text className="text-sm leading-5 text-blue-700">
                Disabled calendars will not sync new events, but existing events remain in your
                data. Re-enable anytime to resume syncing.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
