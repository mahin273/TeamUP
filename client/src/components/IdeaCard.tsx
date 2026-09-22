import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Card } from './Card';
import { Badge } from './Badge';
import { Chip } from './Chip';
import { Button } from './Button';

export interface ProjectIdea {
  id: string;
  title: string;
  description: string;
  domain: string;
  techStack: string[];
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDuration?: string;
  teamSize?: string;
  features?: string[];
  likes?: number;
  views?: number;
  isSaved?: boolean;
}

export interface IdeaCardProps {
  idea: ProjectIdea;
  onSaveToggle?: (ideaId: string) => void;
  onUseIdea?: (idea: ProjectIdea) => void;
  onTurnIntoProject?: (idea: ProjectIdea) => void;
  isGenerated?: boolean;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({
  idea,
  onSaveToggle,
  onUseIdea,
  onTurnIntoProject,
  isGenerated = false,
}) => {
  const { colors, typography, spacing } = useTheme();

  const getDifficultyVariant = (level: string): 'primary' | 'secondary' | 'tertiary' => {
    switch (level) {
      case 'ADVANCED':
        return 'tertiary';
      case 'INTERMEDIATE':
        return 'secondary';
      case 'BEGINNER':
      default:
        return 'primary';
    }
  };

  const viewsCount = idea.views || 1240;
  const likesCount = idea.likes || (idea.isSaved ? 343 : 342);

  const handleTurnIntoProject = () => {
    if (onTurnIntoProject) {
      onTurnIntoProject(idea);
    } else if (onUseIdea) {
      onUseIdea(idea);
    }
  };

  return (
    <Card style={[styles.card, { marginTop: spacing.md }]}>
      {/* Header Badge Row */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <Badge
            label={idea.domain}
            variant="primary"
            style={{ marginRight: 6 }}
          />
          <Badge
            label={idea.difficulty}
            variant={getDifficultyVariant(idea.difficulty)}
          />
        </View>

        {isGenerated && (
          <Badge label="✨ AI Generated" variant="tertiary" />
        )}
      </View>

      {/* Idea Title */}
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
        {idea.title}
      </Text>

      {/* Description */}
      <Text
        style={[
          styles.description,
          {
            color: colors.onSurface,
            fontSize: typography.bodyMedium.fontSize,
            marginTop: spacing.xs,
          },
        ]}
      >
        {idea.description}
      </Text>

      {/* Engagement metrics: Views & Likes */}
      <View style={[styles.metricsRow, { marginTop: spacing.xs }]}>
        <Text style={[styles.metricsText, { color: colors.onSurfaceVariant }]}>
          👁 {viewsCount >= 1000 ? `${(viewsCount / 1000).toFixed(1)}k` : viewsCount}
        </Text>
        <Text style={[styles.metricsText, { color: colors.onSurfaceVariant, marginLeft: 16 }]}>
          ♡ {likesCount}
        </Text>
      </View>

      {/* Estimated Duration & Team Size */}
      {(idea.estimatedDuration || idea.teamSize) && (
        <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
          {idea.estimatedDuration && (
            <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]}>
              ⏱️ {idea.estimatedDuration}
            </Text>
          )}
          {idea.teamSize && (
            <Text style={[styles.metaText, { color: colors.onSurfaceVariant, marginLeft: 12 }]}>
              👥 {idea.teamSize}
            </Text>
          )}
        </View>
      )}

      {/* Key Features List */}
      {idea.features && idea.features.length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.onSurfaceVariant },
            ]}
          >
            Key Features:
          </Text>
          {idea.features.map((feat, idx) => (
            <Text
              key={idx}
              style={[
                styles.featureItem,
                { color: colors.onSurface, marginTop: 2 },
              ]}
            >
              • {feat}
            </Text>
          ))}
        </View>
      )}

      {/* Tech Stack Chips */}
      {idea.techStack && idea.techStack.length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.onSurfaceVariant },
            ]}
          >
            Suggested Tech Stack:
          </Text>
          <View style={[styles.chipRow, { marginTop: 4 }]}>
            {idea.techStack.map((tech) => (
              <Chip key={tech} label={tech} selected variant="secondary" style={{ marginRight: 6, marginBottom: 4 }} />
            ))}
          </View>
        </View>
      )}

      {/* Footer Actions */}
      <View style={[styles.footerRow, { marginTop: spacing.md }]}>
        {onSaveToggle && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: idea.isSaved
                  ? colors.primaryContainer
                  : colors.surfaceVariant,
                borderColor: colors.outlineVariant,
              },
            ]}
            onPress={() => onSaveToggle(idea.id)}
          >
            <Text
              style={{
                color: idea.isSaved
                  ? colors.onPrimaryContainer
                  : colors.onSurfaceVariant,
                fontWeight: '600',
                fontSize: 13,
              }}
            >
              {idea.isSaved ? "✓ I'm Interested" : "I'm Interested"}
            </Text>
          </TouchableOpacity>
        )}

        {(onTurnIntoProject || onUseIdea) && (
          <Button
            title="Turn into Project"
            onPress={handleTurnIntoProject}
            variant="primary"
            size="sm"
            style={{ minWidth: 130, maxWidth: 170 }}
          />
        )}
      </View>
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
  },
  title: {
    fontWeight: '700',
  },
  description: {
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  featureItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
