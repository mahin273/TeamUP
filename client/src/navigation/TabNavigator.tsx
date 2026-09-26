import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

import { MarketplaceScreen } from '../screens/Marketplace/MarketplaceScreen';
import { MatchingScreen } from '../screens/Matching/MatchingScreen';
import { CreateProjectScreen } from '../screens/Marketplace/CreateProjectScreen';
import { IdeaHubScreen } from '../screens/IdeaHub/IdeaHubScreen';
import { MoreScreen } from '../screens/More/MoreScreen';

export type MainTabParamList = {
  Projects: undefined;
  Matching: undefined;
  Create: undefined;
  IdeaHub: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TabNavigator = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark
            ? 'rgba(15, 23, 42, 0.85)'
            : 'rgba(255, 255, 255, 0.88)',
          borderTopColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
          borderTopWidth: 1,
          height: 60 + Math.max(insets.bottom, 6),
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 4,
          paddingHorizontal: 4,
          ...Platform.select({
            web: {
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            },
            default: {
              elevation: 8,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: isDark ? 0.35 : 0.08,
              shadowRadius: 8,
            },
          }),
        },
        tabBarActiveBackgroundColor: isDark
          ? 'rgba(99, 102, 241, 0.22)'
          : 'rgba(99, 102, 241, 0.12)',
        tabBarItemStyle: {
          borderRadius: 14,
          marginHorizontal: 3,
          marginVertical: 3,
          paddingVertical: 2,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 1,
        },
      }}
    >
      <Tab.Screen
        name="Projects"
        component={MarketplaceScreen}
        options={{
          title: 'Projects',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🚀</Text>,
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
        name="Create"
        component={CreateProjectScreen}
        options={{
          title: 'Create',
          tabBarLabel: () => null,
          tabBarActiveBackgroundColor: 'transparent',
          tabBarItemStyle: {
            borderRadius: 0,
            marginHorizontal: 0,
            marginVertical: 0,
          },
          tabBarIcon: () => (
            <View
              style={[
                styles.createButton,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                },
              ]}
            >
              <Text style={styles.createButtonText}>+</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="IdeaHub"
        component={IdeaHubScreen}
        options={{
          title: 'Ideas',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>💡</Text>,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>☰</Text>,
        }}
      />
    </Tab.Navigator>
  );
};


const styles = StyleSheet.create({
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 14 : 10,
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 28,
    textAlign: 'center',
  },
});
