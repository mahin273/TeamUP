import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Card } from './Card';
import { Badge } from './Badge';
import { Chip } from './Chip';
import { Button } from './Button';

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export interface ProjectListing {
  id: string;
  title: string;
  description: string;
  domain: string;
  semester?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  requiredSkills?: string[];
  techStack?: string[];
  ownerName?: string;
  memberCount?: number;
  maxMembers?: number;
  isBookmarked?: boolean;
}

export interface ProjectCardProps {
  project: ProjectListing;
  onPress?: () => void;
  onBookmarkToggle?: (projectId: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onPress,
  onBookmarkToggle,
}) => {
  const { colors, typography, spacing } = useTheme();

  const getStatusVariant = (status: string): 'primary' | 'secondary' | 'tertiary' | 'error' => {
    switch (status) {
      case 'OPEN':
        return 'primary';
      case 'IN_PROGRESS':
        return 'secondary';
      case 'COMPLETED':
        return 'tertiary';
      default:
        return 'primary';
    }
  };

  const handleBookmarkPress = () => {
    if (!onBookmarkToggle) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore haptics error in test environment
      }
    }
    onBookmarkToggle(project.id);
  };

  const skillsList = project.requiredSkills || project.techStack || [];

  return (
    <Card style={[styles.card, { marginTop: spacing.md }]} onPress={onPress}>
      {/* Header Badges */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <Badge
            label={project.domain}
            variant="primary"
            style={{ marginRight: 6 }}
          />
          {project.semester && (
            <Badge
              label={project.semester}
              variant="secondary"
              style={{ marginRight: 6 }}
            />
          )}
          <Badge
            label={project.status}
            variant={getStatusVariant(project.status)}
          />
        </View>

        {onBookmarkToggle && (
          <TouchableOpacity
            style={[
              styles.bookmarkBtn,
              {
                backgroundColor: project.isBookmarked
                  ? colors.primaryContainer
                  : colors.surfaceVariant,
              },
            ]}
            onPress={handleBookmarkPress}
          >
            <Text style={{ fontSize: 16 }}>
              {project.isBookmarked ? '🔖' : '🏷️'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Project Title */}
      <Text
        style={[
          styles.title,
          {
            color: colors.onSurface,
            fontSize: typography.headlineMedium.fontSize,
            marginTop: spacing.xs,
          },
        ]}
      >
        {project.title}
      </Text>

      {/* Owner & Member Count */}
      <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
        {project.ownerName && (
          <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]}>
            👤 Created by {project.ownerName}
          </Text>
        )}
        {project.memberCount !== undefined && (
          <Text
            style={[
              styles.metaText,
              { color: colors.onSurfaceVariant, marginLeft: 12 },
            ]}
          >
            👥 {project.memberCount}
            {project.maxMembers ? `/${project.maxMembers}` : ''} members
          </Text>
        )}
      </View>

      {/* Description */}
      <Text
        numberOfLines={3}
        style={[
          styles.description,
          {
            color: colors.onSurface,
            fontSize: typography.bodyMedium.fontSize,
            marginTop: spacing.xs,
          },
        ]}
      >
        {project.description}
      </Text>

      {/* Tech Stack Chips */}
      {skillsList.length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          <View style={styles.chipRow}>
            {skillsList.map((skill) => (
              <Chip key={skill} label={skill} selected variant="secondary" />
            ))}
          </View>
        </View>
      )}

      {/* Footer Action Button */}
      {onPress && (
        <Button
          title="View Project Details"
          onPress={onPress}
          variant="outline"
          style={{ marginTop: spacing.md }}
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  bookmarkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  title: {
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
