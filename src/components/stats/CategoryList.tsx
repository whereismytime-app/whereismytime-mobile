import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategoryReportService, type CategoryReport } from '@/services/reporting/CategoryReportService';

interface CategoryListProps {
  categoryReports: CategoryReport[];
  onCategoryPress: (categoryReport: CategoryReport) => void;
  emptyMessage: string;
}

interface CategoryListItemProps {
  categoryReport: CategoryReport;
  onPress: () => void;
  rank: number;
}

function CategoryListItem({ categoryReport, onPress, rank }: CategoryListItemProps) {
  const { category, totalDuration, totalEventCount } = categoryReport;
  const hasChildren = categoryReport.children.length > 0;

  // Calculate percentage based on all siblings
  const formatDuration = CategoryReportService.formatDuration(totalDuration);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center border-b border-gray-100 bg-white px-4 py-4"
      activeOpacity={0.7}>
      {/* Rank */}
      <View className="mr-3 w-8 items-center">
        <Text className="text-sm font-semibold text-gray-500">#{rank}</Text>
      </View>

      {/* Category Color Indicator */}
      <View className="mr-3 h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />

      {/* Category Info */}
      <View className="min-w-0 flex-1">
        <Text className="mb-1 text-base font-medium text-gray-900" numberOfLines={1}>
          {category.name}
        </Text>
        <View className="flex-row items-center space-x-4">
          <Text className="text-sm text-gray-600">{formatDuration}</Text>
          <Text className="text-sm text-gray-500">
            {totalEventCount} {totalEventCount === 1 ? 'event' : 'events'}
          </Text>
        </View>
      </View>

      {/* Arrow Icon */}
      <Ionicons name={hasChildren ? 'chevron-forward' : 'list-outline'} size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export function CategoryList({
  categoryReports,
  onCategoryPress,
  emptyMessage,
}: CategoryListProps) {
  // Filter out categories with zero duration and sort by duration descending
  const sortedReports = categoryReports
    .filter((report) => report.totalDuration > 0)
    .sort((a, b) => b.totalDuration - a.totalDuration);

  if (sortedReports.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4 py-16">
        <Ionicons name="pie-chart-outline" size={64} color="#D1D5DB" />
        <Text className="mt-4 text-center text-base leading-6 text-gray-500">{emptyMessage}</Text>
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: CategoryReport; index: number }) => (
    <CategoryListItem
      key={item.category.id}
      categoryReport={item}
      onPress={() => onCategoryPress(item)}
      rank={index + 1}
    />
  );

  const getTotalDuration = () => {
    return sortedReports.reduce((sum, report) => sum + report.totalDuration, 0);
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <Text className="text-base font-semibold text-gray-900">Categories by Time Spent</Text>
        <Text className="mt-1 text-sm text-gray-600">
          Total: {CategoryReportService.formatDuration(getTotalDuration())} across{' '}
          {sortedReports.length} {sortedReports.length === 1 ? 'category' : 'categories'}
        </Text>
      </View>

      {/* Category List */}
      <View>{sortedReports.map((item, index) => renderItem({ item, index }))}</View>
    </View>
  );
}
