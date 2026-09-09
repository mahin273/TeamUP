import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { MatchingScreen } from '../screens/Matching/MatchingScreen';
import { IdeaHubScreen } from '../screens/IdeaHub/IdeaHubScreen';
import { SearchScreen } from '../screens/Search/SearchScreen';
import { NotificationsScreen } from '../screens/Notifications/NotificationsScreen';
import { SchedulerScreen } from '../screens/Scheduler/SchedulerScreen';

export type MainTabParamList = {
  Profile: undefined;
  Matching: undefined;
  IdeaHub: undefined;
  Search: undefined;
  Notifications: undefined;
  Scheduler: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TabNavigator = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.onSurface,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVariant,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
      }}
    >
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text>,
        }}
      />
      <Tab.Screen
        name="Matching"
        component={MatchingScreen}
        options={{
          title: 'Matching',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🤝</Text>,
        }}
      />
      <Tab.Screen
        name="IdeaHub"
        component={IdeaHubScreen}
        options={{
          title: 'Idea Hub',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>💡</Text>,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔍</Text>,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔔</Text>,
        }}
      />
      <Tab.Screen
        name="Scheduler"
        component={SchedulerScreen}
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📅</Text>,
        }}
      />
    </Tab.Navigator>
  );
};
