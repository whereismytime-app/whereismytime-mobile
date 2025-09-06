import { Ionicons } from '@expo/vector-icons';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import zod from 'zod';
import { useGlobalZodSearchParams } from '~/src/hooks/useGlobalZodSearchParams';

export const StatsPageParams = zod.object({
  // TimeRange Specific
  dateRangeRef: zod
    .string()
    .transform((str) => new Date(str))
    .default(new Date()),
  dateRangeType: zod.enum(['weekly', 'monthly', 'annually', 'period']).default('monthly'),
  dateRangeCustomStart: zod
    .string()
    .transform((str) => new Date(str))
    .optional(),
  dateRangeCustomEnd: zod
    .string()
    .transform((str) => new Date(str))
    .optional(),

  // Category Specific
  categoryId: zod.string().optional(),
  categoryName: zod.string().max(100).optional(),
  hasChildCategories: zod
    .enum(['0', '1'])
    .optional()
    .transform((val) => val === '1')
    .optional(),
  isDummyParent: zod
    .enum(['0', '1'])
    .optional()
    .transform((val) => val === '1')
    .optional(),
});

export type StatsPageParamsType = zod.infer<typeof StatsPageParams>;
export type StatsPageParamsInputType = Omit<
  StatsPageParamsType,
  | 'hasChildCategories'
  | 'isDummyParent'
  | 'dateRangeRef'
  | 'dateRangeCustomStart'
  | 'dateRangeCustomEnd'
> & {
  hasChildCategories: '0' | '1';
  isDummyParent: '0' | '1';
  dateRangeRef: string;
  dateRangeCustomStart?: string;
  dateRangeCustomEnd?: string;
};

const StatsDrawerHeader = (props: DrawerHeaderProps) => {
  const insets = useSafeAreaInsets();
  const { params } = useGlobalZodSearchParams(StatsPageParams);

  const handleNav = () => {
    if (params?.categoryId) {
      router.back();
    } else {
      props.navigation.toggleDrawer();
    }
  };

  const navIcon = params?.categoryId ? 'arrow-back' : 'menu';
  const title = params?.categoryName || 'Statistics';
  const subTitle = params?.categoryId
    ? params?.hasChildCategories
      ? 'Subcategories'
      : 'Events'
    : null;

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3">
      <TouchableOpacity
        onPress={handleNav}
        className="-ml-2 mr-3 p-2"
        accessibilityLabel={params?.categoryId ? 'Go Back' : 'Open Drawer'}>
        <Ionicons name={navIcon} size={24} color="#374151" />
      </TouchableOpacity>

      <View className="flex-1">
        <Text className="text-lg font-medium text-gray-900" numberOfLines={1}>
          {title}
        </Text>
        {subTitle && (
          <Text className="text-sm text-gray-500" numberOfLines={1}>
            {subTitle}
          </Text>
        )}
      </View>
    </View>
  );
};

export default StatsDrawerHeader;
