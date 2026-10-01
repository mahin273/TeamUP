import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Badge } from '../../components/Badge';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { GitHubStatsCard } from '../../components/GitHubStatsCard';
import { api, ApiError } from '../../api/client';

export interface PublicProfileSkill {
  id?: string;
  skillName?: string;
  skill?: {
    id: string;
    name: string;
    category?: string;
  };
  level?: string;
}

export interface PublicUserProfile {
  id: string;
  userId?: string;
  fullName: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  department?: string;
  semester?: string;
  experienceLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  availability?: boolean;
  githubUsername?: string;
  portfolioUrl?: string;
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  skills?: PublicProfileSkill[];
}

export interface UserProfileScreenProps {
  route?: {
    params?: {
      userId?: string;
      userName?: string;
      projectId?: string;
      invited?: boolean;
    };
  };
  navigation?: {
    goBack: () => void;
    navigate: (screen: string, params?: any) => void;
  };
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, isDark } = useTheme();
  const { userId, userName, projectId = 'project-1', invited = false } = route?.params || {};

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Invitation state
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'inviting' | 'invited' | 'error'>(
    invited ? 'invited' : 'idle'
  );
  const [inviteError, setInviteError] = useState<string>('');

  const fetchUserProfile = useCallback(async () => {
    if (!userId) {
      setScreenState('error');
      setErrorMessage('No user ID specified.');
      return;
    }

    setScreenState('loading');
    setErrorMessage('');
    setErrorCode(undefined);

    try {
      const data = await api.get<PublicUserProfile>(`/profiles/${encodeURIComponent(userId)}`);
      if (data) {
        setProfile(data);
        setScreenState('populated');
      } else {
        setScreenState('empty');
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : (err?.message || 'Failed to fetch user profile.');
      setErrorMessage(msg);
      setErrorCode(err?.code);
      setScreenState('error');
    }
  }, [userId]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserProfile();
    setRefreshing(false);
  };

  const handleInvitePress = async () => {
    if (inviteStatus === 'inviting' || inviteStatus === 'invited') return;

    setInviteStatus('inviting');
    setInviteError('');

    try {
      const targetProject = projectId.startsWith('project-') ? projectId : 'project-1';
      await api.post(`/projects/${targetProject}/invite`, {
        targetUserId: userId,
      });
      setInviteStatus('invited');
    } catch (err: any) {
      setInviteStatus('error');
      setInviteError(err?.message || 'Failed to send project invitation.');
    }
  };

  const displayName = profile?.fullName || userName || 'Member Profile';
  const displayEmail = profile?.email || profile?.user?.email;

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header with Back Navigation */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.outlineVariant,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack?.()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            {'< Back'}
          </Text>
        </TouchableOpacity>
        <Text
          numberOfLines={1}
          style={[
            styles.headerTitle,
            { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
          ]}
        >
          {displayName}
        </Text>
        <View style={styles.topBarRightSpacer} />
      </View>

      <StateWrapper
        state={screenState}
        errorMessage={errorMessage}
        errorCode={errorCode}
        onRetry={fetchUserProfile}
        emptyTitle="Profile Not Found"
        emptySubtitle="The requested user profile does not exist or has been removed."
      >
        {profile && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            <View style={styles.contentInner}>
              {/* Profile Overview Card */}
              <Card style={styles.card}>
                <View style={styles.profileHeaderRow}>
                  <View
                    style={[
                      styles.avatarBadge,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: colors.onPrimaryContainer },
                      ]}
                    >
                      {initials}
                    </Text>
                  </View>

                  <View style={styles.profileHeaderMeta}>
                    <Text
                      style={[
                        styles.nameText,
                        {
                          color: colors.onSurface,
                          fontSize: typography.headlineMedium.fontSize,
                        },
                      ]}
                    >
                      {displayName}
                    </Text>
                    {displayEmail ? (
                      <Text
                        style={[
                          styles.emailText,
                          { color: colors.onSurfaceVariant },
                        ]}
                      >
                        {displayEmail}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Metadata Tags */}
                <View style={[styles.badgeWrapRow, { marginTop: spacing.md }]}>
                  {profile.department ? (
                    <Badge
                      label={profile.department}
                      variant="primary"
                      style={{ marginRight: 8, marginBottom: 8 }}
                    />
                  ) : null}
                  {profile.semester ? (
                    <Badge
                      label={profile.semester}
                      variant="secondary"
                      style={{ marginRight: 8, marginBottom: 8 }}
                    />
                  ) : null}
                  {profile.experienceLevel ? (
                    <Badge
                      label={profile.experienceLevel}
                      variant="tertiary"
                      style={{ marginRight: 8, marginBottom: 8 }}
                    />
                  ) : null}
                  <Badge
                    label={
                      profile.availability !== false
                        ? 'Available for Teams'
                        : 'Unavailable'
                    }
                    variant={
                      profile.availability !== false ? 'primary' : 'secondary'
                    }
                    style={{ marginBottom: 8 }}
                  />
                </View>
              </Card>

              {/* Bio Card */}
              <Card style={[styles.card, { marginTop: spacing.md }]}>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: colors.onSurface,
                      fontSize: typography.titleMedium.fontSize,
                    },
                  ]}
                >
                  About
                </Text>
                <Text
                  style={[
                    styles.bioText,
                    { color: colors.onSurfaceVariant, marginTop: spacing.xs },
                  ]}
                >
                  {profile.bio && profile.bio.trim()
                    ? profile.bio
                    : 'No biography provided yet.'}
                </Text>
              </Card>

              {/* Technical Skills Card */}
              {profile.skills && profile.skills.length > 0 ? (
                <Card style={[styles.card, { marginTop: spacing.md }]}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color: colors.onSurface,
                        fontSize: typography.titleMedium.fontSize,
                      },
                    ]}
                  >
                    Skills & Competencies ({profile.skills.length})
                  </Text>
                  <View style={[styles.chipGrid, { marginTop: spacing.sm }]}>
                    {profile.skills.map((s, idx) => {
                      const skillName =
                        s.skill?.name || s.skillName || 'Skill';
                      const label = s.level
                        ? `${skillName} (${s.level})`
                        : skillName;
                      return (
                        <Chip
                          key={s.id || idx}
                          label={label}
                          variant="primary"
                          style={{ marginRight: 8, marginBottom: 8 }}
                        />
                      );
                    })}
                  </View>
                </Card>
              ) : null}

              {/* GitHub Stats Card */}
              <GitHubStatsCard
                profileId={profile.id || userId || ''}
                githubUsername={profile.githubUsername}
                readOnly={true}
              />

              {/* External Portfolio / Links */}
              {profile.portfolioUrl ? (
                <Card style={[styles.card, { marginTop: spacing.md }]}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color: colors.onSurface,
                        fontSize: typography.titleMedium.fontSize,
                      },
                    ]}
                  >
                    Portfolio & Links
                  </Text>
                  <TouchableOpacity
                    style={[styles.linkRow, { marginTop: spacing.xs }]}
                    onPress={() => Linking.openURL(profile.portfolioUrl!)}
                  >
                    <Text
                      style={[
                        styles.linkText,
                        { color: colors.primary },
                      ]}
                    >
                      {profile.portfolioUrl}
                    </Text>
                  </TouchableOpacity>
                </Card>
              ) : null}

              {/* Quick Actions / Invitation Card */}
              <Card style={[styles.card, { marginTop: spacing.md }]}>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: colors.onSurface,
                      fontSize: typography.titleMedium.fontSize,
                    },
                  ]}
                >
                  Collaboration
                </Text>
                <Text
                  style={[
                    styles.actionHint,
                    { color: colors.onSurfaceVariant, marginTop: spacing.xs },
                  ]}
                >
                  Invite this member to collaborate with your team on active project sprints.
                </Text>

                {inviteStatus === 'error' && inviteError ? (
                  <Text
                    style={[
                      styles.inviteErrorText,
                      { color: colors.error, marginTop: spacing.xs },
                    ]}
                  >
                    {inviteError}
                  </Text>
                ) : null}

                <View style={{ marginTop: spacing.md }}>
                  <Button
                    title={
                      inviteStatus === 'invited'
                        ? 'Invitation Sent'
                        : inviteStatus === 'inviting'
                        ? 'Sending Invitation...'
                        : 'Invite to Project'
                    }
                    onPress={handleInvitePress}
                    variant={inviteStatus === 'invited' ? 'secondary' : 'primary'}
                    disabled={inviteStatus === 'invited' || inviteStatus === 'inviting'}
                    style={{ width: '100%' }}
                  />
                </View>
              </Card>
            </View>
          </ScrollView>
        )}
      </StateWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  headerTitle: {
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  topBarRightSpacer: {
    width: 50,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  contentInner: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileHeaderMeta: {
    marginLeft: 16,
    flex: 1,
  },
  nameText: {
    fontWeight: '700',
  },
  emailText: {
    fontSize: 14,
    marginTop: 2,
  },
  badgeWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '600',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  linkRow: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  actionHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  inviteErrorText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
