import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';

import { CategoryList } from '@/components/stats/CategoryList';
import { CategoryPieChart } from '@/components/stats/CategoryPieChart';
import { EventsList } from '@/components/stats/EventsList';
import { TimeRangeSelector } from '@/components/stats/TimeRangeSelector';
import { useDrizzle } from '@/db/SQLiteProvider';
import {
  CategoryReportService,
  type CategoryReport,
  type EventWithCategory,
  type TimeRange,
} from '@/services/CategoryReportService';

export default function StatsScreen() {
  const { drizzle: drizzleDB } = useDrizzle();
  const [reportService] = useState(() => new CategoryReportService(drizzleDB));

  const params = useLocalSearchParams<{ categoryId?: string; categoryName?: string }>();
  const [timeRangeType, setTimeRangeType] = useState<'weekly' | 'monthly' | 'annually' | 'period'>(
    'monthly'
  );
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [categoryReports, setCategoryReports] = useState<CategoryReport[]>([]);
  const [events, setEvents] = useState<EventWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasChildCategories, setHasChildCategories] = useState(false);

  const currentCategoryId = params.categoryId;
  const currentCategoryName = params.categoryName;
  const isShowingEvents = currentCategoryId && !hasChildCategories;

  // Compute current time range
  const timeRange = useMemo<TimeRange>(() => {
    switch (timeRangeType) {
      case 'weekly':
        const startOfWeek = new Date(referenceDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return { start: startOfWeek, end: endOfWeek };

      case 'monthly':
        const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        const endOfMonth = new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        return { start: startOfMonth, end: endOfMonth };

      case 'annually':
        const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
        const endOfYear = new Date(referenceDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start: startOfYear, end: endOfYear };

      case 'period':
        return { start: new Date(customStart), end: new Date(customEnd) };

      default:
        return { start: new Date(), end: new Date() };
    }
  }, [timeRangeType, referenceDate, customStart, customEnd]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      if (currentCategoryId) {
        // Get category report
        const report = await reportService.getCategoryReport(currentCategoryId, timeRange, true);
        if (report) {
          setHasChildCategories(report.children.length > 0);

          if (report.children.length > 0) {
            // Show child categories
            setCategoryReports(report.children);
            setEvents([]);
          } else {
            // Show events for this category
            const categoryEvents = await reportService.getEventsWithDetails({
              categoryId: currentCategoryId,
              timeRange,
            });
            setEvents(categoryEvents);
            setCategoryReports([]);
          }
        }
      } else {
        // Show root categories
        const fullReport = await reportService.generateFullReport(timeRange);
        setCategoryReports(fullReport.categoryBreakdown);
        setEvents([]);
        setHasChildCategories(false);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      Alert.alert('Error', 'Failed to load statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [reportService, timeRange, currentCategoryId]);

  // Load data when time range or category changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategoryPress = (categoryReport: CategoryReport) => {
    router.push({
      pathname: '/stats',
      params: {
        categoryId: categoryReport.category.id,
        categoryName: categoryReport.category.name,
        hasChildCategories: categoryReport.children.length > 0 ? '1' : '0',
      },
    });
  };

  const handleTimeRangeTypeChange = (type: 'weekly' | 'monthly' | 'annually' | 'period') => {
    setTimeRangeType(type);
  };

  const handleCustomDatesChange = (start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
  };

  const navigateTimeRange = (direction: 'prev' | 'next') => {
    const newDate = new Date(referenceDate);

    switch (timeRangeType) {
      case 'weekly':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'monthly':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'annually':
        newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
        break;
    }

    setReferenceDate(newDate);
  };

  const formatTimeRangeDisplay = (): string => {
    switch (timeRangeType) {
      case 'weekly':
        const weekStart = timeRange.start.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const weekEnd = timeRange.end.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        return `${weekStart} - ${weekEnd}`;

      case 'monthly':
        return timeRange.start.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      case 'annually':
        return timeRange.start.getFullYear().toString();

      case 'period':
        const periodStart = timeRange.start.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const periodEnd = timeRange.end.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        return `${periodStart} - ${periodEnd}`;
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-600">Loading statistics...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Time Range Selector */}
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <TimeRangeSelector
          timeRangeType={timeRangeType}
          displayText={formatTimeRangeDisplay()}
          customStart={customStart}
          customEnd={customEnd}
          onTypeChange={handleTimeRangeTypeChange}
          onNavigate={navigateTimeRange}
          onCustomDatesChange={handleCustomDatesChange}
        />
      </View>

      {isShowingEvents ? (
        /* Events List View */
        <EventsList
          events={events}
          emptyMessage={`No events found for ${currentCategoryName} in the selected time period.`}
        />
      ) : (
        /* Categories View */
        <ScrollView className="flex-1">
          {/* Pie Chart */}
          {categoryReports.length > 0 && (
            <View className="border-b border-gray-100 bg-white px-4 py-6">
              <CategoryPieChart categoryReports={categoryReports} />
            </View>
          )}

          {/* Category List */}
          <CategoryList
            categoryReports={categoryReports}
            onCategoryPress={handleCategoryPress}
            emptyMessage={
              currentCategoryId
                ? `No subcategories found for ${currentCategoryName}.`
                : 'No categories found. Create some categories to see your time statistics.'
            }
          />
        </ScrollView>
      )}
    </View>
  );
}
