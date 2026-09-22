import React from 'react';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
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

interface CategoryTabButtonProps extends BottomTabBarButtonProps {
  isDark: boolean;
}

const CategoryTabButton: React.FC<CategoryTabButtonProps> = ({
  children,
  style,
  onPress,
  onLongPress,
  accessibilityState,
  isDark,
  testID,
  accessibilityLabel,
}) => {
  const isSelected = Boolean(accessibilityState?.selected);

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress || undefined}
      onLongPress={onLongPress || undefined}
      accessibilityState={accessibilityState}
      accessibilityRole="tab"
      activeOpacity={0.75}
      style={[
        style,
        styles.tabItem,
        isSelected
          ? [
              styles.tabItemActive,
              {
                backgroundColor: isDark
                  ? 'rgba(99, 102, 241, 0.22)'
                  : 'rgba(99, 102, 241, 0.12)',
                borderColor: isDark
                  ? 'rgba(99, 102, 241, 0.40)'
                  : 'rgba(99, 102, 241, 0.25)',
              },
            ]
          : styles.tabItemInactive,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
};

export const TabNavigator = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark
            ? 'rgba(15, 23, 42, 0.88)'
            : 'rgba(255, 255, 255, 0.90)',
          borderTopColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
          borderTopWidth: 1,
          height: 62 + Math.max(insets.bottom, 6),
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 4,
          paddingHorizontal: 4,
          ...Platform.select({
            web: {
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
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
        tabBarButton: (props) => <CategoryTabButton {...props} isDark={isDark} />,
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
          tabBarButton: (props) => (
            <TouchableOpacity
              testID={props.testID}
              accessibilityLabel={props.accessibilityLabel}
              onPress={props.onPress || undefined}
              onLongPress={props.onLongPress || undefined}
              activeOpacity={0.85}
              style={[
                props.style,
                {
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              {props.children}
            </TouchableOpacity>
          ),
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
  tabItem: {
    flex: 1,
    marginHorizontal: 3,
    marginVertical: 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemActive: {
    borderWidth: 1,
    opacity: 1,
  },
  tabItemInactive: {
    borderWidth: 1,
    borderColor: 'transparent',
    opacity: 0.68,
  },
});
