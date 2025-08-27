import { Stack } from 'expo-router';

export default function StatsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false, // Hide header since we have custom header on the Stats
        }}
      />
    </Stack>
  );
}
