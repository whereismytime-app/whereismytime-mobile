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
    - Home: `src/app/(drawer)/index.tsx`
    - Tabs: `src/app/(drawer)/(tabs)/`
  - Modal: `src/app/modal.tsx`

### State Management

- **Zustand store** in `src/store/store.ts` - currently has sample "bears" state, likely to be replaced with app-specific state
- **Firebase Auth state** managed by `GoogleAuthProvider` context

### Authentication

- Firebase Authentication with Google Sign-in configured in `src/components/GoogleAuthProvider.tsx`
- Google OAuth requires Calendar API access (`https://www.googleapis.com/auth/calendar.events`)
- Client ID configured for both iOS and Android platforms
- **Auth Flow**: Unauthenticated users see `src/app/auth.tsx` with centered logo and Google Sign In button
- **Protected Routes**: Main app content is only accessible after authentication
- Home screen (`src/app/(drawer)/index.tsx`) displays personalized welcome message

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
- `src/components/` - Reusable React components
- `src/store/` - Zustand state management
- `src/global.css` - NativeWind/Tailwind global styles

## Important Notes

- The app uses Firebase's legacy API mode (`RNFB_MODULAR_DEPRECATION_STRICT_MODE = false`)
- TypeScript paths configured: `~/*` (project root) and `@/*` (src directory)
- Google Sign-in requires Play Services on Android
- Splash screen configured with custom logo and dark mode support
- Metro config processes CSS from `src/global.css` for NativeWind styling
