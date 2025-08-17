import { Stack } from 'expo-router';
import { Button, Text } from 'react-native';

import { Container } from '@/components/Container';
import { useGoogleAuth } from '@/components/GoogleAuthProvider';
import { ScreenContent } from '@/components/ScreenContent';
import SyncCalendarsButton from '~/src/components/SyncCalendarsButton';
import ReApplyCategories from '~/src/components/ReApplyCategories';

export default function Home() {
  const { user, isLoading, signOut } = useGoogleAuth();

  return (
    <>
      <Stack.Screen options={{ title: 'Home' }} />
      <Container>
        <Text className="mb-4 text-lg">Welcome, {user?.displayName || user?.email}!</Text>
        <SyncCalendarsButton />
        <ReApplyCategories />
        <Button disabled={isLoading} onPress={() => signOut()} title="Sign Out" />
        <ScreenContent path="app/(drawer)/index.tsx" title="Home" />
      </Container>
    </>
  );
}
