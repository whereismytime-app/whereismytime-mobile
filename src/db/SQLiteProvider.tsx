import migrations from '@/db/drizzle/migrations';
import * as schema from '@/db/schema';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import {
  SQLiteProvider as ExpoSQLiteProvider,
  SQLiteDatabase,
  useSQLiteContext,
} from 'expo-sqlite';
import { createContext, useContext } from 'react';

const DATABASE_NAME = 'main';

type DrizzleContextValue = {
  isReady: boolean;
  drizzle: ExpoSQLiteDatabase<typeof schema> & {
    $client: SQLiteDatabase;
  };
} | null;
const DrizzleContext = createContext<DrizzleContextValue>(null);

export function DrizzleProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  useDrizzleStudio(db);
  const drizzleDb = drizzle(db, { schema });

  // TODO: Make use of the migrations statuses.
  const { success, error } = useMigrations(drizzleDb, migrations);

  return (
    <DrizzleContext.Provider
      value={{
        isReady: success && !error,
        drizzle: drizzleDb,
      }}>
      {children}
    </DrizzleContext.Provider>
  );
}

export function SQLiteProvider({ children }: { children: React.ReactNode }) {
  return (
    <ExpoSQLiteProvider
      databaseName={DATABASE_NAME}
      options={{
        enableChangeListener: false,
      }}>
      <DrizzleProvider>{children}</DrizzleProvider>
    </ExpoSQLiteProvider>
  );
}

export const useDrizzle = () => {
  const context = useContext(DrizzleContext);
  if (!context) {
    throw new Error('useDrizzle must be used within a DrizzleProvider');
  }
  return context;
};
