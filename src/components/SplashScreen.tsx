import * as SplashScreen from 'expo-splash-screen';
import { useGoogleAuth } from './GoogleAuthProvider';
import { useDrizzle } from '@/db/SQLiteProvider';

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

SplashScreen.preventAutoHideAsync();

export const SplashScreenHandler = () => {
  const { isLoading: isGoogleAuthLoading } = useGoogleAuth();
  const { isReady: isDrizzleReady } = useDrizzle();

  if (!isGoogleAuthLoading && isDrizzleReady) {
    SplashScreen.hide();
  }

  return null;
};
