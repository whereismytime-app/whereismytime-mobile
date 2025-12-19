import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItem,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { CommonActions } from '@react-navigation/native';

export type ViewMode = 'day' | '3day' | '5day';

const VIEW_MODE_CONFIG: {
  mode: ViewMode;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { mode: 'day', label: '1 Day', icon: 'view-day' },
  { mode: '3day', label: '3 Days', icon: 'view-week' },
  { mode: '5day', label: '5 Days', icon: 'view-week' },
];

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation, descriptors } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ viewMode?: ViewMode }>();
  const currentViewMode = params.viewMode || 'day';

  // Track if Calendar View submenu is expanded
  const [calendarExpanded, setCalendarExpanded] = useState(pathname === '/calendar-view');

  const isCalendarViewActive = pathname === '/calendar-view';

  const handleViewModeChange = (mode: ViewMode) => {
    navigation.closeDrawer();
    if (!isCalendarViewActive) {
      router.push({ pathname: '/calendar-view' as any, params: { viewMode: mode } });
    } else {
      router.setParams({ viewMode: mode });
    }
  };

  return (
    <DrawerContentScrollView {...props}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.drawerLabel !== undefined
            ? options.drawerLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        const isFocused = state.index === index;
        const isCalendarView = route.name === 'calendar-view';

        const onPress = () => {
          const event = navigation.emit({
            type: 'drawerItemPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!event.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate(route.name, route.params),
              target: state.key,
            });
          }
        };

        return (
          <React.Fragment key={route.key}>
            {/* Render the drawer item */}
            {isCalendarView ? (
              // Custom Calendar View item with expand/collapse
              <Pressable
                onPress={() => {
                  setCalendarExpanded(!calendarExpanded);
                }}
                className={`mx-2 flex-row items-center rounded-lg px-4 py-3 ${
                  isFocused ? 'bg-indigo-50' : ''
                }`}>
                {options.drawerIcon?.({
                  size: 24,
                  color: isFocused ? '#6366f1' : '#6b7280',
                  focused: isFocused,
                })}
                <Text
                  className={`ml-8 flex-1 text-base ${
                    isFocused ? 'font-semibold text-indigo-600' : 'text-gray-700'
                  }`}>
                  {typeof label === 'string' ? label : route.name}
                </Text>
                <Ionicons
                  name={calendarExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#9ca3af"
                />
              </Pressable>
            ) : (
              // Regular drawer items
              <DrawerItem
                label={typeof label === 'string' ? label : route.name}
                icon={options.drawerIcon}
                focused={isFocused}
                onPress={onPress}
              />
            )}

            {/* Render nested view mode options after Calendar View */}
            {isCalendarView && calendarExpanded && (
              <View className="ml-12 border-l border-gray-200 pl-2">
                {VIEW_MODE_CONFIG.map(({ mode, label: modeLabel, icon }) => (
                  <Pressable
                    key={mode}
                    onPress={() => handleViewModeChange(mode)}
                    className={`flex-row items-center px-4 py-2 ${
                      currentViewMode === mode && isCalendarViewActive
                        ? 'rounded-lg bg-indigo-50'
                        : ''
                    }`}>
                    <MaterialIcons
                      name={icon}
                      size={20}
                      color={
                        currentViewMode === mode && isCalendarViewActive ? '#6366f1' : '#9ca3af'
                      }
                    />
                    <Text
                      className={`ml-4 text-sm ${
                        currentViewMode === mode && isCalendarViewActive
                          ? 'font-medium text-indigo-600'
                          : 'text-gray-600'
                      }`}>
                      {modeLabel}
                    </Text>
                    {currentViewMode === mode && isCalendarViewActive && (
                      <Ionicons name="checkmark" size={16} color="#6366f1" className="ml-auto" />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </React.Fragment>
        );
      })}
    </DrawerContentScrollView>
  );
}
