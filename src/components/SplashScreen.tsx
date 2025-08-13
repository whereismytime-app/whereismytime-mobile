import * as SplashScreen from 'expo-splash-screen';
import { useGoogleAuth } from './GoogleAuthProvider';

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

SplashScreen.preventAutoHideAsync();

export const SplashScreenHandler = () => {
  const { isLoading } = useGoogleAuth();

  if (!isLoading) {
    SplashScreen.hide();
  }

  return null;
};
