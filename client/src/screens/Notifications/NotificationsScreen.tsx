import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Chip } from '../../components/Chip';
import { StateWrapper } from '../../components/StateWrapper';
import {
  notificationService,
  AppNotification,
} from '../../services/notificationService';

export interface NotificationsScreenProps {
  onNotificationTap?: (notification: AppNotification) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onNotificationTap,
}) => {
  const { colors, typography, spacing } = useTheme();
  const navigation = useNavigation<any>();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    notificationService
      .getNotifications()
      .then((res) => {
        if (isMounted) {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unreadCount || 0);
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load notifications');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMarkAsRead = async (notification: AppNotification) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // safe fallback
      }
    }

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationService.markAsRead(notification.id);
    } catch {
      // Silent catch or rollback if needed
    }

    if (onNotificationTap) {
      onNotificationTap(notification);
    } else {
      // Deep-link navigation based on type or data
      const targetScreen =
        notification.data?.screen ||
        (notification.type?.includes('INVITE') || notification.type?.includes('MATCH')
          ? 'Matching'
          : notification.type?.includes('MEETING') || notification.type?.includes('SCHEDULER')
          ? 'Scheduler'
          : notification.type?.includes('IDEA')
          ? 'IdeaHub'
          : notification.type?.includes('BOOKMARK')
          ? 'Search'
          : null);

      if (targetScreen && navigation && typeof navigation.navigate === 'function') {
        navigation.navigate(targetScreen);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // safe fallback
      }
    }

    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllAsRead();
    } catch {
      // Silent fallback
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // safe fallback
      }
    }

    const target = notifications.find((item) => item.id === id);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await notificationService.deleteNotification(id);
    } catch {
      // Silent catch
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.isRead;
    return true;
  });

  const getTypeIcon = (type: string) => {
    if (type.includes('MATCH') || type.includes('INVITE')) return '🤝';
    if (type.includes('MEETING') || type.includes('SCHEDULER')) return '📅';
    if (type.includes('IDEA')) return '💡';
    if (type.includes('BOOKMARK')) return '🔖';
    return '🔔';
  };

  const formatRelativeTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const isToday = (isoString: string) => {
    if (!isoString) return true;
    try {
      const date = new Date(isoString);
      const today = new Date();
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    } catch {
      return true;
    }
  };

  const renderNotificationCard = (item: AppNotification) => {
    const isUnread = !item.isRead;
    return (
      <Pressable
        key={item.id}
        testID={`notification-item-${item.id}`}
        onPress={() => handleMarkAsRead(item)}
        style={({ pressed }) => [
          styles.cardWrapper,
          { transform: [{ scale: pressed ? 0.98 : 1.0 }] },
        ]}
      >
        <Card
          style={[
            styles.notificationCard,
            isUnread && {
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.primary,
              borderWidth: 1.5,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.typeIconRow}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>
                {getTypeIcon(item.type)}
              </Text>
              <Text
                style={[
                  styles.notificationTitle,
                  {
                    color: colors.onSurface,
                    fontWeight: isUnread ? '700' : '500',
                  },
                ]}
              >
                {item.title}
              </Text>
            </View>

            <View style={styles.cardHeaderRight}>
              {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              <TouchableOpacity
                onPress={() => handleDeleteNotification(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text
            style={[
              styles.bodyText,
              { color: colors.onSurfaceVariant, marginTop: spacing.xs },
            ]}
          >
            {item.body}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>
              {formatRelativeTime(item.createdAt)}
            </Text>
            {item.data?.screen && (
              <Badge label={`Tap to open ${item.data.screen}`} variant="secondary" />
            )}
          </View>
        </Card>
      </Pressable>
    );
  };

  const todayList = filteredNotifications.filter((n) => isToday(n.createdAt));
  const earlierList = filteredNotifications.filter((n) => !isToday(n.createdAt));

  if (isLoading) {
    return <StateWrapper state="loading" />;
  }

  if (error) {
    return (
      <StateWrapper
        state="error"
        errorMessage={error}
        onRetry={loadNotifications}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader
        title="Notifications"
        subtitle="Invitations, applications & updates"
        showBack={Boolean(navigation)}
        onBack={() => {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          } else {
            navigation?.navigate?.('MainApp', { screen: 'More' });
          }
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header Badges and Actions */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            {unreadCount > 0 ? (
              <Badge label={`${unreadCount} unread`} variant="primary" />
            ) : (
              <Badge label="All read" variant="secondary" />
            )}
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllBtn}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
        </View>

      {/* Filter Chips */}
      <View style={[styles.filterRow, { marginBottom: spacing.md }]}>
        <Chip
          label={`All (${notifications.length})`}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <View style={{ width: spacing.xs }} />
        <Chip
          label={`Unread (${unreadCount})`}
          selected={filter === 'unread'}
          onPress={() => setFilter('unread')}
        />
      </View>

      {/* Main List / Empty State */}
      {filteredNotifications.length === 0 ? (
        <StateWrapper
          state="empty"
          emptyTitle={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          emptySubtitle={
            filter === 'unread'
              ? 'You have read all your notifications!'
              : 'You will receive updates about team invites, scheduled meetings, and project ideas here.'
          }
        />
      ) : (
        <FlatList
          data={[{ key: 'content' }]}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          renderItem={() => (
            <View>
              {todayList.length > 0 && (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[styles.groupTitle, { color: colors.onSurfaceVariant }]}>
                    Today
                  </Text>
                  <View style={[styles.groupDivider, { backgroundColor: colors.outlineVariant }]} />
                  {todayList.map((item) => renderNotificationCard(item))}
                </View>
              )}

              {earlierList.length > 0 && (
                <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
                  <Text style={[styles.groupTitle, { color: colors.onSurfaceVariant }]}>
                    Earlier
                  </Text>
                  <View style={[styles.groupDivider, { backgroundColor: colors.outlineVariant }]} />
                  {earlierList.map((item) => renderNotificationCard(item))}
                </View>
              )}
            </View>
          )}
        />
      )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontWeight: '700',
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardWrapper: {
    marginBottom: 12,
  },
  notificationCard: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 16,
    flexShrink: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  groupDivider: {
    height: 1,
    marginBottom: 10,
  },
});
