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
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Chip } from '../../components/Chip';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { ProjectCard, ProjectListing } from '../../components/ProjectCard';
import { api } from '../../api/client';
import { bookmarkService } from '../../services/bookmarkService';

const DOMAIN_OPTIONS = ['All', 'Fintech', 'Healthcare', 'Education', 'AI & ML', 'IoT', 'Cybersecurity'];
const TECH_OPTIONS = ['All', 'React Native', 'NestJS', 'Python', 'PostgreSQL', 'TypeScript', 'Flutter'];
const SEMESTER_OPTIONS = ['All', 'Fall 2026', 'Spring 2026', 'Fall 2025'];
const STATUS_OPTIONS = ['All', 'OPEN', 'IN_PROGRESS', 'COMPLETED'];
const SEARCH_CATEGORIES = ['Projects', 'People', 'Ideas'];

export interface SearchScreenProps {
  navigation?: any;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  // Search Category
  const [activeCategory, setActiveCategory] = useState<string>('Projects');

  // Search Input & Debounced State
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  // Filter Sheet Collapse State
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);

  // Selected Filter Dimensions
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [selectedTech, setSelectedTech] = useState<string>('All');
  const [selectedSemester, setSelectedSemester] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Search Results & UI States
  const [projects, setProjects] = useState<ProjectListing[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Debounce search input (350ms delay) to prevent request-per-keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchInput);
    }, 350);

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput]);

  const executeSearch = useCallback(async () => {
    setScreenState('loading');
    setErrorMessage('');
    setErrorCode(undefined);

    const queryParams: Record<string, string> = {};
    if (debouncedSearchQuery.trim()) queryParams.search = debouncedSearchQuery.trim();
    if (selectedDomain !== 'All') queryParams.domain = selectedDomain;
    if (selectedTech !== 'All') queryParams.tech = selectedTech;
    if (selectedSemester !== 'All') queryParams.semester = selectedSemester;
    if (selectedStatus !== 'All') queryParams.status = selectedStatus;

    try {
      const data = await api.get<ProjectListing[]>('/projects/search', queryParams);
      const results = Array.isArray(data) ? data : [];
      setProjects(results);
      setScreenState(results.length === 0 ? 'empty' : 'populated');
    } catch (err: any) {
      const msg = err?.message || 'Failed to search project listings.';
      setErrorMessage(msg);
      setErrorCode(err?.code);
      setProjects([]);
      setScreenState('error');
    }
  }, [debouncedSearchQuery, selectedDomain, selectedTech, selectedSemester, selectedStatus]);

  useEffect(() => {
    let isMounted = true;

    async function initSearch() {
      setScreenState('loading');
      setErrorMessage('');
      setErrorCode(undefined);

      const queryParams: Record<string, string> = {};
      if (debouncedSearchQuery.trim()) queryParams.search = debouncedSearchQuery.trim();
      if (selectedDomain !== 'All') queryParams.domain = selectedDomain;
      if (selectedTech !== 'All') queryParams.tech = selectedTech;
      if (selectedSemester !== 'All') queryParams.semester = selectedSemester;
      if (selectedStatus !== 'All') queryParams.status = selectedStatus;

      try {
        const data = await api.get<ProjectListing[]>('/projects/search', queryParams);
        if (!isMounted) return;
        const results = Array.isArray(data) ? data : [];
        setProjects(results);
        setScreenState(results.length === 0 ? 'empty' : 'populated');
      } catch (err: any) {
        if (!isMounted) return;
        const msg = err?.message || 'Failed to search project listings.';
        setErrorMessage(msg);
        setErrorCode(err?.code);
        setProjects([]);
        setScreenState('error');
      }
    }

    initSearch();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearchQuery, selectedDomain, selectedTech, selectedSemester, selectedStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await executeSearch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearchQuery('');
    setSelectedDomain('All');
    setSelectedTech('All');
    setSelectedSemester('All');
    setSelectedStatus('All');
  };

  const activeFilterCount =
    (selectedDomain !== 'All' ? 1 : 0) +
    (selectedTech !== 'All' ? 1 : 0) +
    (selectedSemester !== 'All' ? 1 : 0) +
    (selectedStatus !== 'All' ? 1 : 0);

  const handleBookmarkToggle = async (projectId: string) => {
    const targetProject = projects.find((p) => p.id === projectId);

    // Optimistic UI update
    setProjects((prev) =>
      prev.map((item) =>
        item.id === projectId ? { ...item, isBookmarked: !item.isBookmarked } : item
      )
    );

    if (targetProject) {
      try {
        await bookmarkService.toggleBookmark(targetProject);
      } catch {
        // Revert optimistic state on error
        setProjects((prev) =>
          prev.map((item) =>
            item.id === projectId ? { ...item, isBookmarked: targetProject.isBookmarked } : item
          )
        );
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Project Search"
        subtitle="Find projects, classmates & skills"
        showBack={Boolean(navigation)}
        onBack={() => {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          } else if (navigation?.navigate) {
            navigation.navigate('MainApp', { screen: 'More' });
          }
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={{ padding: spacing.screenPadding }}>
          {/* Header & Search Bar Card */}
          <Card style={styles.headerCard}>
            {/* Category Segmented Controls */}
            <View style={styles.categoryRow}>
              {SEARCH_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  accessibilityRole="button"
                  onPress={() => setActiveCategory(cat)}
                  style={[
                    styles.categoryBtn,
                    {
                      backgroundColor: activeCategory === cat ? colors.primary : colors.surfaceMuted,
                      borderRadius: borderRadius.pill,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: activeCategory === cat ? '#FFFFFF' : colors.textMuted,
                      fontWeight: '600',
                      fontSize: 13,
                    }}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Debounced Search Bar Input */}
            <View style={[styles.searchBarRow, { marginTop: spacing.md }]}>
              <Text style={{ fontSize: 16, marginRight: 8, color: colors.textMuted }}>🔍</Text>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search title, description, or domain..."
                placeholderTextColor={colors.textMuted}
              />

              {searchInput ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={styles.clearBtn}
                  onPress={() => setSearchInput('')}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Sheet Toggle Button */}
            <View style={[styles.filterToggleRow, { marginTop: spacing.md }]}>
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.filterToggleBtn,
                  {
                    backgroundColor:
                      isFilterSheetOpen || activeFilterCount > 0
                        ? colors.primarySoft
                        : colors.surfaceMuted,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={() => setIsFilterSheetOpen(!isFilterSheetOpen)}
              >
                <Text
                  style={{
                    color:
                      isFilterSheetOpen || activeFilterCount > 0
                        ? colors.primary
                        : colors.text,
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  Filter Sheet {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                </Text>
              </TouchableOpacity>

              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={handleResetFilters}>
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13, marginLeft: 12 }}>
                    Reset All
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Collapsible Filter Sheet Container */}
            {isFilterSheetOpen && (
              <View
                style={[
                  styles.filterSheet,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    marginTop: spacing.md,
                  },
                ]}
              >
                {/* Filter 1: Domain */}
                <Text style={[styles.filterLabel, { color: colors.text }]}>
                  Domain:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  {DOMAIN_OPTIONS.map((d) => (
                    <Chip
                      key={d}
                      label={d}
                      selected={selectedDomain === d}
                      onPress={() => setSelectedDomain(d)}
                      variant="primary"
                    />
                  ))}
                </ScrollView>

                {/* Filter 2: Tech Stack */}
                <Text style={[styles.filterLabel, { color: colors.text, marginTop: spacing.xs }]}>
                  Tech Stack:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  {TECH_OPTIONS.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      selected={selectedTech === t}
                      onPress={() => setSelectedTech(t)}
                      variant="secondary"
                    />
                  ))}
                </ScrollView>

                {/* Filter 3: Semester */}
                <Text style={[styles.filterLabel, { color: colors.text, marginTop: spacing.xs }]}>
                  Semester:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                  {SEMESTER_OPTIONS.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      selected={selectedSemester === s}
                      onPress={() => setSelectedSemester(s)}
                      variant="primary"
                    />
                  ))}
                </ScrollView>

                {/* Filter 4: Project Status */}
                <Text style={[styles.filterLabel, { color: colors.text, marginTop: spacing.xs }]}>
                  Status:
                </Text>
                <View style={styles.chipRow}>
                  {STATUS_OPTIONS.map((st) => (
                    <Chip
                      key={st}
                      label={st}
                      selected={selectedStatus === st}
                      onPress={() => setSelectedStatus(st)}
                      variant="tertiary"
                    />
                  ))}
                </View>
              </View>
            )}
          </Card>

          {/* Search Results Content */}
          <StateWrapper
            state={screenState}
            emptyTitle="No Projects Found"
            emptySubtitle="No projects matching your combined search criteria were found. Try clearing keywords or resetting filters."
            emptyActionLabel="Reset All Filters"
            onEmptyAction={handleResetFilters}
            errorMessage={errorMessage}
            errorCode={errorCode}
            onRetry={executeSearch}
          >
            <View style={{ marginTop: spacing.md }}>
              <Text
                style={[
                  styles.resultsHeader,
                  { color: colors.text, fontSize: typography.h3.fontSize },
                ]}
              >
                Search Results ({projects.length})
              </Text>

              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onBookmarkToggle={handleBookmarkToggle}
                  onPress={() => navigation?.navigate?.('ProjectDetail', { projectId: project.id })}
                />
              ))}
            </View>
          </StateWrapper>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    padding: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingRight: 36,
    fontSize: 14,
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    padding: 6,
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  filterSheet: {
    padding: 14,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  resultsHeader: {
    fontWeight: '700',
    marginBottom: 4,
  },
});
