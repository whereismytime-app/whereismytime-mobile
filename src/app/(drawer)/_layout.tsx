import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Drawer } from 'expo-router/drawer';

import { HeaderButton } from '@/components/HeaderButton';
import { CustomDrawerContent } from '@/components/drawer/CustomDrawerContent';
import StatsDrawerHeader from '@/components/stats/StatsDrawerHeader';

const DrawerLayout = () => {
  return (
    <Drawer
      backBehavior="history"
      initialRouteName="index"
      drawerContent={(props) => <CustomDrawerContent {...props} />}>
      <Drawer.Screen
        name="index"
        options={{
          headerTitle: 'Home',
          drawerLabel: 'Home',
          drawerIcon: ({ size, color }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="categories"
        options={{
          headerTitle: 'Categories',
          drawerLabel: 'Categories',
          drawerIcon: ({ size, color }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="stats"
        options={{
          headerTitle: 'Statistics',
          drawerHideStatusBarOnOpen: true,
          drawerLabel: 'Statistics',
          drawerIcon: ({ size, color }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
          header: (props) => <StatsDrawerHeader {...props} />,
        }}
      />
      <Drawer.Screen
        name="calendars"
        options={{
          headerTitle: 'Calendars',
          drawerLabel: 'Calendars',
          drawerIcon: ({ size, color }) => (
            <MaterialIcons name="calendar-today" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="events"
        options={{
          headerTitle: 'Events',
          drawerLabel: 'Events',
          drawerIcon: ({ size, color }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="calendar-view"
        options={{
          headerTitle: 'Calendar View',
          drawerLabel: 'Calendar View',
          drawerIcon: ({ size, color }) => (
            <MaterialIcons name="view-week" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="(tabs)"
        options={{
          headerTitle: 'Tabs',
          drawerLabel: 'Tabs',
          drawerIcon: ({ size, color }) => (
            <MaterialIcons name="border-bottom" size={size} color={color} />
          ),
          headerRight: () => (
            <Link href="/modal" asChild>
              <HeaderButton />
            </Link>
          ),
        }}
      />
    </Drawer>
  );
};

export default DrawerLayout;
