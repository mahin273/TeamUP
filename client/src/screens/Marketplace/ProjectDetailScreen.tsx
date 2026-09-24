import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { projectService, Project } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';

export interface ProjectDetailScreenProps {
  route?: {
    params?: {
      projectId: string;
    };
  };
  navigation?: any;
}

export const ProjectDetailScreen: React.FC<ProjectDetailScreenProps> = ({ route, navigation }) => {
  const { colors, typography, spacing, borderRadius, elevation } = useTheme();
  const { user } = useAuth();
  const projectId = route?.params?.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isJoining, setIsJoining] = useState(false);
  const [joinStatus, setJoinStatus] = useState<string | null>(null);

  // Application Modal/Sheet
  const [isApplySheetOpen, setIsApplySheetOpen] = useState(false);
  const [applicationNote, setApplicationNote] = useState('');

  const fetchProjectDetails = useCallback(() => {
    if (!projectId) {
      return;
    }

    projectService
      .getProjectById(projectId)
      .then((data) => {
        if (!data) {
          setScreenState('empty');
        } else {
          setProject(data);
          setScreenState('populated');
        }
        setErrorMessage(undefined);
      })
      .catch((err: any) => {
        setErrorMessage(err?.message || 'Failed to load project details');
        setScreenState('error');
      });
  }, [projectId]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  const isCreator = user?.id === project?.creatorId;
  const membership = project?.members?.find((m) => m.userId === user?.id);
  const isMember = membership?.status === 'ACCEPTED' || isCreator;
  const isPending = membership?.status === 'PENDING' || joinStatus === 'PENDING';

  const handleJoinProject = async () => {
    if (!project) return;
    setIsJoining(true);
    try {
      await projectService.joinProject(project.id);
      setJoinStatus('PENDING');
      setIsApplySheetOpen(false);
      Alert.alert('Application Sent', 'Your application to join this project has been submitted!');
      fetchProjectDetails();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not submit application.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Project Details"
        subtitle="Overview"
        showBack={true}
        onBack={() => navigation?.goBack()}
      />

      <StateWrapper
        state={screenState}
        errorMessage={errorMessage}
        onRetry={fetchProjectDetails}
        emptyTitle="Project Not Found"
        emptySubtitle="The requested project listing could not be found."
        emptyActionLabel="Back to Marketplace"
        onEmptyAction={() => navigation?.goBack()}
      >
        {project && (
          <ScrollView
            style={styles.container}
            contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Project Hero Section */}
            <View
              style={[
                styles.heroContainer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                },
                elevation.card,
              ]}
            >
              <View
                style={[
                  styles.heroIconBadge,
                  { backgroundColor: colors.primarySoft, borderRadius: borderRadius.md },
                ]}
              >
                <Text style={{ fontSize: 32 }}>🚀</Text>
              </View>

              <Text
                style={[
                  styles.heroTitle,
                  {
                    color: colors.text,
                    fontSize: typography.h1.fontSize,
                    fontWeight: typography.h1.fontWeight,
                    lineHeight: typography.h1.lineHeight,
                  },
                ]}
              >
                {project.title}
              </Text>

              <Text
                style={[
                  styles.heroDescription,
                  {
                    color: colors.textMuted,
                    fontSize: typography.body.fontSize,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {project.description}
              </Text>

              {/* Status & Metadata Pills */}
              <View style={[styles.heroBadgesRow, { marginTop: spacing.md }]}>
                <Badge
                  label={project.domain}
                  variant="primary"
                  style={{ marginRight: spacing.xs }}
                />
                {project.semester && (
                  <Badge
                    label={project.semester}
                    variant="secondary"
                    style={{ marginRight: spacing.xs }}
                  />
                )}
                <Badge
                  label={project.status || 'OPEN'}
                  variant={project.status === 'OPEN' ? 'secondary' : 'primary'}
                  style={{ marginRight: spacing.xs }}
                />
                <Badge
                  label={`👥 ${project.members?.length || 1}/${project.maxMembers || 4}`}
                  variant="tertiary"
                />
              </View>
            </View>

            {/* About Section */}
            <View style={[styles.sectionContainer, { marginTop: spacing.lg }]}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: typography.h3.fontSize }]}>
                About the Project
              </Text>
              <Card style={{ marginTop: spacing.xs }}>
                <Text
                  style={[
                    typography.body,
                    { color: colors.text, lineHeight: 22 },
                  ]}
                >
                  {project.description}
                </Text>
              </Card>
            </View>

            {/* Required Skills Section */}
            <View style={[styles.sectionContainer, { marginTop: spacing.lg }]}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: typography.h3.fontSize }]}>
                Required Skills
              </Text>

              {project.requiredSkills && project.requiredSkills.length > 0 ? (
                <View style={[styles.skillsGrid, { marginTop: spacing.xs }]}>
                  {project.requiredSkills.map((item, idx) => {
                    const skillName = item.skill?.name || item.skillName || 'Skill';
                    const exp = item.minimumExperience || 'BEGINNER';
                    return (
                      <View
                        key={item.id || idx.toString()}
                        style={[
                          styles.skillBox,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderRadius: borderRadius.md,
                            padding: spacing.md,
                          },
                        ]}
                      >
                        <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                          {skillName}
                        </Text>
                        <Badge
                          label={exp}
                          variant={exp === 'ADVANCED' ? 'primary' : exp === 'INTERMEDIATE' ? 'secondary' : 'tertiary'}
                          style={{ marginTop: 4 }}
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Card style={{ marginTop: spacing.xs }}>
                  <Text style={[typography.body, { color: colors.textMuted }]}>
                    No specific skill requirements specified.
                  </Text>
                </Card>
              )}
            </View>

            {/* Team & Members Section */}
            <View style={[styles.sectionContainer, { marginTop: spacing.lg }]}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: typography.h3.fontSize }]}>
                Team Members ({project.members?.length || 1})
              </Text>

              <Card style={{ marginTop: spacing.xs }}>
                {project.creator && (
                  <View style={styles.memberRow}>
                    <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>
                        {(project.creator.profile?.fullName || project.creator.email || 'L').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                        {project.creator.profile?.fullName || project.creator.email}
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                        Project Leader
                      </Text>
                    </View>
                    <Badge label="Leader" variant="primary" />
                  </View>
                )}

                {project.members &&
                  project.members
                    .filter((m) => m.userId !== project.creatorId)
                    .map((m, idx) => (
                      <View key={m.id || idx.toString()} style={[styles.memberRow, { marginTop: 12 }]}>
                        <View style={[styles.avatar, { backgroundColor: colors.secondarySoft }]}>
                          <Text style={{ color: colors.secondary, fontWeight: '700', fontSize: 16 }}>
                            {m.role ? m.role.charAt(0).toUpperCase() : 'M'}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                            Member #{idx + 1}
                          </Text>
                          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                            {m.role || 'Contributor'}
                          </Text>
                        </View>
                        <Badge label={m.status} variant={m.status === 'ACCEPTED' ? 'secondary' : 'tertiary'} />
                      </View>
                    ))}
              </Card>
            </View>

            {/* Action CTAs */}
            <View style={[styles.bottomBar, { marginTop: spacing.xl, alignItems: 'center' }]}>
              {isMember ? (
                <Button
                  title="Open Workspace"
                  variant="primary"
                  onPress={() =>
                    navigation?.navigate('Workspace', {
                      projectId: project.id,
                      projectTitle: project.title,
                    })
                  }
                  style={{ minWidth: 220, maxWidth: 320 }}
                />
              ) : isPending ? (
                <Button
                  title="Application Pending"
                  variant="outline"
                  disabled
                  onPress={() => {}}
                  style={{ minWidth: 220, maxWidth: 320 }}
                />
              ) : (
                <Button
                  title={isJoining ? 'Submitting...' : 'Apply to Join Project'}
                  variant="primary"
                  loading={isJoining}
                  disabled={isJoining}
                  onPress={handleJoinProject}
                  style={{ minWidth: 220, maxWidth: 320 }}
                />
              )}
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
  heroContainer: {
    borderWidth: 1,
    alignItems: 'center',
    textAlign: 'center',
  },
  heroIconBadge: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    textAlign: 'center',
  },
  heroDescription: {
    textAlign: 'center',
  },
  heroBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContainer: {},
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillBox: {
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 100,
    alignItems: 'flex-start',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingBottom: 24,
  },
});
