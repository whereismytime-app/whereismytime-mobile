import { Ionicons } from '@expo/vector-icons';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { router, useGlobalSearchParams } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

const StatsDrawerHeader = (props: DrawerHeaderProps) => {
  const params = useGlobalSearchParams();

  const handleNav = () => {
    if (params.categoryId) {
      router.back();
    } else {
      props.navigation.toggleDrawer();
    }
  };

  const navIcon = params.categoryId ? 'arrow-back' : 'menu';
  const title = params.categoryName || 'Statistics';
  const hasChildCategories = params.hasChildCategories === '1';
  const subTitle = params.categoryId ? (hasChildCategories ? 'Subcategories' : 'Events') : null;

  return (
    <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3">
      <TouchableOpacity
        onPress={handleNav}
        className="-ml-2 mr-3 p-2"
        accessibilityLabel={params.categoryId ? 'Go Back' : 'Open Drawer'}>
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
