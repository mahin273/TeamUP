import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import {
  analyticsService,
  ProjectAnalytics,
  TaskCompletionDataPoint,
  MemberContribution,
  ActivityDataPoint,
} from '../../services/analyticsService';

export interface AnalyticsDashboardScreenProps {
  route?: {
    params?: {
      projectId: string;
      projectTitle?: string;
    };
  };
  navigation?: any;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_PADDING = 32; // 16px each side
const CHART_WIDTH = SCREEN_WIDTH - CHART_PADDING * 2;

// ─── Skeleton shimmer component ────────────────────────────────────────────────

const SkeletonBlock: React.FC<{ width?: number | string; height: number; borderRadius?: number; style?: any }> = ({
  width = '100%', height, borderRadius = 8, style,
}) => {
  const { colors } = useTheme();
  const opacity = useState(new Animated.Value(0.3))[0];

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.border, opacity }, style]}
    />
  );
};

// ─── Inline bar chart (no external lib) ───────────────────────────────────────

const BarChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  maxValue: number;
  height?: number;
}> = ({ data, maxValue, height = 140 }) => {
  const { colors, typography, spacing } = useTheme();
  if (!data.length || maxValue === 0) return null;

  const barWidth = Math.max(12, Math.floor((CHART_WIDTH / data.length) * 0.55));

  return (
    <View style={{ width: CHART_WIDTH }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, paddingBottom: 0 }}>
        {data.map((item, i) => {
          const barH = Math.max(4, Math.round((item.value / maxValue) * height * 0.85));
          return (
            <View
              key={i}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <Text style={[typography.bodySmall, { color: colors.textMuted, fontSize: 10, marginBottom: 2 }]}>
                {item.value > 0 ? item.value : ''}
              </Text>
              <View
                style={{
                  width: barWidth,
                  height: barH,
                  backgroundColor: item.color,
                  borderRadius: 4,
                }}
              />
            </View>
          );
        })}
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
        {data.map((item, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[typography.bodySmall, { color: colors.textMuted, fontSize: 10 }]} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Horizontal progress bar ───────────────────────────────────────────────────

const HorizontalBar: React.FC<{ value: number; max: number; color: string; height?: number }> = ({
  value, max, color, height = 8,
}) => {
  const { colors } = useTheme();
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ height, backgroundColor: colors.border, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ height, width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
};

// ─── Loading skeleton layout ───────────────────────────────────────────────────

const LoadingSkeleton: React.FC = () => {
  const { spacing } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: 60 }}>
      {/* Summary cards skeleton */}
      <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, marginHorizontal: 4 }}>
            <SkeletonBlock height={72} borderRadius={14} />
          </View>
        ))}
      </View>
      {/* Status breakdown skeleton */}
      <SkeletonBlock height={160} borderRadius={14} style={{ marginBottom: spacing.md }} />
      {/* Bar chart skeleton */}
      <SkeletonBlock height={200} borderRadius={14} style={{ marginBottom: spacing.md }} />
      {/* Member contributions skeleton */}
      <SkeletonBlock height={220} borderRadius={14} style={{ marginBottom: spacing.md }} />
      {/* Activity skeleton */}
      <SkeletonBlock height={160} borderRadius={14} />
    </ScrollView>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const AnalyticsDashboardScreen: React.FC<AnalyticsDashboardScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const projectId = route?.params?.projectId || '';
  const projectTitle = route?.params?.projectTitle || 'Analytics';

  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchAnalytics = useCallback(() => {
    if (!projectId) return;

    analyticsService
      .getProjectAnalytics(projectId)
      .then((data) => {
        setAnalytics(data);
        // Treat as empty only if truly no tasks at all
        setScreenState(data.totalTasks === 0 ? 'empty' : 'populated');
        setErrorMessage(undefined);
      })
      .catch((err: any) => {
        setErrorMessage(err?.message || 'Failed to load analytics.');
        setScreenState('error');
      });
  }, [projectId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Re-fetch on screen focus (navigation focus event)
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', fetchAnalytics);
    return unsubscribe;
  }, [navigation, fetchAnalytics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await analyticsService.getProjectAnalytics(projectId);
      setAnalytics(data);
      setScreenState(data.totalTasks === 0 ? 'empty' : 'populated');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }, [projectId]);

  // ─── Render sections ─────────────────────────────────────────────────────

  const renderSummaryCards = (data: ProjectAnalytics) => (
    <View style={[styles.summaryRow, { marginBottom: spacing.md }]}>
      {/* Completion rate */}
      <View style={[styles.summaryCard, { backgroundColor: colors.primarySoft, borderRadius: borderRadius.md, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[typography.display, { color: colors.primary, textAlign: 'center' }]}>
          {data.overallCompletionRate}%
        </Text>
        <Text style={[typography.label, { color: colors.primary, textAlign: 'center', marginTop: 2 }]}>
          COMPLETE
        </Text>
      </View>

      {/* Total tasks */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surfaceMuted, borderRadius: borderRadius.md, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[typography.display, { color: colors.text, textAlign: 'center' }]}>
          {data.totalTasks}
        </Text>
        <Text style={[typography.label, { color: colors.textMuted, textAlign: 'center', marginTop: 2 }]}>
          TASKS
        </Text>
      </View>

      {/* Files shared */}
      <View style={[styles.summaryCard, { backgroundColor: colors.secondarySoft, borderRadius: borderRadius.md, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[typography.display, { color: colors.secondary, textAlign: 'center' }]}>
          {data.totalFiles}
        </Text>
        <Text style={[typography.label, { color: colors.secondary, textAlign: 'center', marginTop: 2 }]}>
          FILES
        </Text>
      </View>
    </View>
  );

  const renderStatusBreakdown = (data: ProjectAnalytics) => {
    const statuses = [
      { label: 'To Do',       value: data.tasksByStatus.TODO,        color: colors.border,   textColor: colors.textMuted },
      { label: 'In Progress', value: data.tasksByStatus.IN_PROGRESS, color: colors.primary,  textColor: colors.primary },
      { label: 'Testing',     value: data.tasksByStatus.TESTING,     color: colors.secondary,textColor: colors.secondary },
      { label: 'Done',        value: data.tasksByStatus.DONE,        color: colors.accent,   textColor: colors.accent },
    ];

    return (
      <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>Task Status Breakdown</Text>
          <Badge label={`${data.totalTasks} total`} variant="tertiary" />
        </View>

        <View style={[styles.statusGrid, { marginTop: spacing.md }]}>
          {statuses.map((s) => (
            <View key={s.label} style={styles.statusCell}>
              <Text style={[typography.display, { color: s.textColor, textAlign: 'center', fontSize: 24 }]}>
                {s.value}
              </Text>
              <Text style={[typography.label, { color: s.textColor, textAlign: 'center', marginTop: 2, fontSize: 10 }]}>
                {s.label.toUpperCase()}
              </Text>
              <View style={{ marginTop: spacing.xs }}>
                <HorizontalBar
                  value={s.value}
                  max={data.totalTasks}
                  color={s.color}
                  height={6}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Priority breakdown */}
        <View style={[styles.priorityRow, { marginTop: spacing.lg, paddingTop: spacing.md, borderTopColor: colors.border, borderTopWidth: 1 }]}>
          <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            PRIORITY DISTRIBUTION
          </Text>
          {[
            { label: 'High Priority',   value: data.tasksByPriority.HIGH,   color: colors.accent,   variant: 'error' as const },
            { label: 'Medium Priority', value: data.tasksByPriority.MEDIUM, color: colors.warning,  variant: 'warning' as const },
            { label: 'Low Priority',    value: data.tasksByPriority.LOW,    color: colors.secondary,variant: 'secondary' as const },
          ].map((p) => (
            <View key={p.label} style={[styles.priorityItem, { marginBottom: spacing.sm }]}>
              <View style={styles.priorityLabelRow}>
                <Badge label={p.label} variant={p.variant} style={{ marginRight: spacing.sm }} />
                <Text style={[typography.label, { color: colors.textMuted }]}>{p.value} tasks</Text>
              </View>
              <HorizontalBar value={p.value} max={data.totalTasks} color={p.color} />
            </View>
          ))}
        </View>
      </Card>
    );
  };

  const renderTaskCompletionChart = (data: ProjectAnalytics) => {
    const points = data.taskCompletionOverTime;
    if (!points || points.length === 0) {
      return (
        <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
            Task Completion Over Time
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
            No time-series data available yet.
          </Text>
        </Card>
      );
    }

    // Show last 7 data points max to keep chart readable
    const visible = points.slice(-7);
    const maxCompleted = Math.max(...visible.map((p) => p.completed), 1);

    const barData = visible.map((p: TaskCompletionDataPoint) => {
      const dateLabel = new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return { label: dateLabel, value: p.completed, color: colors.primary };
    });

    return (
      <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>Tasks Completed</Text>
          <Badge label="Last 7 days" variant="primary" />
        </View>

        <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.md }]}>
          Daily completed task count
        </Text>

        <BarChart data={barData} maxValue={maxCompleted} height={120} />

        <View style={[styles.chartLegend, { marginTop: spacing.md }]}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Completed per day</Text>
        </View>
      </Card>
    );
  };

  const renderMemberContributions = (data: ProjectAnalytics) => {
    const members = data.memberContributions;
    if (!members || members.length === 0) return null;

    const maxCompleted = Math.max(...members.map((m) => m.tasksCompleted), 1);

    return (
      <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={[styles.sectionHeader, { marginBottom: spacing.md }]}>
          <Text style={[typography.h3, { color: colors.text }]}>Member Contributions</Text>
          <Badge label={`${members.length} members`} variant="secondary" />
        </View>

        {members.map((member: MemberContribution) => (
          <View key={member.memberId} style={[styles.memberRow, { marginBottom: spacing.md }]}>
            {/* Avatar */}
            <View style={[styles.memberAvatar, { backgroundColor: colors.primarySoft }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                {member.avatarInitial}
              </Text>
            </View>

            {/* Info */}
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <View style={styles.memberNameRow}>
                <Text style={[typography.h3, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {member.memberName}
                </Text>
                <Badge
                  label={`${member.completionRate}%`}
                  variant={member.completionRate >= 80 ? 'secondary' : member.completionRate >= 50 ? 'primary' : 'error'}
                />
              </View>

              <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                {member.tasksCompleted}/{member.tasksAssigned} tasks completed
              </Text>

              <HorizontalBar
                value={member.tasksCompleted}
                max={maxCompleted}
                color={colors.primary}
                height={7}
              />
            </View>
          </View>
        ))}
      </Card>
    );
  };

  const renderActivityChart = (data: ProjectAnalytics) => {
    const activity = data.activityOverTime;
    if (!activity || activity.length === 0) return null;

    const visible = activity.slice(-7);
    const maxMessages = Math.max(...visible.map((p) => p.messages), 1);

    const msgData = visible.map((p: ActivityDataPoint) => {
      const dateLabel = new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return { label: dateLabel, value: p.messages, color: colors.secondary };
    });

    return (
      <Card style={[styles.sectionCard, { marginBottom: spacing.md }]}>
        <View style={styles.sectionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>Team Activity</Text>
          <Badge label="Messages / day" variant="secondary" />
        </View>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.md }]}>
          Chat messages per day over the last 7 days
        </Text>
        <BarChart data={msgData} maxValue={maxMessages} height={100} />
        <View style={[styles.chartLegend, { marginTop: spacing.md }]}>
          <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Messages sent</Text>
        </View>
      </Card>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Analytics"
        subtitle={projectTitle}
        showBack={true}
        onBack={() => navigation?.goBack?.()}
        actions={[
          {
            icon: <Text style={{ fontSize: 18 }}>🔄</Text>,
            onPress: onRefresh,
            accessibilityLabel: 'Refresh analytics',
          },
        ]}
      />

      {/* Show skeleton during loading — matches card geometry */}
      {screenState === 'loading' ? (
        <LoadingSkeleton />
      ) : (
        <StateWrapper
          state={screenState}
          errorMessage={errorMessage}
          onRetry={fetchAnalytics}
          emptyTitle="No Project Activity Yet"
          emptySubtitle="Analytics will appear here once your team starts creating and completing tasks."
          emptyActionLabel="Refresh"
          onEmptyAction={fetchAnalytics}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {analytics && (
              <>
                {renderSummaryCards(analytics)}
                {renderStatusBreakdown(analytics)}
                {renderTaskCompletionChart(analytics)}
                {renderMemberContributions(analytics)}
                {renderActivityChart(analytics)}

                <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
                  Last updated {new Date(analytics.generatedAt).toLocaleString(undefined, {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </>
            )}
          </ScrollView>
        </StateWrapper>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
  },
  statusCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  priorityRow: {},
  priorityItem: {},
  priorityLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
});
