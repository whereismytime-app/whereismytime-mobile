# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native mobile app called "whereismytime" built with Expo Router and TypeScript. The app integrates Firebase Authentication with Google Sign-in and uses Google Calendar API access. The purpose of this app is to log the user's time onto the Google Calendar and bring out reports. The app lets user to define a broad range of Categories and the events get mapped under them.

## Key Technologies

- **React Native** with **Expo** (managed workflow)
- **Expo Router** for file-based navigation
- **TypeScript** for type safety
- **NativeWind** (Tailwind CSS for React Native)
- **Firebase Auth** with Google Sign-in integration
- **Zustand** for state management
- **DrizzleORM** with **expo-sqlite** for local database management
- **EAS** for builds and deployment

## Development Commands

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run linting and formatting checks
npm run lint

# Auto-fix linting and formatting issues
npm run format

# Create development build
npm run build:dev

# Create preview build
npm run build:preview

# Create production build
npm run build:prod

# Prebuild native code
npm run prebuild
```

## Architecture

### Navigation Structure

- **Stack Navigator** (root): `src/app/_layout.tsx` - conditionally renders screens based on auth state
  - **Auth Screen**: `src/app/auth.tsx` - shown when user is not authenticated
  - **Drawer Navigator**: `src/app/(drawer)/_layout.tsx` - shown when user is authenticated
    - Home: `src/app/(drawer)/index.tsx` - includes calendar sync interface and progress tracking
    - Categories: `src/app/(drawer)/categories.tsx` - categories management with n-level nesting
    - Tabs: `src/app/(drawer)/(tabs)/`
  - Modal: `src/app/modal.tsx`
- **Provider Hierarchy**: `SQLiteProvider` → `GoogleAuthProvider` → `CalendarSyncProvider` → App Components

### State Management

- **Zustand store** in `src/store/store.ts` - currently has sample "bears" state, likely to be replaced with app-specific state
- **Firebase Auth state** managed by `GoogleAuthProvider` context
- **Calendar sync state** managed by `CalendarSyncProvider` context with progress tracking

### Database Management

- **DrizzleORM** with **expo-sqlite** for local data storage
- Database schema defined in `src/db/schema.ts` with three main entities:
  - **Calendars**: Stores Google Calendar information with sync tokens and `lastSyncAt` timestamp
  - **Events**: Calendar events with effective duration calculations for overlapping events
  - **Categories**: User-defined categories with rules for automatic event mapping and n-level hierarchical nesting
- Database migrations managed in `src/db/drizzle/` directory
- Drizzle configuration in `drizzle.config.ts` using SQLite dialect with Expo driver
- Type definitions exported from schema: `DBCalendar`, `DBEvent`, `Category`
- Category rules support regex matching and calendar-based filtering (defined in `src/types/category_rule.ts`)
- Database context provider in `src/db/SQLiteProvider.tsx` with `DrizzleDB` type export

### Authentication

- Firebase Authentication with Google Sign-in configured in `src/components/GoogleAuthProvider.tsx`
- Google OAuth requires Calendar API access (`https://www.googleapis.com/auth/calendar.events`)
- Client ID configured for both iOS and Android platforms
- **Auth Flow**: Unauthenticated users see `src/app/auth.tsx` with centered logo and Google Sign In button
- **Protected Routes**: Main app content is only accessible after authentication
- Home screen (`src/app/(drawer)/index.tsx`) displays personalized welcome message and calendar sync interface

### Google Calendar Integration

- **Google Calendar Client** in `src/integrations/google_calendar/index.ts`:
  - Fetches calendars and events using Google Calendar API v3
  - Supports pagination with `pageToken` and incremental sync with `syncToken`
  - Handles OAuth token management via Google Sign-in
- **Calendar Sync Service** in `src/services/CalendarSyncService.ts`:
  - Class-based service for comprehensive calendar and event synchronization
  - UPSERT operations for calendars and events using Drizzle ORM
  - Progress tracking with detailed sync status, percentages, and current operations
  - Incremental sync using Google's sync tokens to minimize API calls
  - Error handling with detailed error reporting
  - Simple duration calculation (end time - start time) for events
  - Supports manual calendar selection (interface ready, implementation deferred)
- **Calendar Sync Provider** in `src/components/CalendarSyncProvider.tsx`:
  - React context providing sync functionality throughout the app
  - Real-time progress tracking with `SyncProgress` interface
  - Last sync information including timestamp, counts, and errors
  - Auto-sync capability on authentication (configurable)
  - Integration with both Google Auth and Database contexts

### Categories Management

- **CategoryService** in `src/services/CategoryService.ts`:
  - Complete CRUD operations for categories with n-level hierarchical nesting
  - Circular reference prevention for parent-child relationships
  - Tree operations: get category trees, paths, search, and move categories
  - Priority-based sorting and depth calculations
  - Safe deletion with child category validation
- **Categories Management UI** in `src/components/CategoriesManagement.tsx`:
  - Hierarchical tree display with visual indentation and expand/collapse functionality
  - Inline actions for add child, edit, and delete operations
  - Modal forms for creating and editing categories with color picker and priority settings
  - Real-time category tree updates with proper state management
  - Empty state handling and error management
- **Navigation Integration**: Categories accessible from drawer menu with folder icon

### Styling

- NativeWind (Tailwind for React Native) configured in `tailwind.config.js`
- Global styles in `src/global.css`
- Content scanned from `src/**/*.{js,ts,tsx}` (includes app and components)
- Metro configured to process CSS from `src/global.css`

### Build Configuration

- EAS build profiles in `eas.json` (development, preview, production)
- Firebase configuration files: `GoogleService-Info.plist` (iOS) and `google-services.json` (Android)
- Bundle identifiers: `com.fahimalizain.whereismytime`

## Project Structure

All source code is organized under the `src/` directory:
- `src/app/` - Expo Router navigation screens
- `src/components/` - Reusable React components and providers
- `src/services/` - Business logic and service classes
- `src/integrations/` - External API integrations (Google Calendar)
- `src/store/` - Zustand state management
- `src/db/` - Database schema and migrations using DrizzleORM
- `src/types/` - TypeScript type definitions
- `src/polyfill/` - Polyfills for React Native compatibility
- `src/global.css` - NativeWind/Tailwind global styles

## Important Notes

- The app uses Firebase's legacy API mode (`RNFB_MODULAR_DEPRECATION_STRICT_MODE = false`)
- TypeScript paths configured: `~/*` (project root) and `@/*` (src directory)
- Google Sign-in requires Play Services on Android
- Splash screen configured with custom logo and dark mode support
- Metro config processes CSS from `src/global.css` for NativeWind styling
- **Crypto polyfill** imported in `src/db/schema.ts` (`@/polyfill/crypto`) for React Native compatibility with nanoid
