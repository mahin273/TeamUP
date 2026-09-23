import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  RefreshControl,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import {
  evaluationService,
  Evaluation,
  SubmitEvaluationInput,
  validateEvaluationInput,
  computeAverageScore,
} from '../../services/evaluationService';
import { workspaceService } from '../../services/workspaceService';
import { ProjectMember } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';

export interface EvaluationScreenProps {
  route?: {
    params?: {
      projectId: string;
      projectTitle?: string;
    };
  };
  navigation?: any;
}

type TabView = 'form' | 'submitted';

const CRITERIA: { key: keyof SubmitEvaluationInput & string; label: string; description: string }[] = [
  { key: 'technicalSkill',      label: 'Technical Skill',       description: 'Quality of code, designs, or deliverables produced' },
  { key: 'communication',       label: 'Communication',         description: 'Clarity of updates, responsiveness, and team alignment' },
  { key: 'teamwork',            label: 'Teamwork',              description: 'Helpfulness, collaboration, and attitude toward others' },
  { key: 'reliability',         label: 'Reliability',           description: 'Meeting deadlines and following through on commitments' },
  { key: 'overallContribution', label: 'Overall Contribution',  description: 'Net positive impact on the project's success' },
];

const SCORE_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { /* ignore */ }
  }
};

export const EvaluationScreen: React.FC<EvaluationScreenProps> = ({ route, navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { user } = useAuth();
  const projectId = route?.params?.projectId || '';
  const projectTitle = route?.params?.projectTitle || 'Evaluation';

  // ─── Screen state ──────────────────────────────────────────────────────────
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('form');

  // ─── Members & submitted evaluations ──────────────────────────────────────
  const [teammates, setTeammates] = useState<ProjectMember[]>([]);
  const [myEvaluations, setMyEvaluations] = useState<Evaluation[]>([]);

  // ─── Form state ────────────────────────────────────────────────────────────
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, number>>({
    technicalSkill: 0,
    communication: 0,
    teamwork: 0,
    reliability: 0,
    overallContribution: 0,
  });
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ─── Success confirmation modal ────────────────────────────────────────────
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmedName, setConfirmedName] = useState('');

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(() => {
    if (!projectId) return;

    Promise.all([
      workspaceService.getProjectMembers(projectId),
      evaluationService.getMyEvaluations(projectId),
    ])
      .then(([members, evals]) => {
        // Exclude the current user from the teammate list
        const others = (members || []).filter(
          (m) => m.userId !== user?.id && m.status === 'ACCEPTED'
        );
        setTeammates(others);
        setMyEvaluations(evals || []);
        setScreenState(others.length > 0 ? 'populated' : 'empty');
        setErrorMessage(undefined);
      })
      .catch((err: any) => {
        setErrorMessage(err?.message || 'Failed to load evaluation data.');
        setScreenState('error');
      });
  }, [projectId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [members, evals] = await Promise.all([
        workspaceService.getProjectMembers(projectId),
        evaluationService.getMyEvaluations(projectId),
      ]);
      const others = (members || []).filter(
        (m) => m.userId !== user?.id && m.status === 'ACCEPTED'
      );
      setTeammates(others);
      setMyEvaluations(evals || []);
      setScreenState(others.length > 0 ? 'populated' : 'empty');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }, [projectId, user?.id]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Check whether the current user has already submitted an eval for a given member */
  const hasEvaluated = (memberId: string): boolean =>
    myEvaluations.some((e) => e.evaluateeId === memberId);

  const getEvaluationForMember = (memberId: string): Evaluation | undefined =>
    myEvaluations.find((e) => e.evaluateeId === memberId);

  const getMemberName = (member: ProjectMember): string =>
    member.user?.profile?.fullName || member.user?.email || `Member #${member.userId.slice(-4)}`;

  const resetForm = () => {
    setSelectedMemberId('');
    setScores({ technicalSkill: 0, communication: 0, teamwork: 0, reliability: 0, overallContribution: 0 });
    setComments('');
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const input: Partial<SubmitEvaluationInput> = {
      evaluateeId: selectedMemberId,
      technicalSkill: scores.technicalSkill,
      communication: scores.communication,
      teamwork: scores.teamwork,
      reliability: scores.reliability,
      overallContribution: scores.overallContribution,
      comments: comments.trim() || undefined,
    };

    const validationError = validateEvaluationInput(input);
    if (validationError) {
      Alert.alert('Incomplete Evaluation', validationError);
      return;
    }

    // Guard: duplicate submission
    if (hasEvaluated(selectedMemberId)) {
      Alert.alert(
        'Already Submitted',
        'You have already evaluated this teammate. Would you like to edit your previous evaluation?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Edit',
            onPress: () => {
              const existing = getEvaluationForMember(selectedMemberId);
              if (existing) handleEditExisting(existing);
            },
          },
        ]
      );
      return;
    }

    setSubmitting(true);
    try {
      const submitted = await evaluationService.submitEvaluation(
        projectId,
        input as SubmitEvaluationInput
      );
      triggerHaptic();

      // Update local state
      setMyEvaluations((prev) => [submitted, ...prev]);

      const member = teammates.find((m) => m.userId === selectedMemberId);
      setConfirmedName(member ? getMemberName(member) : 'your teammate');
      resetForm();
      setConfirmVisible(true);
    } catch (err: any) {
      Alert.alert('Submission Failed', err?.message || 'Your evaluation could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditExisting = async (existing: Evaluation) => {
    // Pre-fill form with the existing evaluation and open it
    setSelectedMemberId(existing.evaluateeId);
    setScores({
      technicalSkill: existing.technicalSkill,
      communication: existing.communication,
      teamwork: existing.teamwork,
      reliability: existing.reliability,
      overallContribution: existing.overallContribution,
    });
    setComments(existing.comments || '');
    setActiveTab('form');
  };

  // ─── Score picker row ──────────────────────────────────────────────────────

  const renderScoreRow = (criterion: typeof CRITERIA[0]) => {
    const currentScore = scores[criterion.key] as number;
    return (
      <View key={criterion.key} style={{ marginBottom: spacing.lg }}>
        <View style={styles.criterionHeader}>
          <Text style={[typography.h3, { color: colors.text }]}>{criterion.label}</Text>
          {currentScore > 0 && (
            <Badge
              label={`${currentScore}/5 · ${SCORE_LABELS[currentScore]}`}
              variant={currentScore >= 4 ? 'secondary' : currentScore >= 3 ? 'primary' : 'error'}
            />
          )}
        </View>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          {criterion.description}
        </Text>
        <View style={styles.scoreRow}>
          {[1, 2, 3, 4, 5].map((score) => {
            const isSelected = currentScore === score;
            return (
              <TouchableOpacity
                key={score}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${criterion.label} score ${score}: ${SCORE_LABELS[score]}`}
                onPress={() => {
                  triggerHaptic();
                  setScores((prev) => ({ ...prev, [criterion.key]: score }));
                }}
                style={[
                  styles.scoreButton,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.h3,
                    { color: isSelected ? colors.onPrimary : colors.textMuted },
                  ]}
                >
                  {score}
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    {
                      color: isSelected ? colors.onPrimary : colors.textMuted,
                      fontSize: 10,
                      marginTop: 2,
                    },
                  ]}
                >
                  {SCORE_LABELS[score]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ─── Submitted evaluations tab ─────────────────────────────────────────────

  const renderSubmittedList = () => {
    if (myEvaluations.length === 0) {
      return (
        <View style={[styles.emptySubmitted, { padding: spacing.xl }]}>
          <Text style={[typography.h3, { color: colors.textMuted, textAlign: 'center' }]}>
            No evaluations submitted yet
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
            Submit your first evaluation using the form.
          </Text>
          <Button
            title="Go to Form"
            variant="primary"
            onPress={() => setActiveTab('form')}
            style={{ marginTop: spacing.lg, alignSelf: 'center' }}
          />
        </View>
      );
    }

    return myEvaluations.map((ev) => {
      const avg = computeAverageScore(ev);
      const evalueeName =
        ev.evaluatee?.profile?.fullName || ev.evaluatee?.email || 'Teammate';
      const submittedDate = new Date(ev.createdAt).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
      });

      return (
        <Card key={ev.id} style={[styles.evalCard, { marginBottom: spacing.sm }]}>
          <View style={styles.evalCardHeader}>
            <View style={styles.evalAvatar}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                {evalueeName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.h3, { color: colors.text }]}>{evalueeName}</Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                Submitted {submittedDate}
              </Text>
            </View>
            <Badge
              label={`Avg ${avg}/5`}
              variant={avg >= 4 ? 'secondary' : avg >= 3 ? 'primary' : 'error'}
            />
          </View>

          {/* Criteria breakdown */}
          <View style={[styles.breakdownGrid, { marginTop: spacing.md }]}>
            {CRITERIA.map((c) => (
              <View key={c.key} style={styles.breakdownItem}>
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: 2 }]} numberOfLines={1}>
                  {c.label}
                </Text>
                <Text style={[typography.h3, { color: colors.primary }]}>
                  {(ev as any)[c.key]}/5
                </Text>
              </View>
            ))}
          </View>

          {ev.comments ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.md, fontStyle: 'italic' }]}>
              "{ev.comments}"
            </Text>
          ) : null}

          <Button
            title="Edit Evaluation"
            variant="outline"
            size="sm"
            onPress={() => handleEditExisting(ev)}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      );
    });
  };

  // ─── Evaluation form tab ───────────────────────────────────────────────────

  const renderForm = () => {
    const allScoresFilled = Object.values(scores).every((s) => s > 0);
    const selectedMember = teammates.find((m) => m.userId === selectedMemberId);
    const alreadyEvaluated = selectedMemberId ? hasEvaluated(selectedMemberId) : false;

    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Step 1 — Select teammate */}
        <Card style={{ marginBottom: spacing.md, padding: spacing.md }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
            1 · Select a Teammate
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.md }]}>
            You can evaluate each teammate once per project. Tap a name to select them.
          </Text>

          {teammates.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted }]}>
              No other accepted members in this project yet.
            </Text>
          ) : (
            <View style={styles.memberChips}>
              {teammates.map((m) => {
                const name = getMemberName(m);
                const evaluated = hasEvaluated(m.userId);
                const isSelected = selectedMemberId === m.userId;
                return (
                  <View key={m.userId} style={{ position: 'relative', marginRight: spacing.xs, marginBottom: spacing.xs }}>
                    <Chip
                      label={name}
                      selected={isSelected}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedMemberId(isSelected ? '' : m.userId);
                      }}
                    />
                    {evaluated && (
                      <View style={[styles.evaluatedDot, { backgroundColor: colors.secondary }]} />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Already evaluated warning */}
          {alreadyEvaluated && selectedMember && (
            <View
              style={[
                styles.warningBox,
                {
                  backgroundColor: colors.secondarySoft,
                  borderColor: colors.secondary,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginTop: spacing.sm,
                },
              ]}
            >
              <Text style={[typography.bodySmall, { color: colors.secondary, fontWeight: '600' }]}>
                ✅ You've already evaluated {getMemberName(selectedMember)}.
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                Submitting again will update your previous evaluation.
              </Text>
            </View>
          )}
        </Card>

        {/* Step 2 — Score each criterion */}
        {selectedMemberId ? (
          <Card style={{ marginBottom: spacing.md, padding: spacing.md }}>
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.xs }]}>
              2 · Rate {selectedMember ? getMemberName(selectedMember) : 'this teammate'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.lg }]}>
              Score each area from 1 (Poor) to 5 (Excellent).
            </Text>

            {CRITERIA.map(renderScoreRow)}

            {/* Optional comments */}
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.xs }]}>
              3 · Comments <Text style={[typography.bodySmall, { color: colors.textMuted }]}>(optional)</Text>
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                // Use Alert.prompt on iOS, fall back to a note on Android
                if (Platform.OS === 'ios') {
                  Alert.prompt(
                    'Comments',
                    'Add any qualitative feedback for this teammate:',
                    (text) => setComments(text || ''),
                    'plain-text',
                    comments
                  );
                } else {
                  Alert.alert(
                    'Comments',
                    'To add comments on Android, tap the text area on the full keyboard.',
                    [{ text: 'OK' }]
                  );
                }
              }}
            >
              <View
                style={[
                  styles.commentsBox,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.body, { color: comments ? colors.text : colors.textMuted }]}>
                  {comments || 'Tap to add optional written feedback…'}
                </Text>
              </View>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* Submit */}
        {selectedMemberId ? (
          <Button
            title={submitting ? 'Submitting…' : alreadyEvaluated ? 'Update Evaluation' : 'Submit Evaluation'}
            variant="primary"
            loading={submitting}
            disabled={submitting || !allScoresFilled}
            onPress={handleSubmit}
            enableHaptics
          />
        ) : null}

        {!allScoresFilled && selectedMemberId ? (
          <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
            Score all 5 criteria to enable submission.
          </Text>
        ) : null}
      </ScrollView>
    );
  };

  // ─── Success confirmation modal ────────────────────────────────────────────

  const renderConfirmModal = () => (
    <Modal
      visible={confirmVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setConfirmVisible(false)}
    >
      <View style={styles.confirmOverlay}>
        <View
          style={[
            styles.confirmCard,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              padding: spacing.xl,
              margin: spacing.xl,
            },
          ]}
        >
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: spacing.md }}>🎉</Text>
          <Text style={[typography.h2, { color: colors.text, textAlign: 'center', marginBottom: spacing.sm }]}>
            Evaluation Submitted
          </Text>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl }]}>
            Your peer evaluation for{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{confirmedName}</Text> has
            been recorded. Thank you for your honest feedback!
          </Text>
          <Button
            title="View My Evaluations"
            variant="secondary"
            onPress={() => {
              setConfirmVisible(false);
              setActiveTab('submitted');
            }}
            style={{ marginBottom: spacing.sm }}
          />
          <Button
            title="Evaluate Another Teammate"
            variant="outline"
            onPress={() => setConfirmVisible(false)}
          />
        </View>
      </View>
    </Modal>
  );

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Peer Evaluation"
        subtitle={projectTitle}
        showBack={true}
        onBack={() => navigation?.goBack?.()}
        actions={[
          {
            icon: (
              <Badge
                label={`${myEvaluations.length}/${teammates.length}`}
                variant="tertiary"
              />
            ),
            onPress: () => setActiveTab('submitted'),
            accessibilityLabel: `${myEvaluations.length} of ${teammates.length} evaluations submitted`,
          },
        ]}
      />

      {/* Tab switcher */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'form' && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab('form')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'form' ? colors.primary : colors.textMuted, fontWeight: activeTab === 'form' ? '700' : '500' }]}>
            Evaluate
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'submitted' && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab('submitted')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'submitted' ? colors.primary : colors.textMuted, fontWeight: activeTab === 'submitted' ? '700' : '500' }]}>
            Submitted ({myEvaluations.length})
          </Text>
        </TouchableOpacity>
      </View>

      <StateWrapper
        state={screenState}
        errorMessage={errorMessage}
        onRetry={loadData}
        emptyTitle="No Teammates to Evaluate"
        emptySubtitle="There are no other accepted members in this project yet. Once teammates join, you can evaluate them here."
        emptyActionLabel="Back to Workspace"
        onEmptyAction={() => navigation?.goBack?.()}
      >
        {activeTab === 'form' ? (
          renderForm()
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {renderSubmittedList()}
          </ScrollView>
        )}
      </StateWrapper>

      {renderConfirmModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 13,
  },
  memberChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  evaluatedDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  warningBox: {
    borderWidth: 1,
  },
  criterionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 3,
    borderWidth: 1.5,
  },
  commentsBox: {
    minHeight: 72,
    borderWidth: 1,
  },
  evalCard: {
    padding: 14,
  },
  evalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  evalAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  breakdownItem: {
    width: '33.33%',
    paddingRight: 8,
    marginBottom: 8,
  },
  emptySubmitted: {
    alignItems: 'center',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCard: {
    width: '90%',
    alignItems: 'center',
  },
});
