import { View, Text, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import {
  CategoryReportService,
  type CategoryReport,
} from '@/services/reporting/CategoryReportService';

interface CategoryPieChartProps {
  categoryReports: CategoryReport[];
}

export function CategoryPieChart({ categoryReports }: CategoryPieChartProps) {
  const screenWidth = Dimensions.get('window').width;

  // Filter out categories with zero duration
  const filteredReports = categoryReports.filter((report) => report.totalDuration > 0);

  if (filteredReports.length === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-base text-gray-500">No data to display</Text>
      </View>
    );
  }

  // Prepare data for pie chart
  const pieData = filteredReports.map((report, index) => {
    const totalDuration = filteredReports.reduce((sum, r) => sum + r.totalDuration, 0);
    const percentage = totalDuration > 0 ? (report.totalDuration / totalDuration) * 100 : 0;

    return {
      name:
        report.category.name.length > 12
          ? `${report.category.name.substring(0, 12)}...`
          : report.category.name,
      population: report.totalDuration,
      color: report.category.color,
      legendFontColor: '#374151',
      legendFontSize: 12,
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
    };
  });

  const chartConfig = {
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
  };

  const getTotalDuration = () => {
    return filteredReports.reduce((sum, report) => sum + report.totalDuration, 0);
  };

  const formatTotalDuration = () => {
    return CategoryReportService.formatDuration(getTotalDuration());
  };

  return (
    <View className="items-center">
      {/* Chart Title */}
      <Text className="mb-2 text-lg font-semibold text-gray-900">Time Distribution</Text>
      <Text className="mb-4 text-sm text-gray-600">Total: {formatTotalDuration()}</Text>

      {/* Pie Chart */}
      <PieChart
        data={pieData}
        width={screenWidth - 32}
        height={220}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute={false} // Show percentages instead of absolute values
      />

      {/* Legend with durations */}
      {/* <View className="w-full mt-4">
        <Text className="text-base font-medium text-gray-900 mb-3">Breakdown</Text>
        <View className="space-y-2">
          {pieData.map((item, index) => (
            <View key={index} className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View 
                  className="w-4 h-4 rounded-full mr-3"
                  style={{ backgroundColor: item.color }}
                />
                <Text 
                  className="text-sm text-gray-900 flex-1" 
                  numberOfLines={1}
                >
                  {filteredReports[index].category.name}
                </Text>
              </View>
              <View className="items-end ml-3">
                <Text className="text-sm font-medium text-gray-900">
                  {CategoryReportService.formatDuration(item.population)}
                </Text>
                <Text className="text-xs text-gray-500">
                  {item.percentage}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View> */}
    </View>
  );
}
