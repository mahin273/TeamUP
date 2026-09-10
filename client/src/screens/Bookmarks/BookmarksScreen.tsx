import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { ProjectCard, ProjectListing } from '../../components/ProjectCard';
import { bookmarkService } from '../../services/bookmarkService';
import { api } from '../../api/client';

const SAMPLE_PROJECTS: ProjectListing[] = [
  {
    id: 'proj-101',
    title: 'TeamUp — Student Partner Finder',
    description: 'Unified cross-platform React Native app with NestJS backend for matching university teammates using weighted skill scores.',
    domain: 'Education',
    semester: 'Fall 2026',
    status: 'OPEN',
    requiredSkills: ['React Native', 'TypeScript', 'NestJS', 'PostgreSQL'],
    ownerName: 'Sarah Connor',
    memberCount: 2,
    maxMembers: 4,
    isBookmarked: true,
  },
  {
    id: 'proj-102',
    title: 'PulseFit — Health Telemetry Dashboard',
    description: 'Wearable health telemetry analytics dashboard with real-time biometric anomaly detection algorithms.',
    domain: 'Healthcare',
    semester: 'Spring 2026',
    status: 'IN_PROGRESS',
    requiredSkills: ['Python', 'PostgreSQL', 'Flutter'],
    ownerName: 'Alex Morgan',
    memberCount: 3,
    maxMembers: 4,
    isBookmarked: true,
  },
];

export interface BookmarksScreenProps {
  onNavigateToSearch?: () => void;
}

export const BookmarksScreen: React.FC<BookmarksScreenProps> = ({
  onNavigateToSearch,
}) => {
  const { colors, typography, spacing } = useTheme();

  const [bookmarkedProjects, setBookmarkedProjects] = useState<ProjectListing[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadBookmarks = useCallback(async () => {
    setScreenState('loading');
    setErrorMessage('');
    setErrorCode(undefined);

    try {
      const bookmarkedIds = await bookmarkService.getBookmarkedIds();

      let allProjects: ProjectListing[] = [];
      try {
        const remoteData = await api.get<ProjectListing[]>('/projects');
        allProjects = Array.isArray(remoteData) ? remoteData : SAMPLE_PROJECTS;
      } catch {
        allProjects = SAMPLE_PROJECTS;
      }

      const savedList = allProjects
        .filter((p) => bookmarkedIds.includes(p.id))
        .map((p) => ({ ...p, isBookmarked: true }));

      setBookmarkedProjects(savedList);
      setScreenState(savedList.length === 0 ? 'empty' : 'populated');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load saved bookmarks.');
      setErrorCode(err?.code);
      setScreenState('error');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setScreenState('loading');
      try {
        const bookmarkedIds = await bookmarkService.getBookmarkedIds();
        if (!isMounted) return;

        let allProjects: ProjectListing[] = [];
        try {
          const remoteData = await api.get<ProjectListing[]>('/projects');
          allProjects = Array.isArray(remoteData) ? remoteData : SAMPLE_PROJECTS;
        } catch {
          allProjects = SAMPLE_PROJECTS;
        }

        const savedList = allProjects
          .filter((p) => bookmarkedIds.includes(p.id))
          .map((p) => ({ ...p, isBookmarked: true }));

        if (!isMounted) return;
        setBookmarkedProjects(savedList);
        setScreenState(savedList.length === 0 ? 'empty' : 'populated');
      } catch (err: any) {
        if (!isMounted) return;
        setErrorMessage(err?.message || 'Failed to load saved bookmarks.');
        setErrorCode(err?.code);
        setScreenState('error');
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBookmarks();
    } finally {
      setRefreshing(false);
    }
  };

  // Optimistic unbookmarking: remove immediately from state & sync storage
  const handleBookmarkToggle = async (projectId: string) => {
    const targetProject = bookmarkedProjects.find((p) => p.id === projectId);
    if (!targetProject) return;

    // Immediate optimistic removal from state
    const nextList = bookmarkedProjects.filter((p) => p.id !== projectId);
    setBookmarkedProjects(nextList);
    if (nextList.length === 0) {
      setScreenState('empty');
    }

    try {
      await bookmarkService.toggleBookmark(targetProject);
    } catch {
      // Revert state if storage write fails
      setBookmarkedProjects(bookmarkedProjects);
      setScreenState('populated');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={{ padding: spacing.md }}>
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
              ]}
            >
              Saved Bookmarks
            </Text>
            <Badge label="Feature 13" variant="secondary" />
          </View>
          <Text
            style={[
              styles.subtitle,
              { color: colors.onSurfaceVariant, marginTop: spacing.xs },
            ]}
          >
            Your bookmarked project listings saved for quick reference.
          </Text>
        </Card>

        {/* Content Wrapper for Loading / Populated / Empty / Error */}
        <StateWrapper
          state={screenState}
          emptyTitle="No Saved Bookmarks Yet"
          emptySubtitle="Tap the bookmark icon 🔖 on any project card in Search to save projects here."
          emptyActionLabel="Browse Projects"
          onEmptyAction={onNavigateToSearch}
          errorMessage={errorMessage}
          errorCode={errorCode}
          onRetry={loadBookmarks}
        >
          <View style={{ marginTop: spacing.md }}>
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
              ]}
            >
              Bookmarked Projects ({bookmarkedProjects.length})
            </Text>

            {bookmarkedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onBookmarkToggle={handleBookmarkToggle}
              />
            ))}
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
  sectionHeader: {
    fontWeight: '700',
  },
});
