import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { workspaceService, WorkspaceOverview } from '../../services/workspaceService';

export interface WorkspaceHomeScreenProps {
  route?: {
    params?: {
      projectId: string;
      projectTitle?: string;
    };
  };
  navigation?: any;
}

export const WorkspaceHomeScreen: React.FC<WorkspaceHomeScreenProps> = ({ route, navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const projectId = route?.params?.projectId || '';
  const initialTitle = route?.params?.projectTitle || 'Project Workspace';

  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = useCallback(() => {
    if (!projectId) {
      return;
    }

    workspaceService
      .getWorkspaceOverview(projectId)
      .then((data) => {
        setOverview(data);
        setScreenState('populated');
        setErrorMessage(undefined);
      })
      .catch((err: any) => {
        const msg = err?.message || 'Access denied or workspace unavailable';
        setErrorMessage(msg);
        setScreenState('error');
      });
  }, [projectId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await workspaceService.getWorkspaceOverview(projectId);
      setOverview(data);
      setScreenState('populated');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to refresh workspace');
    } finally {
      setRefreshing(false);
    }
  };

  const projectTitle = overview?.project?.title || initialTitle;
  const isLeader = overview?.userRole === 'LEADER';
  const taskMetrics = overview?.metrics?.tasks || {
    todo: 0,
    inProgress: 0,
    testing: 0,
    done: 0,
    total: 0,
    highPriority: 0,
    assignedToMe: 0,
  };
  const chatMetrics = overview?.metrics?.chat || { totalMessages: 0 };
  const fileMetrics = overview?.metrics?.files || { totalCount: 0, totalSize: 0, recent: [] };
  const memberCount = overview?.members?.length || 0;

  // Calculate completion percentage
  const progressPercent = useMemo(() => {
    if (!taskMetrics.total || taskMetrics.total === 0) return 0;
    return Math.round((taskMetrics.done / taskMetrics.total) * 100);
  }, [taskMetrics]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Workspace"
        subtitle={`${memberCount} members • Active`}
        showBack={true}
        onBack={() => navigation?.goBack?.()}
        actions={[
          {
            icon: <Text style={{ fontSize: 18 }}>💬</Text>,
            onPress: () => navigation?.navigate('Chat', { projectId, projectTitle }),
            accessibilityLabel: 'Open chat',
          },
        ]}
      />

      {/* Contextual Sticky Sub-Navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        <TouchableOpacity style={[styles.tabItem, { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}>
          <Text style={[styles.tabTextActive, { color: colors.primary }]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation?.navigate('Kanban', { projectId, projectTitle })}
        >
          <Text style={[styles.tabText, { color: colors.textMuted }]}>Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation?.navigate('Chat', { projectId, projectTitle })}
        >
          <Text style={[styles.tabText, { color: colors.textMuted }]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation?.navigate('Members', { projectId, projectTitle })}
        >
          <Text style={[styles.tabText, { color: colors.textMuted }]}>Team</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation?.navigate('Files', { projectId, projectTitle })}
        >
          <Text style={[styles.tabText, { color: colors.textMuted }]}>Files</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => navigation?.navigate('Analytics', { projectId, projectTitle })}
        >
          <Text style={[styles.tabText, { color: colors.textMuted }]}>Analytics</Text>
        </TouchableOpacity>
      </ScrollView>

      <StateWrapper
        state={screenState}
        errorMessage={errorMessage}
        errorCode="WORKSPACE_ACCESS"
        onRetry={fetchOverview}
        emptyTitle="Workspace Not Found"
        emptySubtitle="This project workspace could not be located."
        emptyActionLabel="Back to Projects"
        onEmptyAction={() => navigation?.navigate('MainApp', { screen: 'Projects' })}
      >
        <ScrollView
          style={styles.container}
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
          {/* Hero Project Cockpit Card */}
          <Card style={[styles.cockpitCard, { marginBottom: spacing.md }]}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text
                  style={[
                    styles.projectTitleText,
                    { color: colors.text, fontSize: typography.h2.fontSize, fontWeight: '700' },
                  ]}
                  numberOfLines={2}
                >
                  {projectTitle}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                  {overview?.project?.domain || 'Workspace'} • {overview?.project?.semester || 'Active'}
                </Text>
              </View>
              <Badge
                label={isLeader ? 'Leader' : 'Member'}
                variant={isLeader ? 'primary' : 'secondary'}
              />
            </View>

            {/* Progress Bar Section */}
            <View style={[styles.progressSection, { marginTop: spacing.md }]}>
              <View style={styles.progressLabelRow}>
                <Text style={[typography.label, { color: colors.textMuted }]}>PROJECT PROGRESS</Text>
                <Text style={[typography.label, { color: colors.primary, fontWeight: '700' }]}>
                  {progressPercent}%
                </Text>
              </View>
              <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: colors.primary,
                      borderRadius: borderRadius.pill,
                    },
                  ]}
                />
              </View>
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4 }]}>
                {taskMetrics.done} completed • {taskMetrics.inProgress} active • {taskMetrics.testing} testing
              </Text>
            </View>
          </Card>

          {/* Section: Kanban Board Cockpit */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[typography.h3, { color: colors.text }]}>Kanban Board</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  Real-time project task workflow
                </Text>
              </View>
              <Badge label={`${taskMetrics.total} Tasks`} variant="tertiary" />
            </View>

            <View style={[styles.taskBreakdownRow, { marginVertical: spacing.md }]}>
              <View style={[styles.metricPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[typography.label, { color: colors.textMuted }]}>TODO</Text>
                <Text style={[typography.h3, { color: colors.text, fontWeight: '700', marginTop: 2 }]}>
                  {taskMetrics.todo}
                </Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                <Text style={[typography.label, { color: colors.primary }]}>ACTIVE</Text>
                <Text style={[typography.h3, { color: colors.primary, fontWeight: '700', marginTop: 2 }]}>
                  {taskMetrics.inProgress}
                </Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: colors.secondarySoft, borderColor: colors.border }]}>
                <Text style={[typography.label, { color: colors.secondary }]}>TEST</Text>
                <Text style={[typography.h3, { color: colors.secondary, fontWeight: '700', marginTop: 2 }]}>
                  {taskMetrics.testing}
                </Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[typography.label, { color: colors.textMuted }]}>DONE</Text>
                <Text style={[typography.h3, { color: colors.text, fontWeight: '700', marginTop: 2 }]}>
                  {taskMetrics.done}
                </Text>
              </View>
            </View>

            <Button
              title="Open Kanban Board"
              variant="primary"
              onPress={() =>
                navigation?.navigate('Kanban', {
                  projectId,
                  projectTitle,
                })
              }
            />
          </Card>

          {/* Section: Team Chat */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[typography.h3, { color: colors.text }]}>Team Chat</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  Live team communication
                </Text>
              </View>
              <Badge label={`${chatMetrics.totalMessages} Messages`} variant="secondary" />
            </View>

            {chatMetrics.lastMessage ? (
              <View
                style={[
                  styles.lastMessageBox,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    marginVertical: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.label, { color: colors.primary, fontWeight: '700' }]}>
                  {chatMetrics.lastMessage.sender?.profile?.fullName ||
                    chatMetrics.lastMessage.sender?.email ||
                    'Teammate'}
                </Text>
                <Text style={[typography.body, { color: colors.text, marginTop: 4 }]} numberOfLines={2}>
                  {chatMetrics.lastMessage.content}
                </Text>
              </View>
            ) : (
              <Text style={[typography.body, { color: colors.textMuted, marginVertical: spacing.md }]}>
                No messages exchanged yet. Start collaborating with your team!
              </Text>
            )}

            <Button
              title="Open Team Chat"
              variant="secondary"
              onPress={() =>
                navigation?.navigate('Chat', {
                  projectId,
                  projectTitle,
                })
              }
            />
          </Card>

          {/* Section: Team Members */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[typography.h3, { color: colors.text }]}>Project Members</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  Confirmed team contributors
                </Text>
              </View>
              <Badge label={`${memberCount} Confirmed`} variant="tertiary" />
            </View>

            <Text style={[typography.body, { color: colors.textMuted, marginVertical: spacing.sm }]}>
              Collaborators currently assigned to this project workspace.
            </Text>

            <Button
              title="View & Manage Members"
              variant="outline"
              onPress={() =>
                navigation?.navigate('Members', {
                  projectId,
                  projectTitle,
                })
              }
            />
          </Card>

          {/* Section: File Sharing */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[typography.h3, { color: colors.text }]}>Shared Files</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  Documents, images, and resources
                </Text>
              </View>
              <Badge label={`${fileMetrics.totalCount} Files`} variant="primary" />
            </View>

            <Text style={[typography.body, { color: colors.textMuted, marginVertical: spacing.sm }]}>
              {fileMetrics.totalCount === 0
                ? 'No files shared yet. Upload documents or images with your team.'
                : `${fileMetrics.totalCount} file${fileMetrics.totalCount !== 1 ? 's' : ''} shared in this project.`}
            </Text>

            <Button
              title="Open Files"
              variant="outline"
              onPress={() =>
                navigation?.navigate('Files', {
                  projectId,
                  projectTitle,
                })
              }
            />
          </Card>

          {/* Section: Peer Evaluation */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[typography.h3, { color: colors.text }]}>Peer Evaluation</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  Rate your teammates' contributions
                </Text>
              </View>
              <Badge label="Feature 10" variant="secondary" />
            </View>

            <Text style={[typography.body, { color: colors.textMuted, marginVertical: spacing.sm }]}>
              Submit honest, criteria-based evaluations for each of your teammates after working together.
            </Text>

            <Button
              title="Open Evaluations"
              variant="secondary"
              onPress={() =>
                navigation?.navigate('Evaluation', {
                  projectId,
                  projectTitle,
                })
              }
            />
          </Card>

          {/* Section: Analytics Dashboard */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[typography.h3, { color: colors.text }]}>Analytics</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  Project progress & team activity
                </Text>
              </View>
              <Badge label={`${taskMetrics.done}/${taskMetrics.total} Done`} variant="primary" />
            </View>

            <View style={[styles.taskBreakdownRow, { marginVertical: spacing.md }]}>
              <View style={[styles.metricPill, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                <Text style={[typography.label, { color: colors.primary }]}>RATE</Text>
                <Text style={[typography.h3, { color: colors.primary, fontWeight: '700', marginTop: 2 }]}>
                  {taskMetrics.total > 0
                    ? `${Math.round((taskMetrics.done / taskMetrics.total) * 100)}%`
                    : '—'}
                </Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[typography.label, { color: colors.textMuted }]}>HIGH PRI</Text>
                <Text style={[typography.h3, { color: colors.accent, fontWeight: '700', marginTop: 2 }]}>
                  {taskMetrics.highPriority}
                </Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: colors.secondarySoft, borderColor: colors.border }]}>
                <Text style={[typography.label, { color: colors.secondary }]}>MINE</Text>
                <Text style={[typography.h3, { color: colors.secondary, fontWeight: '700', marginTop: 2 }]}>
                  {taskMetrics.assignedToMe}
                </Text>
              </View>
            </View>

            <Button
              title="View Full Analytics"
              variant="primary"
              onPress={() =>
                navigation?.navigate('Analytics', {
                  projectId,
                  projectTitle,
                })
              }
            />
          </Card>
        </ScrollView>
      </StateWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  tabBarContent: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontWeight: '500',
    fontSize: 13,
  },
  tabTextActive: {
    fontWeight: '700',
    fontSize: 13,
  },
  cockpitCard: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectTitleText: {
    letterSpacing: -0.2,
  },
  progressSection: {
    marginTop: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  lastMessageBox: {
    borderWidth: 1,
  },
});
