import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  badge?: string;
}

export const MoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typography, spacing, borderRadius, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  const menuItems: MenuItem[] = [
    {
      id: 'profile',
      title: 'Profile',
      subtitle: 'View and edit your skills & GitHub sync',
      icon: '👤',
      route: 'Profile',
    },
    {
      id: 'calendar',
      title: 'Calendar & Meetings',
      subtitle: 'Standups, deadlines & team schedule',
      icon: '📅',
      route: 'Scheduler',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Invitations, applications & updates',
      icon: '🔔',
      route: 'Notifications',
    },
    {
      id: 'bookmarks',
      title: 'Bookmarks',
      subtitle: 'Saved projects and references',
      icon: '🔖',
      route: 'Bookmarks',
    },
    {
      id: 'search',
      title: 'Global Search',
      subtitle: 'Find projects, classmates & skills',
      icon: '🔍',
      route: 'Search',
    },
    {
      id: 'settings',
      title: 'Settings & Theme',
      subtitle: isDark ? 'Dark theme active' : 'Light theme active',
      icon: '⚙️',
      route: 'Settings',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="More"
        subtitle="Account & Utilities"
        actions={[
          {
            icon: <Text style={{ fontSize: 18 }}>{isDark ? '☀️' : '🌙'}</Text>,
            onPress: toggleTheme,
            accessibilityLabel: 'Toggle theme',
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.screenPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Snapshot Card */}
        <Card
          style={styles.profileCard}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.profileRow}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primarySoft, borderColor: colors.primary },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <Text
                style={[
                  styles.profileName,
                  {
                    color: colors.text,
                    fontSize: typography.h3.fontSize,
                    fontWeight: typography.h3.fontWeight,
                  },
                ]}
              >
                {user?.fullName || 'Welcome!'}
              </Text>
              <Text
                style={[
                  styles.profileEmail,
                  {
                    color: colors.textMuted,
                    fontSize: typography.bodySmall.fontSize,
                  },
                ]}
              >
                {user?.email || 'Logged in user'}
              </Text>
              <View style={styles.badgeRow}>
                <Badge label="Active Member" variant="secondary" />
              </View>
            </View>

            <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
          </View>
        </Card>

        {/* Navigation Menu Grid / List */}
        <Text
          style={[
            styles.sectionHeading,
            {
              color: colors.textMuted,
              fontSize: typography.label.fontSize,
              marginTop: spacing.md,
            },
          ]}
        >
          QUICK ACCESS
        </Text>

        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            accessibilityRole="button"
            activeOpacity={0.7}
            style={[
              styles.menuCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              },
            ]}
            onPress={() => navigation.navigate(item.route)}
          >
            <View style={styles.menuRow}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: colors.surfaceMuted, borderRadius: borderRadius.sm },
                ]}
              >
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              </View>

              <View style={styles.menuTextContainer}>
                <Text
                  style={[
                    styles.menuTitle,
                    {
                      color: colors.text,
                      fontSize: typography.body.fontSize,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {item.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.menuSubtitle,
                    {
                      color: colors.textMuted,
                      fontSize: typography.bodySmall.fontSize,
                    },
                  ]}
                >
                  {item.subtitle}
                </Text>
              </View>

              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 90,
  },
  profileCard: {
    padding: 16,
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    letterSpacing: -0.2,
  },
  profileEmail: {
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '300',
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  menuCard: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    minHeight: 64,
    justifyContent: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    marginBottom: 2,
  },
  menuSubtitle: {
    marginTop: 1,
  },
});
