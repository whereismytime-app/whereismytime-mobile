import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { Image, View } from 'react-native';
import { router } from 'expo-router';

import { useGoogleAuth } from '@/components/GoogleAuthProvider';
import { useEffect } from 'react';

export default function AuthScreen() {
  const { signIn, isLoggedIn, isLoading } = useGoogleAuth();

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    router.replace('/');
  }, [isLoggedIn]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <View className="mb-12 items-center">
        <Image
          source={require('~/assets/whereismytime-logo.jpg')}
          className="h-48 w-48 rounded-2xl"
          resizeMode="contain"
        />
      </View>

      <View className="w-full max-w-sm">
        <GoogleSigninButton
          disabled={isLoading}
          style={{ width: '100%', height: 48 }}
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          onPress={signIn}
        />
      </View>
    </View>
  );
}
