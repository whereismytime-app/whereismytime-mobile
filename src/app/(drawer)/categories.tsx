import React from 'react';
import { View } from 'react-native';
import { CategoriesManagement } from '@/components/CategoriesManagement';

const CategoriesPage = () => {
  return (
    <View className="flex-1 bg-white">
      <CategoriesManagement />
    </View>
  );
};

export default CategoriesPage;