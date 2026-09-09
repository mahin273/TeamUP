import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Badge } from '../../components/Badge';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { useAuth } from '../../context/AuthContext';
import { ProfileEditScreen } from './ProfileEditScreen';
import { ApiError } from '../../api/client';

export const ProfileScreen = () => {
  const { colors, typography, spacing, isDark, toggleTheme } = useTheme();
  const { user, fetchProfile, logout } = useAuth();

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const loadData = async () => {
    setScreenState('loading');
    try {
      await fetchProfile();
      setScreenState('populated');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        setErrorCode(err.code);
      } else {
        setErrorMessage('Failed to connect to profile service.');
      }
      if (user) {
        setScreenState('populated');
      } else {
        setScreenState('error');
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        await fetchProfile();
        if (isMounted) {
          setScreenState('populated');
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError) {
            setErrorMessage(err.message);
            setErrorCode(err.code);
          } else {
            setErrorMessage('Failed to connect to profile service.');
          }
          setScreenState('populated'); // Show view with stored context profile if present
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [fetchProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
    } catch {
      // keep current state
    } finally {
      setRefreshing(false);
    }
  };

  if (isEditing) {
    return (
      <ProfileEditScreen
        onClose={() => setIsEditing(false)}
        onSaved={() => setIsEditing(false)}
      />
    );
  }

  // Check if profile details exist
  const isProfileEmpty =
    !user?.fullName && !user?.bio && (!user?.skills || user.skills.length === 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StateWrapper
        state={isProfileEmpty && screenState === 'populated' ? 'empty' : screenState}
        emptyTitle="Profile Incomplete"
        emptySubtitle="Add your bio, skills, and department details so project teams can discover you!"
        emptyActionLabel="Complete Profile Now"
        onEmptyAction={() => setIsEditing(true)}
        errorMessage={errorMessage}
        errorCode={errorCode}
        onRetry={loadData}
      >
        {user && (
          <View style={{ padding: spacing.md }}>
            {/* Header Profile Bento Card */}
            <Card style={styles.card}>
              <View style={styles.avatarRow}>
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: colors.primaryContainer },
                  ]}
                >
                  <Text style={{ fontSize: 28 }}>
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : '👤'}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text
                    style={[
                      styles.name,
                      {
                        color: colors.onSurface,
                        fontSize: typography.headlineMedium.fontSize,
                      },
                    ]}
                  >
                    {user.fullName || 'Anonymous User'}
                  </Text>
                  <Text
                    style={[
                      styles.email,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {user.email}
                  </Text>
                  <View style={styles.badgeRow}>
                    {user.experienceLevel && (
                      <Badge
                        label={user.experienceLevel}
                        variant={
                          user.experienceLevel === 'ADVANCED'
                            ? 'tertiary'
                            : 'secondary'
                        }
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Badge
                      label={user.availability ? 'Available for Teams' : 'Busy'}
                      variant={user.availability ? 'primary' : 'error'}
                    />
                  </View>
                </View>
              </View>

              {user.bio ? (
                <Text
                  style={[
                    styles.bio,
                    {
                      color: colors.onSurface,
                      fontSize: typography.bodyMedium.fontSize,
                      marginTop: spacing.md,
                    },
                  ]}
                >
                  {user.bio}
                </Text>
              ) : null}

              {(user.department || user.semester) && (
                <View style={[styles.infoRow, { marginTop: spacing.sm }]}>
                  {user.department && (
                    <Chip label={`🎓 ${user.department}`} variant="secondary" />
                  )}
                  {user.semester && (
                    <Chip label={`🗓️ ${user.semester}`} variant="secondary" />
                  )}
                </View>
              )}
            </Card>

            {/* Skills Bento Card */}
            <Card style={[styles.card, { marginTop: spacing.md }]}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
                ]}
              >
                Skills & Tech Stack
              </Text>
              {user.skills && user.skills.length > 0 ? (
                <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
                  {user.skills.map((sk) => (
                    <Chip
                      key={sk.id}
                      label={sk.skillName}
                      selected
                      variant="primary"
                    />
                  ))}
                </View>
              ) : (
                <Text
                  style={{
                    color: colors.onSurfaceVariant,
                    marginTop: spacing.xs,
                    fontStyle: 'italic',
                  }}
                >
                  No skills added yet. Tap "Edit Profile" to add your skills.
                </Text>
              )}
            </Card>

            {/* Links Bento Card */}
            {(user.githubUsername || user.portfolioUrl) && (
              <Card style={[styles.card, { marginTop: spacing.md }]}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
                  ]}
                >
                  Links & Profiles
                </Text>
                {user.githubUsername && (
                  <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() =>
                      Linking.openURL(`https://github.com/${user.githubUsername}`)
                    }
                  >
                    <Text style={{ fontSize: 18 }}>🐙</Text>
                    <Text
                      style={[
                        styles.linkText,
                        { color: colors.primary, marginLeft: 8 },
                      ]}
                    >
                      github.com/{user.githubUsername}
                    </Text>
                  </TouchableOpacity>
                )}

                {user.portfolioUrl && (
                  <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => Linking.openURL(user.portfolioUrl!)}
                  >
                    <Text style={{ fontSize: 18 }}>🌐</Text>
                    <Text
                      style={[
                        styles.linkText,
                        { color: colors.primary, marginLeft: 8 },
                      ]}
                    >
                      {user.portfolioUrl}
                    </Text>
                  </TouchableOpacity>
                )}
              </Card>
            )}

            {/* Action Buttons */}
            <View style={{ marginTop: spacing.md }}>
              <Button
                title="Edit Profile"
                onPress={() => setIsEditing(true)}
                variant="primary"
              />

              <Button
                title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                onPress={toggleTheme}
                variant="secondary"
                style={{ marginTop: spacing.sm }}
              />

              <Button
                title="Sign Out"
                onPress={logout}
                variant="outline"
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </View>
        )}
      </StateWrapper>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    padding: 18,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontWeight: '700',
  },
  email: {
    fontSize: 13,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  bio: {
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
