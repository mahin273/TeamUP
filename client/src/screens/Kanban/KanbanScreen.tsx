import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { TaskCard, Task, TaskStatus } from '../../components/TaskCard';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { api, ApiError } from '../../api/client';

interface KanbanScreenProps {
  projectId: string;
}

export const KanbanScreen: React.FC<KanbanScreenProps> = ({ projectId }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'ALL'>('ALL');

  const statuses: { key: TaskStatus | 'ALL'; label: string; color: string }[] = [
    { key: 'ALL', label: 'All', color: colors.onSurfaceVariant },
    { key: 'TODO', label: 'To Do', color: colors.onSurfaceVariant },
    { key: 'IN_PROGRESS', label: 'In Progress', color: colors.secondary },
    { key: 'TESTING', label: 'Testing', color: colors.tertiary },
    { key: 'DONE', label: 'Done', color: colors.primary },
  ];

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<Task[]>(`/projects/${projectId}/tasks`);
      setTasks(response);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task))
      );
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to update task status:', apiError.message);
    }
  };

  const getFilteredTasks = (): Task[] => {
    if (selectedStatus === 'ALL') {
      return tasks;
    }
    return tasks.filter((task) => task.status === selectedStatus);
  };

  const getTaskCountByStatus = (status: TaskStatus): number => {
    return tasks.filter((task) => task.status === status).length;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
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
            Loading tasks...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
          <Text
            style={[
              styles.errorText,
              { color: colors.error, fontSize: typography.bodyLarge.fontSize },
            ]}
          >
            {error}
          </Text>
          <Button
            title="Retry"
            onPress={fetchTasks}
            variant="outline"
            style={{ marginTop: spacing.md }}
          />
        </View>
      );
    }

    const filteredTasks = getFilteredTasks();

    if (filteredTasks.length === 0) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
          <Text
            style={[
              styles.emptyTitle,
              { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
            ]}
          >
            No Tasks Yet
          </Text>
          <Text
            style={[
              styles.emptyText,
              {
                color: colors.onSurfaceVariant,
                fontSize: typography.bodyMedium.fontSize,
                marginTop: spacing.sm,
              },
            ]}
          >
            Create your first task to get started
          </Text>
          <Button
            title="Create Task"
            onPress={() => {
              /* Navigate to create task */
            }}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      );
    }

    return (
      <View style={{ paddingBottom: spacing.xl }}>
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onPress={() => {
              /* Navigate to task details */
            }}
            onStatusChange={handleStatusChange}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.xl, paddingHorizontal: spacing.md }]}>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.onBackground, fontSize: typography.displayLarge.fontSize },
          ]}
        >
          Kanban Board
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
          Track your team's progress
        </Text>
      </View>

      {/* Stats Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.statsContainer, { marginTop: spacing.md }]}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
      >
        {statuses
          .filter((s) => s.key !== 'ALL')
          .map((status) => {
            const count = getTaskCountByStatus(status.key as TaskStatus);
            return (
              <Card
                key={status.key}
                style={[styles.statCard, { marginRight: spacing.sm }]}
                variant="surfaceVariant"
              >
                <Text
                  style={[
                    styles.statCount,
                    { color: status.color, fontSize: typography.displayLarge.fontSize },
                  ]}
                >
                  {count}
                </Text>
                <Text
                  style={[
                    styles.statLabel,
                    {
                      color: colors.onSurfaceVariant,
                      fontSize: typography.labelMedium.fontSize,
                      marginTop: spacing.xs,
                    },
                  ]}
                >
                  {status.label}
                </Text>
              </Card>
            );
          })}
      </ScrollView>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterContainer, { marginTop: spacing.md }]}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
      >
        {statuses.map((status) => (
          <Pressable
            key={status.key}
            onPress={() => setSelectedStatus(status.key)}
            style={[
              styles.filterTab,
              {
                backgroundColor:
                  selectedStatus === status.key ? colors.primaryContainer : colors.surfaceVariant,
                borderRadius: borderRadius.pill,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                marginRight: spacing.sm,
              },
            ]}
          >
            <Text
              style={[
                styles.filterTabText,
                {
                  color:
                    selectedStatus === status.key
                      ? colors.onPrimaryContainer
                      : colors.onSurfaceVariant,
                  fontSize: typography.bodyMedium.fontSize,
                  fontWeight: '600',
                },
              ]}
            >
              {status.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Task List */}
      <ScrollView
        style={[styles.scrollView, { marginTop: spacing.md }]}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* FAB - Create Task */}
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            position: 'absolute',
            bottom: spacing.lg,
            right: spacing.lg,
          },
        ]}
        onPress={() => {
          /* Navigate to create task */
        }}
      >
        <Text style={[styles.fabText, { color: colors.onPrimary, fontSize: 24 }]}>+</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {},
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {},
  statsContainer: {
    maxHeight: 100,
  },
  statCard: {
    width: 100,
    alignItems: 'center',
  },
  statCount: {
    fontWeight: '700',
  },
  statLabel: {
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  filterContainer: {
    maxHeight: 50,
  },
  filterTab: {},
  filterTabText: {},
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    fontWeight: '700',
  },
});
