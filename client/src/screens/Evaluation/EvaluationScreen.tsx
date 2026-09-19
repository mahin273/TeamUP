import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { api, ApiError } from '../../api/client';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Evaluation {
  memberId: string;
  technicalSkills: number;
  communication: number;
  collaboration: number;
  reliability: number;
  comments: string;
}

interface EvaluationScreenProps {
  projectId: string;
  currentUserId: string;
}

export const EvaluationScreen: React.FC<EvaluationScreenProps> = ({ projectId, currentUserId }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criteria = [
    { key: 'technicalSkills', label: 'Technical Skills' },
    { key: 'communication', label: 'Communication' },
    { key: 'collaboration', label: 'Collaboration' },
    { key: 'reliability', label: 'Reliability' },
  ];

  const fetchMembers = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<TeamMember[]>(`/projects/${projectId}/members`);
      // Filter out current user
      const otherMembers = response.filter((m) => m.id !== currentUserId);
      setMembers(otherMembers);

      // Initialize evaluations
      const initialEvaluations: Record<string, Evaluation> = {};
      otherMembers.forEach((member) => {
        initialEvaluations[member.id] = {
          memberId: member.id,
          technicalSkills: 3,
          communication: 3,
          collaboration: 3,
          reliability: 3,
          comments: '',
        };
      });
      setEvaluations(initialEvaluations);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load team members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, currentUserId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const updateEvaluation = (
    memberId: string,
    field: keyof Evaluation,
    value: number | string
  ) => {
    setEvaluations((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value,
      },
    }));
  };

  const submitEvaluations = async () => {
    // Validate all evaluations have comments
    const missingComments = Object.values(evaluations).some((ev) => !ev.comments.trim());
    if (missingComments) {
      Alert.alert('Incomplete Evaluation', 'Please provide comments for all team members');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/projects/${projectId}/evaluations`, {
        evaluations: Object.values(evaluations),
      });
      Alert.alert('Success', 'Evaluations submitted successfully');
    } catch (err) {
      const apiError = err as ApiError;
      Alert.alert('Submission Failed', apiError.message || 'Failed to submit evaluations');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarRating = (
    memberId: string,
    criterion: keyof Evaluation,
    currentValue: number
  ) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Text
            key={star}
            style={[styles.star, { fontSize: 32, marginHorizontal: 2 }]}
            onPress={() => updateEvaluation(memberId, criterion, star)}
          >
            {star <= currentValue ? '⭐' : '☆'}
          </Text>
        ))}
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
          Loading team members...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
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
          onPress={fetchMembers}
          variant="outline"
          style={{ marginTop: spacing.md }}
        />
      </View>
    );
  }

  if (members.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>👥</Text>
        <Text
          style={[
            styles.emptyTitle,
            { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
          ]}
        >
          No Team Members
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
          You need team members to evaluate
        </Text>
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
            Peer Evaluation
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
            Evaluate your teammates' contributions
          </Text>
        </View>

        {/* Evaluation Cards */}
        {members.map((member) => {
          const evaluation = evaluations[member.id];
          if (!evaluation) return null;

          return (
            <Card key={member.id} style={{ marginBottom: spacing.md }}>
              {/* Member Header */}
              <View style={styles.memberHeader}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: colors.primaryContainer,
                      borderRadius: borderRadius.pill,
                      width: 48,
                      height: 48,
                      justifyContent: 'center',
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      {
                        color: colors.onPrimaryContainer,
                        fontSize: typography.headlineMedium.fontSize,
                      },
                    ]}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.memberInfo, { marginLeft: spacing.md }]}>
                  <Text
                    style={[
                      styles.memberName,
                      { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
                    ]}
                  >
                    {member.name}
                  </Text>
                  <Text
                    style={[
                      styles.memberEmail,
                      {
                        color: colors.onSurfaceVariant,
                        fontSize: typography.bodyMedium.fontSize,
                      },
                    ]}
                  >
                    {member.email}
                  </Text>
                </View>
              </View>

              {/* Criteria Ratings */}
              {criteria.map((criterion) => (
                <View key={criterion.key} style={[styles.criterionSection, { marginTop: spacing.md }]}>
                  <Text
                    style={[
                      styles.criterionLabel,
                      {
                        color: colors.onSurface,
                        fontSize: typography.bodyLarge.fontSize,
                        marginBottom: spacing.xs,
                      },
                    ]}
                  >
                    {criterion.label}
                  </Text>
                  {renderStarRating(
                    member.id,
                    criterion.key as keyof Evaluation,
                    evaluation[criterion.key as keyof Evaluation] as number
                  )}
                </View>
              ))}

              {/* Comments */}
              <View style={[styles.commentsSection, { marginTop: spacing.md }]}>
                <Text
                  style={[
                    styles.commentsLabel,
                    {
                      color: colors.onSurface,
                      fontSize: typography.bodyLarge.fontSize,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  Comments
                </Text>
                <TextInput
                  style={[
                    styles.commentsInput,
                    {
                      backgroundColor: colors.surfaceVariant,
                      color: colors.onSurface,
                      borderRadius: borderRadius.md,
                      padding: spacing.sm,
                      fontSize: typography.bodyMedium.fontSize,
                      minHeight: 80,
                      textAlignVertical: 'top',
                    },
                  ]}
                  placeholder="Share your feedback..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={evaluation.comments}
                  onChangeText={(text) => updateEvaluation(member.id, 'comments', text)}
                  multiline
                  maxLength={500}
                />
              </View>
            </Card>
          );
        })}

        {/* Submit Button */}
        <Button
          title="Submit Evaluations"
          onPress={submitEvaluations}
          loading={submitting}
          style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
        />
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
  emptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  header: {},
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {},
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {},
  avatarText: {
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontWeight: '600',
  },
  memberEmail: {},
  criterionSection: {},
  criterionLabel: {
    fontWeight: '600',
  },
  starContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {},
  commentsSection: {},
  commentsLabel: {
    fontWeight: '600',
  },
  commentsInput: {},
});
