import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GoogleCalendarClient } from '@/integrations/google_calendar';
import {
  CalendarSyncService,
  SyncProgress,
  LastSyncInfo,
} from '@/services/calendar/CalendarSyncService';
import { useDrizzle } from '@/db/SQLiteProvider';
import { useGoogleAuth } from './GoogleAuthProvider';
import { CalendarService } from '../services/calendar/CalendarService';

interface CalendarSyncContextType {
  primaryTimezone: string;
  syncService: CalendarSyncService | null;
  progress: SyncProgress;
  lastSyncInfo: LastSyncInfo | undefined;
  isInitialized: boolean;
  syncAllCalendars: (forceResync?: boolean) => Promise<void>;
}

const CalendarSyncContext = createContext<CalendarSyncContextType | undefined>(undefined);

interface CalendarSyncProviderProps {
  children: ReactNode;
  autoSyncOnAuth?: boolean;
}

export function CalendarSyncProvider({
  children,
  autoSyncOnAuth = false,
}: CalendarSyncProviderProps) {
  const { isLoggedIn, user } = useGoogleAuth();
  const { drizzle, isReady: dbReady } = useDrizzle();

  const [syncService, setSyncService] = useState<CalendarSyncService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({
    status: 'idle',
    percentage: 0,
  });
  const [lastSyncInfo, setLastSyncInfo] = useState<LastSyncInfo | undefined>();
  const [primaryTimezone, setPrimaryTimezone] = useState<string>('UTC');

  // Initialize sync service when user is authenticated and database is ready
  useEffect(() => {
    const initializeSyncService = async () => {
      if (!isLoggedIn || !user || !dbReady) {
        setSyncService(null);
        setIsInitialized(false);
        return;
      }

      try {
        const googleClient = new GoogleCalendarClient();
        await googleClient.initialize();

        const service = new CalendarSyncService(googleClient, drizzle, (progressUpdate) => {
          setProgress(progressUpdate);
        });

        setSyncService(service);
        setIsInitialized(true);
        new CalendarService(drizzle).getPrimaryTimezone().then(setPrimaryTimezone);

        // Auto-sync if enabled
        if (autoSyncOnAuth) {
          try {
            await service.syncAllCalendars();
            setLastSyncInfo(service.getLastSyncInfo());
          } catch (error) {
            console.error('Auto-sync failed:', error);
          }
        }
      } catch (error) {
        console.error('Failed to initialize CalendarSyncService:', error);
        setSyncService(null);
        setIsInitialized(false);
      }
    };

    initializeSyncService();
  }, [isLoggedIn, user, dbReady, drizzle, autoSyncOnAuth]);

  const syncAllCalendars = async (forceResync?: boolean): Promise<void> => {
    if (!syncService) {
      throw new Error('Sync service not initialized');
    }

    try {
      if (forceResync) {
        // Reset existing calendars and events
        await syncService.resetCalendarsAndEvents();
      }

      await syncService.syncAllCalendars();
      setLastSyncInfo(syncService.getLastSyncInfo());
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  };

  const contextValue: CalendarSyncContextType = {
    syncService,
    progress,
    lastSyncInfo,
    isInitialized,
    syncAllCalendars,
    primaryTimezone,
  };

  return (
    <CalendarSyncContext.Provider value={contextValue}>{children}</CalendarSyncContext.Provider>
  );
}

export function useCalendarSync(): CalendarSyncContextType {
  const context = useContext(CalendarSyncContext);
  if (context === undefined) {
    throw new Error('useCalendarSync must be used within a CalendarSyncProvider');
  }
  return context;
}
