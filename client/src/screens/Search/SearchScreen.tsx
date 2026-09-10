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
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { ProjectCard, ProjectListing } from '../../components/ProjectCard';
import { api } from '../../api/client';

const DOMAIN_OPTIONS = ['All', 'Fintech', 'Healthcare', 'Education', 'AI & ML', 'IoT', 'Cybersecurity'];
const TECH_OPTIONS = ['All', 'React Native', 'NestJS', 'Python', 'PostgreSQL', 'TypeScript', 'Flutter'];
const SEMESTER_OPTIONS = ['All', 'Fall 2026', 'Spring 2026', 'Fall 2025'];
const STATUS_OPTIONS = ['All', 'OPEN', 'IN_PROGRESS', 'COMPLETED'];

export const SearchScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();

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

  const handleBookmarkToggle = (projectId: string) => {
    setProjects((prev) =>
      prev.map((item) =>
        item.id === projectId ? { ...item, isBookmarked: !item.isBookmarked } : item
      )
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={{ padding: spacing.md }}>
        {/* Header & Search Bar Card */}
        <Card style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
              ]}
            >
              Project Search
            </Text>
            <Badge label="Feature 12" variant="primary" />
          </View>
          <Text
            style={[
              styles.subtitle,
              { color: colors.onSurfaceVariant, marginTop: spacing.xs },
            ]}
          >
            Discover active university projects by keyword, domain, tech stack, and semester.
          </Text>

          {/* Debounced Search Bar Input */}
          <View style={[styles.searchBarRow, { marginTop: spacing.md }]}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  color: colors.onSurface,
                  backgroundColor: colors.surfaceVariant,
                  borderColor: colors.outlineVariant,
                },
              ]}
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="🔍 Search title, description, or domain..."
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {searchInput ? (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setSearchInput('')}
              >
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Sheet Toggle Button */}
          <View style={[styles.filterToggleRow, { marginTop: spacing.md }]}>
            <TouchableOpacity
              style={[
                styles.filterToggleBtn,
                {
                  backgroundColor: isFilterSheetOpen || activeFilterCount > 0
                    ? colors.primaryContainer
                    : colors.surfaceVariant,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={() => setIsFilterSheetOpen(!isFilterSheetOpen)}
            >
              <Text
                style={{
                  color: isFilterSheetOpen || activeFilterCount > 0
                    ? colors.onPrimaryContainer
                    : colors.onSurfaceVariant,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                🎛️ Filter Sheet {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
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
            <View style={[styles.filterSheet, { backgroundColor: colors.surfaceVariant, marginTop: spacing.md }]}>
              {/* Filter 1: Domain */}
              <Text style={[styles.filterLabel, { color: colors.onSurface }]}>
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
              <Text style={[styles.filterLabel, { color: colors.onSurface, marginTop: spacing.xs }]}>
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
              <Text style={[styles.filterLabel, { color: colors.onSurface, marginTop: spacing.xs }]}>
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
              <Text style={[styles.filterLabel, { color: colors.onSurface, marginTop: spacing.xs }]}>
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
                { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
              ]}
            >
              Search Results ({projects.length})
            </Text>

            {projects.map((project) => (
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
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 36,
    fontSize: 14,
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterSheet: {
    padding: 14,
    borderRadius: 12,
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
  },
});
