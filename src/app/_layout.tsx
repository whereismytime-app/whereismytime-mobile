import '../global.css';

import { GoogleAuthProvider, useGoogleAuth } from '@/components/GoogleAuthProvider';
import { SplashScreenHandler } from '@/components/SplashScreen';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function AppNavigator() {
  const { isLoggedIn } = useGoogleAuth();

  return (
    <Stack>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ title: 'Modal', presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Screen name="auth" options={{ headerShown: false }} />
    </Stack>
  );
}

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(drawer)',
  // Show auth screen when not authenticated
  // initialRouteName: 'auth',
};

export default function RootLayout() {
  return (
    <GoogleAuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SplashScreenHandler />
        <AppNavigator />
      </GestureHandlerRootView>
    </GoogleAuthProvider>
  );
}
