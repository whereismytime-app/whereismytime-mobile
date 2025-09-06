import { useEffect, useRef, useState } from 'react';
import { Button, View, Text } from 'react-native';
import { useDrizzle } from '@/db/SQLiteProvider';
import {
  CategorizationStats,
  EventCategorizationService,
} from '@/services/events/EventCategorizationService';

const ReApplyCategories = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [categorizationStats, setCategorizationStats] = useState<CategorizationStats | null>(null);
  const { drizzle: db } = useDrizzle();
  const eventCategorizationService = useRef(new EventCategorizationService(db));

  useEffect(() => {
    const updateStatus = async () => {
      if (isLoading) {
        return;
      }
      const service = eventCategorizationService.current;
      const stats = await service.getCategorizationStats();
      setCategorizationStats(stats);
    };
    updateStatus();
  }, [isLoading]);

  const reApplyCategories = async () => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 10));
    const service = eventCategorizationService.current;
    await service.getCategories(true);
    await service.categorizeEvents();
    setIsLoading(false);
  };

  return (
    <View className="mb-6">
      <Text className="mb-2 text-base font-bold">Event Categorization</Text>

      <Button
        disabled={isLoading}
        title={isLoading ? 'Loading...' : 'ReApply Categories'}
        onPress={reApplyCategories}
      />
      {categorizationStats && (
        <View className="mt-3 rounded bg-gray-100 p-2">
          <Text className="text-sm font-medium">Stats:</Text>
          <Text className="text-xs text-gray-600">
            Categorized: {categorizationStats.categorized} (
            {((categorizationStats.categorized / categorizationStats.total) * 100).toFixed(2)}%)
          </Text>
          <Text className="text-xs text-gray-600">
            Un-Categorized: {categorizationStats.uncategorized}
          </Text>
          <Text className="text-xs text-gray-600">Total: {categorizationStats.total}</Text>
        </View>
      )}
    </View>
  );
};

export default ReApplyCategories;
