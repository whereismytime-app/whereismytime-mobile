import { Stack } from 'expo-router';
import { Text } from 'react-native';

import { Container } from '~/components/Container';
import { useGoogleAuth } from '~/components/GoogleAuthProvider';
import { ScreenContent } from '~/components/ScreenContent';

import { GoogleSigninButton } from '@react-native-google-signin/google-signin'; // Ensure Google Signin is imported for configuration

export default function Home() {
  const { user, initializing, signIn } = useGoogleAuth();

  return (
    <>
      <Stack.Screen options={{ title: 'Home' }} />
      <Text>Initializing: {initializing ? 'true' : 'false'}</Text>
      <Text>User: {user?.email}</Text>
      <GoogleSigninButton onPress={signIn} />
      <Container>
        <ScreenContent path="app/(drawer)/index.tsx" title="Home" />
      </Container>
    </>
  );
}
