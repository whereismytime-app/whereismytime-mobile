import { ActivityIndicator, Button, Text, View } from 'react-native';

import { useCalendarSync } from '@/components/CalendarSyncProvider';
import { useGoogleAuth } from '@/components/GoogleAuthProvider';
import { useState } from 'react';

const SyncCalendarsButton = () => {
  const { isLoading: isGoogleAuthLoading } = useGoogleAuth();
  const [syncType, setSyncType] = useState<'normal' | 'force'>('normal');

  const { progress, lastSyncInfo, isInitialized, syncAllCalendars } = useCalendarSync();

  const handleSync = async () => {
    try {
      setSyncType('normal');
      await syncAllCalendars();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const forceResync = async () => {
    try {
      setSyncType('force');
      await syncAllCalendars(true);
    } catch (error) {
      console.error('Force re-sync failed:', error);
    }
  };

  return (
    <View className="mb-6">
      <Text className="mb-2 text-base font-bold">Calendar Sync</Text>

      {!isInitialized ? (
        <Text className="text-gray-600">Initializing sync service...</Text>
      ) : (
        <View>
          <Button
            disabled={isGoogleAuthLoading || progress.status !== 'idle'}
            onPress={handleSync}
            title={
              progress.status !== 'idle' && syncType === 'normal' ? 'Syncing...' : 'Sync Calendars'
            }
          />
          <Button
            disabled={isGoogleAuthLoading || progress.status !== 'idle'}
            onPress={forceResync}
            title={
              progress.status !== 'idle' && syncType === 'force'
                ? 'Syncing...'
                : 'Force Re-Sync All'
            }
          />

          {progress.status !== 'idle' && (
            <View className="mt-2">
              <ActivityIndicator size="small" />
              <Text className="text-sm text-gray-600">
                {progress.status === 'syncing_calendars'
                  ? 'Syncing calendars...'
                  : 'Syncing events...'}
              </Text>
              {progress.currentCalendar && (
                <Text className="text-xs text-gray-500">Current: {progress.currentCalendar}</Text>
              )}
              <Text className="text-xs text-gray-500">
                {Math.round(progress.percentage)}% complete
              </Text>
              {progress.status && (
                <Text className="text-xs text-gray-500">Status: {progress.status}</Text>
              )}
            </View>
          )}

          {lastSyncInfo && (
            <View className="mt-3 rounded bg-gray-100 p-2">
              <Text className="text-sm font-medium">Last Sync:</Text>
              <Text className="text-xs text-gray-600">
                {lastSyncInfo.timestamp.toLocaleString()}
              </Text>
              <Text className="text-xs text-gray-600">
                Calendars: {lastSyncInfo.calendarsSynced}, Events: {lastSyncInfo.eventsSynced}
              </Text>
              {lastSyncInfo.errors.length > 0 && (
                <Text className="text-xs text-red-600">Errors: {lastSyncInfo.errors.length}</Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default SyncCalendarsButton;
