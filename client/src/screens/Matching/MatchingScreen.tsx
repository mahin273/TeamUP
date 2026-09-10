import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { api } from '../../api/client';

export interface MatchingCandidate {
  id: string;
  userId?: string;
  fullName: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  department?: string;
  semester?: string;
  experienceLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  matchScore: number; // raw float (0.95) or integer percentage (95)
  matchingSkills?: string[];
  skills?: Array<{ id?: string; skillName: string }>;
  githubUsername?: string;
  contributionsThisYear?: number;
  publicRepos?: number;
  invited?: boolean;
}

export type InvitationStatus = 'idle' | 'inviting' | 'invited' | 'error';

export const MatchingScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();

  const [projectId, setProjectId] = useState<string>('project-1');
  const [activeProjectId, setActiveProjectId] = useState<string>('project-1');
  const [candidates, setCandidates] = useState<MatchingCandidate[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Optimistic invitation state tracking by target user ID
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, InvitationStatus>>({});
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  const loadRecommendations = useCallback(async (targetProjectId: string) => {
    setScreenState('loading');
    setErrorMessage('');
    setErrorCode(undefined);

    try {
      const data = await api.get<MatchingCandidate[]>(`/projects/${targetProjectId}/recommendations`);
      const candidateList = Array.isArray(data) ? data : [];
      setCandidates(candidateList);

      // Initialize invite status based on backend flag if present
      const initialStatuses: Record<string, InvitationStatus> = {};
      candidateList.forEach((candidate) => {
        const uid = candidate.userId || candidate.id;
        if (candidate.invited) {
          initialStatuses[uid] = 'invited';
        }
      });
      setInviteStatuses((prev) => ({ ...initialStatuses, ...prev }));

      setScreenState(candidateList.length === 0 ? 'empty' : 'populated');
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch teammate recommendations.';
      const code = err?.code;
      setErrorMessage(msg);
      setErrorCode(code);
      setScreenState('error');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setScreenState('loading');
      setErrorMessage('');
      setErrorCode(undefined);

      try {
        const data = await api.get<MatchingCandidate[]>(`/projects/${activeProjectId}/recommendations`);
        if (!isMounted) return;

        const candidateList = Array.isArray(data) ? data : [];
        setCandidates(candidateList);

        const initialStatuses: Record<string, InvitationStatus> = {};
        candidateList.forEach((candidate) => {
          const uid = candidate.userId || candidate.id;
          if (candidate.invited) {
            initialStatuses[uid] = 'invited';
          }
        });
        setInviteStatuses((prev) => ({ ...initialStatuses, ...prev }));
        setScreenState(candidateList.length === 0 ? 'empty' : 'populated');
      } catch (err: any) {
        if (!isMounted) return;
        const msg = err?.message || 'Failed to fetch teammate recommendations.';
        const code = err?.code;
        setErrorMessage(msg);
        setErrorCode(code);
        setScreenState('error');
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [activeProjectId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRecommendations(activeProjectId);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearchProject = () => {
    if (projectId.trim()) {
      setActiveProjectId(projectId.trim());
    }
  };

  const handleInvite = async (candidate: MatchingCandidate) => {
    const targetUserId = candidate.userId || candidate.id;

    // Optimistic update: set state to 'inviting' immediately
    setInviteStatuses((prev) => ({ ...prev, [targetUserId]: 'inviting' }));
    setInviteErrors((prev) => ({ ...prev, [targetUserId]: '' }));

    try {
      await api.post(`/projects/${activeProjectId}/invite`, {
        userId: targetUserId,
        role: 'MEMBER',
      });

      // Successful invitation state
      setInviteStatuses((prev) => ({ ...prev, [targetUserId]: 'invited' }));
    } catch (err: any) {
      // Revert optimistic state to error with message
      const errorMsg = err?.message || 'Invitation failed.';
      setInviteStatuses((prev) => ({ ...prev, [targetUserId]: 'error' }));
      setInviteErrors((prev) => ({ ...prev, [targetUserId]: errorMsg }));
    }
  };

  const formatMatchScore = (score: number) => {
    const percentage = score <= 1 ? Math.round(score * 100) : Math.round(score);
    return `${percentage}% Match`;
  };

  const getScoreVariant = (score: number): 'primary' | 'secondary' | 'tertiary' => {
    const percentage = score <= 1 ? score * 100 : score;
    if (percentage >= 80) return 'primary';
    if (percentage >= 60) return 'secondary';
    return 'tertiary';
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={{ padding: spacing.md }}>
        {/* Top Header & Project Selector Card */}
        <Card style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
              ]}
            >
              Find Teammates
            </Text>
            <Badge label="Skill Matching" variant="primary" />
          </View>
          <Text
            style={[
              styles.subtitle,
              { color: colors.onSurfaceVariant, marginTop: spacing.xs },
            ]}
          >
            AI-weighted team recommendation engine. Discover candidates matching your project skills.
          </Text>

          {/* Project Selector Bar */}
          <View style={[styles.projectInputRow, { marginTop: spacing.md }]}>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.onSurface,
                  backgroundColor: colors.surfaceVariant,
                  borderColor: colors.outlineVariant,
                },
              ]}
              value={projectId}
              onChangeText={setProjectId}
              placeholder="Enter Project ID (e.g. project-1)"
              placeholderTextColor={colors.onSurfaceVariant}
            />
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={handleSearchProject}
            >
              <Text style={[styles.searchButtonText, { color: colors.onPrimary }]}>
                Search
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Content Wrapper handling Loading / Populated / Empty / Error */}
        <StateWrapper
          state={screenState}
          emptyTitle="No Candidates Found"
          emptySubtitle="No candidates matching your project's skill requirements were found right now. Try updating your project's target skills."
          emptyActionLabel="Refresh Candidates"
          onEmptyAction={() => loadRecommendations(activeProjectId)}
          errorMessage={errorMessage}
          errorCode={errorCode}
          onRetry={() => loadRecommendations(activeProjectId)}
        >
          <View style={{ marginTop: spacing.md }}>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
              ]}
            >
              Ranked Candidates ({candidates.length})
            </Text>

            {candidates.map((candidate, index) => {
              const targetUserId = candidate.userId || candidate.id;
              const status: InvitationStatus = inviteStatuses[targetUserId] || 'idle';
              const inviteErr = inviteErrors[targetUserId];

              const skillsList = candidate.matchingSkills
                ? candidate.matchingSkills
                : candidate.skills
                ? candidate.skills.map((s) => s.skillName)
                : [];

              return (
                <Card
                  key={targetUserId}
                  style={[styles.candidateCard, { marginTop: spacing.md }]}
                >
                  {/* Rank Header Row */}
                  <View style={styles.rankRow}>
                    <View style={styles.candidateHeader}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: colors.primaryContainer },
                        ]}
                      >
                        <Text
                          style={{
                            color: colors.onPrimaryContainer,
                            fontWeight: '700',
                            fontSize: 18,
                          }}
                        >
                          #{index + 1}
                        </Text>
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text
                          style={[
                            styles.candidateName,
                            {
                              color: colors.onSurface,
                              fontSize: typography.titleMedium.fontSize,
                            },
                          ]}
                        >
                          {candidate.fullName}
                        </Text>
                        {candidate.email && (
                          <Text
                            style={[
                              styles.candidateEmail,
                              { color: colors.onSurfaceVariant },
                            ]}
                          >
                            {candidate.email}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Readable Match Score Badge */}
                    <Badge
                      label={formatMatchScore(candidate.matchScore)}
                      variant={getScoreVariant(candidate.matchScore)}
                    />
                  </View>

                  {/* Department & Experience Meta */}
                  {(candidate.department || candidate.experienceLevel || candidate.semester) && (
                    <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
                      {candidate.department && (
                        <Badge
                          label={candidate.department}
                          variant="secondary"
                          style={{ marginRight: 6 }}
                        />
                      )}
                      {candidate.experienceLevel && (
                        <Badge
                          label={candidate.experienceLevel}
                          variant="tertiary"
                          style={{ marginRight: 6 }}
                        />
                      )}
                      {candidate.semester && (
                        <Badge label={candidate.semester} variant="secondary" />
                      )}
                    </View>
                  )}

                  {/* Bio Description */}
                  {candidate.bio ? (
                    <Text
                      style={[
                        styles.candidateBio,
                        { color: colors.onSurface, marginTop: spacing.sm },
                      ]}
                    >
                      {candidate.bio}
                    </Text>
                  ) : null}

                  {/* Matching Skill Tag Chips */}
                  {skillsList.length > 0 && (
                    <View style={{ marginTop: spacing.sm }}>
                      <Text
                        style={[
                          styles.skillsTitle,
                          { color: colors.onSurfaceVariant },
                        ]}
                      >
                        Matching Skills:
                      </Text>
                      <View style={[styles.chipRow, { marginTop: 4 }]}>
                        {skillsList.map((skill) => (
                          <Chip
                            key={skill}
                            label={skill}
                            selected
                            variant="primary"
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {/* GitHub Profile Stat Summary */}
                  {candidate.githubUsername && (
                    <View
                      style={[
                        styles.githubSummaryRow,
                        {
                          backgroundColor: colors.surfaceVariant,
                          marginTop: spacing.sm,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>
                        🐙 @{candidate.githubUsername}
                        {candidate.publicRepos !== undefined
                          ? ` • ${candidate.publicRepos} repos`
                          : ''}
                        {candidate.contributionsThisYear !== undefined
                          ? ` • ${candidate.contributionsThisYear} commits`
                          : ''}
                      </Text>
                    </View>
                  )}

                  {/* Invitation Failure Error Banner */}
                  {status === 'error' && inviteErr ? (
                    <Text
                      style={[
                        styles.inviteErrorText,
                        { color: colors.error, marginTop: spacing.xs },
                      ]}
                    >
                      ⚠️ {inviteErr}
                    </Text>
                  ) : null}

                  {/* Invite Action Button */}
                  <View style={{ marginTop: spacing.md }}>
                    {status === 'invited' ? (
                      <Button
                        title="Invited ✓"
                        variant="secondary"
                        onPress={() => {}}
                        disabled
                      />
                    ) : (
                      <Button
                        title={
                          status === 'inviting'
                            ? 'Sending Invite...'
                            : status === 'error'
                            ? 'Retry Invitation'
                            : 'Invite to Team'
                        }
                        onPress={() => handleInvite(candidate)}
                        variant={status === 'error' ? 'tertiary' : 'primary'}
                        loading={status === 'inviting'}
                        disabled={status === 'inviting'}
                      />
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        </StateWrapper>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    padding: 18,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  projectInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  searchButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  sectionHeader: {
    fontWeight: '700',
  },
  candidateCard: {
    padding: 18,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  candidateName: {
    fontWeight: '700',
  },
  candidateEmail: {
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  candidateBio: {
    fontSize: 14,
    lineHeight: 20,
  },
  skillsTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  githubSummaryRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  inviteErrorText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
