import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Card } from './Card';
import { Badge } from './Badge';
import * as Haptics from 'expo-haptics';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'TESTING' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  dueDate?: string;
  tags?: string[];
}

interface TaskCardProps {
  task: Task;
  onPress?: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onPress, onStatusChange }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const getPriorityColor = (priority?: TaskPriority) => {
    switch (priority) {
      case 'HIGH':
        return colors.error;
      case 'MEDIUM':
        return colors.tertiary;
      case 'LOW':
        return colors.secondary;
      default:
        return colors.onSurfaceVariant;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return colors.onSurfaceVariant;
      case 'IN_PROGRESS':
        return colors.secondary;
      case 'TESTING':
        return colors.tertiary;
      case 'DONE':
        return colors.primary;
      default:
        return colors.onSurfaceVariant;
    }
  };

  return (
    <Card onPress={onPress} enableHaptics style={{ marginBottom: spacing.sm }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: colors.onSurface, fontSize: typography.bodyLarge.fontSize },
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          {task.priority && (
            <Badge
              label={task.priority}
              color={getPriorityColor(task.priority)}
              size="small"
            />
          )}
        </View>

        {/* Description */}
        {task.description && (
          <Text
            style={[
              styles.description,
              {
                color: colors.onSurfaceVariant,
                fontSize: typography.bodyMedium.fontSize,
                marginTop: spacing.xs,
              },
            ]}
            numberOfLines={2}
          >
            {task.description}
          </Text>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <View style={[styles.tags, { marginTop: spacing.sm }]}>
            {task.tags.map((tag, index) => (
              <View
                key={index}
                style={[
                  styles.tag,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderRadius: borderRadius.pill,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs / 2,
                    marginRight: spacing.xs,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    {
                      color: colors.onSurfaceVariant,
                      fontSize: typography.labelMedium.fontSize,
                    },
                  ]}
                >
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={[styles.footer, { marginTop: spacing.sm }]}>
          <View style={styles.assigneeSection}>
            {task.assignee && (
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.primaryContainer, borderRadius: borderRadius.pill },
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    { color: colors.onPrimaryContainer, fontSize: typography.labelMedium.fontSize },
                  ]}
                >
                  {task.assignee.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {task.dueDate && (
              <Text
                style={[
                  styles.dueDate,
                  { color: colors.onSurfaceVariant, fontSize: typography.labelMedium.fontSize },
                ]}
              >
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(task.status) + '20',
                borderRadius: borderRadius.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs / 2,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(task.status), fontSize: typography.labelMedium.fontSize },
              ]}
            >
              {task.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontWeight: '600',
    marginRight: 8,
  },
  description: {
    lineHeight: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {},
  tagText: {
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assigneeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '600',
  },
  dueDate: {},
  statusBadge: {},
  statusText: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
