import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarView } from '@/components/CalendarView';
import type { ViewMode } from '@/components/drawer/CustomDrawerContent';

export default function CalendarViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ viewMode?: ViewMode }>();
  const viewMode = params.viewMode || 'day';

  const handleViewModeChange = (mode: ViewMode) => {
    router.setParams({ viewMode: mode });
  };

  return <CalendarView viewMode={viewMode} onViewModeChange={handleViewModeChange} />;
}
