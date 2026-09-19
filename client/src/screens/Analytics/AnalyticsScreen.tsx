import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { api, ApiError } from '../../api/client';

export interface ProjectAnalytics {
  projectId: string;
  projectName: string;
  taskStats: {
    total: number;
    todo: number;
    inProgress: number;
    testing: number;
    done: number;
    completionRate: number;
  };
  teamActivity: {
    totalMessages: number;
    totalFiles: number;
    activeMembersCount: number;
  };
  progressTimeline: {
    date: string;
    completedTasks: number;
  }[];
  memberContributions: {
    memberId: string;
    memberName: string;
    tasksCompleted: number;
    messagesPosted: number;
    filesUploaded: number;
  }[];
}

interface AnalyticsScreenProps {
  projectId: string;
}

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ projectId }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<ProjectAnalytics>(`/projects/${projectId}/analytics`);
      setAnalytics(response);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const renderProgressBar = (value: number, max: number, color: string) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <View style={[styles.progressBarContainer, { backgroundColor: colors.surfaceVariant }]}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${percentage}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={[
            styles.loadingText,
            {
              color: colors.onSurfaceVariant,
              fontSize: typography.bodyMedium.fontSize,
              marginTop: spacing.md,
            },
          ]}
        >
          Loading analytics...
        </Text>
      </View>
    );
  }

  if (error || !analytics) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text
          style={[
            styles.errorText,
            { color: colors.error, fontSize: typography.bodyLarge.fontSize },
          ]}
        >
          {error || 'No data available'}
        </Text>
        <Button
          title="Retry"
          onPress={fetchAnalytics}
          variant="outline"
          style={{ marginTop: spacing.md }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { marginBottom: spacing.lg }]}>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.onBackground, fontSize: typography.displayLarge.fontSize },
            ]}
          >
            Analytics
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              {
                color: colors.onSurfaceVariant,
                fontSize: typography.bodyMedium.fontSize,
                marginTop: spacing.xs,
              },
            ]}
          >
            {analytics.projectName}
          </Text>
        </View>

        {/* Task Overview */}
        <Card style={{ marginBottom: spacing.md }}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
            ]}
          >
            Task Overview
          </Text>
          <View style={[styles.statsGrid, { marginTop: spacing.md }]}>
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statValue,
                  { color: colors.primary, fontSize: typography.displayLarge.fontSize },
                ]}
              >
                {analytics.taskStats.total}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: colors.onSurfaceVariant, fontSize: typography.labelMedium.fontSize },
                ]}
              >
                Total Tasks
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statValue,
                  { color: colors.primary, fontSize: typography.displayLarge.fontSize },
                ]}
              >
                {analytics.taskStats.done}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: colors.onSurfaceVariant, fontSize: typography.labelMedium.fontSize },
                ]}
              >
                Completed
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statValue,
                  { color: colors.secondary, fontSize: typography.displayLarge.fontSize },
                ]}
              >
                {analytics.taskStats.completionRate.toFixed(0)}%
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: colors.onSurfaceVariant, fontSize: typography.labelMedium.fontSize },
                ]}
              >
                Completion
              </Text>
            </View>
          </View>

          {/* Task Status Breakdown */}
          <View style={[styles.breakdownSection, { marginTop: spacing.md }]}>
            <View style={styles.breakdownItem}>
              <Text
                style={[
                  styles.breakdownLabel,
                  { color: colors.onSurface, fontSize: typography.bodyMedium.fontSize },
                ]}
              >
                To Do: {analytics.taskStats.todo}
              </Text>
              {renderProgressBar(
                analytics.taskStats.todo,
                analytics.taskStats.total,
                colors.onSurfaceVariant
              )}
            </View>
            <View style={[styles.breakdownItem, { marginTop: spacing.sm }]}>
              <Text
                style={[
                  styles.breakdownLabel,
                  { color: colors.onSurface, fontSize: typography.bodyMedium.fontSize },
                ]}
              >
                In Progress: {analytics.taskStats.inProgress}
              </Text>
              {renderProgressBar(
                analytics.taskStats.inProgress,
                analytics.taskStats.total,
                colors.secondary
              )}
            </View>
            <View style={[styles.breakdownItem, { marginTop: spacing.sm }]}>
              <Text
                style={[
                  styles.breakdownLabel,
                  { color: colors.onSurface, fontSize: typography.bodyMedium.fontSize },
                ]}
              >
                Testing: {analytics.taskStats.testing}
              </Text>
              {renderProgressBar(
                analytics.taskStats.testing,
                analytics.taskStats.total,
                colors.tertiary
              )}
            </View>
            <View style={[styles.breakdownItem, { marginTop: spacing.sm }]}>
              <Text
                style={[
                  styles.breakdownLabel,
                  { color: colors.onSurface, fontSize: typography.bodyMedium.fontSize },
                ]}
              >
                Done: {analytics.taskStats.done}
              </Text>
              {renderProgressBar(analytics.taskStats.done, analytics.taskStats.total, colors.primary)}
            </View>
          </View>
        </Card>

        {/* Team Activity */}
        <Card style={{ marginBottom: spacing.md }}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
            ]}
          >
            Team Activity
          </Text>
          <View style={[styles.activityGrid, { marginTop: spacing.md }]}>
            <View style={styles.activityItem}>
              <Text style={{ fontSize: 32 }}>💬</Text>
              <Text
                style={[
                  styles.activityValue,
                  { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
                ]}
              >
                {analytics.teamActivity.totalMessages}
              </Text>
              <Text
                style={[
                  styles.activityLabel,
                  { color: colors.onSurfaceVariant, fontSize: typography.bodyMedium.fontSize },
                ]}
              >
                Messages
              </Text>
            </View>
            <View style={styles.activityItem}>
              <Text style={{ fontSize: 32 }}>📁</Text>
              <Text
                style={[
                  styles.activityValue,
                  { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
                ]}
              >
                {analytics.teamActivity.totalFiles}
              </Text>
              <Text
                style={[
                  styles.activityLabel,
                  { color: colors.onSurfaceVariant, fontSize: typography.bodyMedium.fontSize },
                ]}
              >
                Files
              </Text>
            </View>
            <View style={styles.activityItem}>
              <Text style={{ fontSize: 32 }}>👥</Text>
              <Text
                style={[
                  styles.activityValue,
                  { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
                ]}
              >
                {analytics.teamActivity.activeMembersCount}
              </Text>
              <Text
                style={[
                  styles.activityLabel,
                  { color: colors.onSurfaceVariant, fontSize: typography.bodyMedium.fontSize },
                ]}
              >
                Members
              </Text>
            </View>
          </View>
        </Card>

        {/* Member Contributions */}
        <Card style={{ marginBottom: spacing.xl }}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
            ]}
          >
            Member Contributions
          </Text>
          {analytics.memberContributions.map((member, index) => (
            <View
              key={member.memberId}
              style={[
                styles.memberCard,
                {
                  marginTop: spacing.md,
                  paddingTop: index > 0 ? spacing.md : 0,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.memberHeader}>
                <View
                  style={[
                    styles.memberAvatar,
                    {
                      backgroundColor: colors.primaryContainer,
                      borderRadius: borderRadius.pill,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.memberAvatarText,
                      {
                        color: colors.onPrimaryContainer,
                        fontSize: typography.titleMedium.fontSize,
                      },
                    ]}
                  >
                    {member.memberName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.memberName,
                    { color: colors.onSurface, fontSize: typography.bodyLarge.fontSize },
                  ]}
                >
                  {member.memberName}
                </Text>
              </View>
              <View style={[styles.memberStats, { marginTop: spacing.sm }]}>
                <View style={styles.memberStatItem}>
                  <Text
                    style={[
                      styles.memberStatValue,
                      { color: colors.primary, fontSize: typography.headlineMedium.fontSize },
                    ]}
                  >
                    {member.tasksCompleted}
                  </Text>
                  <Text
                    style={[
                      styles.memberStatLabel,
                      { color: colors.onSurfaceVariant, fontSize: typography.labelMedium.fontSize },
                    ]}
                  >
                    Tasks
                  </Text>
                </View>
                <View style={styles.memberStatItem}>
                  <Text
                    style={[
                      styles.memberStatValue,
                      { color: colors.secondary, fontSize: typography.headlineMedium.fontSize },
                    ]}
                  >
                    {member.messagesPosted}
                  </Text>
                  <Text
                    style={[
                      styles.memberStatLabel,
                      { color: colors.onSurfaceVariant, fontSize: typography.labelMedium.fontSize },
                    ]}
                  >
                    Messages
                  </Text>
                </View>
                <View style={styles.memberStatItem}>
                  <Text
                    style={[
                      styles.memberStatValue,
                      { color: colors.tertiary, fontSize: typography.headlineMedium.fontSize },
                    ]}
                  >
                    {member.filesUploaded}
                  </Text>
                  <Text
                    style={[
                      styles.memberStatLabel,
                      { color: colors.onSurfaceVariant, fontSize: typography.labelMedium.fontSize },
                    ]}
                  >
                    Files
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  header: {},
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {},
  sectionTitle: {
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  breakdownSection: {},
  breakdownItem: {},
  breakdownLabel: {
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  activityGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  activityItem: {
    alignItems: 'center',
  },
  activityValue: {
    fontWeight: '700',
    marginTop: 8,
  },
  activityLabel: {
    marginTop: 4,
  },
  memberCard: {},
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontWeight: '700',
  },
  memberName: {
    fontWeight: '600',
  },
  memberStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  memberStatItem: {
    alignItems: 'center',
  },
  memberStatValue: {
    fontWeight: '700',
  },
  memberStatLabel: {
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
