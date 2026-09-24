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

const POPULAR_SKILLS = [
  'React Native',
  'TypeScript',
  'Node.js',
  'Python',
  'PostgreSQL',
  'Figma',
  'UI/UX',
  'Flutter',
  'Docker',
];

export const MatchingScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTarget, setActiveTarget] = useState<string>('project-1');
  const [candidates, setCandidates] = useState<MatchingCandidate[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Optimistic invitation state tracking by target user ID
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, InvitationStatus>>({});
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  const loadRecommendations = useCallback(async (target: string) => {
    const trimmedTarget = target.trim();
    if (!trimmedTarget) return;

    setScreenState('loading');
    setErrorMessage('');
    setErrorCode(undefined);

    try {
      const data = await api.get<MatchingCandidate[]>(
        `/projects/${encodeURIComponent(trimmedTarget)}/recommendations`
      );
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
      const trimmedTarget = activeTarget.trim();
      if (!trimmedTarget) return;

      setScreenState('loading');
      setErrorMessage('');
      setErrorCode(undefined);

      try {
        const data = await api.get<MatchingCandidate[]>(
          `/projects/${encodeURIComponent(trimmedTarget)}/recommendations`
        );
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
  }, [activeTarget]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRecommendations(activeTarget);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      setActiveTarget(trimmed);
    }
  };

  const handleSelectSkill = (skill: string) => {
    setSearchQuery(skill);
    setActiveTarget(skill);
  };

  const handleInvite = async (candidate: MatchingCandidate) => {
    const targetUserId = candidate.userId || candidate.id;

    // Optimistic update: set state to 'inviting' immediately
    setInviteStatuses((prev) => ({ ...prev, [targetUserId]: 'inviting' }));
    setInviteErrors((prev) => ({ ...prev, [targetUserId]: '' }));

    try {
      const inviteProjectId = activeTarget.startsWith('project-') ? activeTarget : 'project-1';
      await api.post(`/projects/${inviteProjectId}/invite`, {
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
      contentContainerStyle={{ paddingBottom: 90 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={{ padding: spacing.md }}>
        {/* Top Header & Project Selector */}
        <Card style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
              ]}
            >
              Matching
            </Text>
            <Badge label="Skill Matching" variant="primary" />
          </View>

          <Text
            style={[
              styles.subtitle,
              { color: colors.onSurfaceVariant, marginTop: spacing.xs },
            ]}
          >
            Find teammates for:
          </Text>

          {/* Project Selector Pill */}
          <TouchableOpacity
            style={[
              styles.projectSelectorPill,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.outlineVariant,
                marginTop: spacing.xs,
              },
            ]}
            onPress={() => {
              // Cycle through available mock targets
              if (activeTarget === 'project-1') {
                setActiveTarget('Campus Event Platform');
              } else {
                setActiveTarget('project-1');
              }
            }}
          >
            <Text style={[styles.projectSelectorText, { color: colors.onSurface }]}>
              {activeTarget === 'project-1' ? 'Campus Event Platform ▾' : `${activeTarget} ▾`}
            </Text>
          </TouchableOpacity>

          {/* Skill Search Bar */}
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
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              placeholder="Enter skill name (e.g. React Native, TypeScript, Python)"
              placeholderTextColor={colors.onSurfaceVariant}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={handleSearch}
            >
              <Text style={[styles.searchButtonText, { color: colors.onPrimary }]}>
                Search
              </Text>
            </TouchableOpacity>
          </View>

          {/* Popular Skill Quick-Picks */}
          <View style={{ marginTop: spacing.sm }}>
            <Text
              style={[
                styles.quickPickLabel,
                { color: colors.onSurfaceVariant, marginBottom: 6 },
              ]}
            >
              Popular Skills:
            </Text>
            <View style={styles.chipRow}>
              {POPULAR_SKILLS.map((skill) => {
                const isSelected =
                  activeTarget.toLowerCase() === skill.toLowerCase() ||
                  searchQuery.toLowerCase() === skill.toLowerCase();
                return (
                  <Chip
                    key={skill}
                    label={`#${skill}`}
                    selected={isSelected}
                    variant={isSelected ? 'primary' : 'secondary'}
                    onPress={() => handleSelectSkill(skill)}
                    style={{ marginRight: 6, marginBottom: 6 }}
                  />
                );
              })}
            </View>
          </View>
        </Card>

        {/* Content Wrapper handling Loading / Populated / Empty / Error */}
        <StateWrapper
          state={screenState}
          emptyTitle="No Candidates Found"
          emptySubtitle={`We couldn't find candidates matching "${activeTarget}". Try searching for another skill like React Native, Python, or TypeScript.`}
          emptyActionLabel="Refresh Candidates"
          onEmptyAction={() => loadRecommendations(activeTarget)}
          errorMessage={errorMessage}
          errorCode={errorCode}
          onRetry={() => loadRecommendations(activeTarget)}
        >
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.sectionHeaderRow}>
              <Text
                style={[
                  styles.sectionHeader,
                  { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
                ]}
              >
                Recommended ({candidates.length})
              </Text>
            </View>

            {candidates.map((candidate, index) => {
              const targetUserId = candidate.userId || candidate.id;
              const status: InvitationStatus = inviteStatuses[targetUserId] || 'idle';
              const inviteErr = inviteErrors[targetUserId];

              const skillsList = candidate.matchingSkills
                ? candidate.matchingSkills
                : candidate.skills
                ? candidate.skills.map((s) => s.skillName)
                : [];

              const rawPercent =
                candidate.matchScore <= 1
                  ? Math.round(candidate.matchScore * 100)
                  : Math.round(candidate.matchScore);
              const skillsScore = Math.min(100, Math.max(50, rawPercent));
              const availabilityScore = Math.min(100, Math.max(60, rawPercent - 12));
              const experienceScore =
                candidate.experienceLevel === 'ADVANCED'
                  ? 95
                  : candidate.experienceLevel === 'INTERMEDIATE'
                  ? 82
                  : 70;

              return (
                <Card
                  key={targetUserId}
                  style={[styles.candidateCard, { marginTop: spacing.md }]}
                >
                  {/* Candidate Header Row */}
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
                            fontSize: 16,
                          }}
                        >
                          {candidate.fullName ? candidate.fullName.charAt(0).toUpperCase() : `#${index + 1}`}
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
                        <Text
                          style={[
                            styles.candidateRole,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          {candidate.department || candidate.experienceLevel || 'Software Developer'}
                        </Text>
                      </View>
                    </View>

                    {/* Readable Match Score Badge */}
                    <Badge
                      label={formatMatchScore(candidate.matchScore)}
                      variant={getScoreVariant(candidate.matchScore)}
                    />
                  </View>

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

                  {/* Shared skills */}
                  {skillsList.length > 0 && (
                    <View style={{ marginTop: spacing.sm }}>
                      <Text
                        style={[
                          styles.breakdownHeader,
                          { color: colors.onSurfaceVariant },
                        ]}
                      >
                        Shared skills
                      </Text>
                      <View style={[styles.chipRow, { marginTop: 4 }]}>
                        {skillsList.map((skill) => (
                          <Chip
                            key={skill}
                            label={skill}
                            selected
                            variant="primary"
                            style={{ marginRight: 6, marginBottom: 4 }}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Explained Match Breakdown: Skills, Availability, Experience */}
                  <View style={[styles.breakdownBox, { backgroundColor: colors.surfaceVariant, marginTop: spacing.sm }]}>
                    <Text style={[styles.breakdownHeader, { color: colors.onSurfaceVariant, marginBottom: 6 }]}>
                      Strong matches
                    </Text>

                    <View style={styles.metricRow}>
                      <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>Skills</Text>
                      <View style={[styles.barTrack, { backgroundColor: colors.outlineVariant }]}>
                        <View style={[styles.barFill, { width: `${skillsScore}%`, backgroundColor: colors.primary }]} />
                      </View>
                      <Text style={[styles.metricValue, { color: colors.onSurface }]}>{skillsScore}%</Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>Availability</Text>
                      <View style={[styles.barTrack, { backgroundColor: colors.outlineVariant }]}>
                        <View style={[styles.barFill, { width: `${availabilityScore}%`, backgroundColor: colors.secondary }]} />
                      </View>
                      <Text style={[styles.metricValue, { color: colors.onSurface }]}>{availabilityScore}%</Text>
                    </View>

                    <View style={styles.metricRow}>
                      <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>Experience</Text>
                      <View style={[styles.barTrack, { backgroundColor: colors.outlineVariant }]}>
                        <View style={[styles.barFill, { width: `${experienceScore}%`, backgroundColor: colors.tertiary }]} />
                      </View>
                      <Text style={[styles.metricValue, { color: colors.onSurface }]}>{experienceScore}%</Text>
                    </View>
                  </View>

                  {/* GitHub Profile Stat Summary */}
                  {candidate.githubUsername ? (
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
                        @{candidate.githubUsername}
                        {candidate.publicRepos !== undefined
                          ? ` • ${candidate.publicRepos} repos`
                          : ''}
                        {candidate.contributionsThisYear !== undefined
                          ? ` • ${candidate.contributionsThisYear} commits`
                          : ''}
                      </Text>
                    </View>
                  ) : null}

                  {/* Invitation Failure Error Banner */}
                  {status === 'error' && inviteErr ? (
                    <Text
                      style={[
                        styles.inviteErrorText,
                        { color: colors.error, marginTop: spacing.xs },
                      ]}
                    >
                      {inviteErr}
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
  quickPickLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectSelectorPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  projectSelectorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  candidateRole: {
    fontSize: 13,
    marginTop: 2,
  },
  breakdownBox: {
    padding: 12,
    borderRadius: 8,
  },
  breakdownHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metricLabel: {
    width: 90,
    fontSize: 12,
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricValue: {
    width: 36,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
  },
});
