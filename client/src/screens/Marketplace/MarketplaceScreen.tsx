import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { StateWrapper } from '../../components/StateWrapper';
import { ProjectCard } from '../../components/ProjectCard';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { api, ApiError } from '../../api/client';

export interface Project {
  id: string;
  title: string;
  description: string;
  domain: string;
  techStack: string[];
  requiredSkills: string[];
  semester: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  ownerId: string;
  ownerName: string;
  teamSize: number;
  currentMembers: number;
  createdAt: string;
}

interface MarketplaceFilters {
  domain?: string;
  semester?: string;
  techStack?: string;
}

export const MarketplaceScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MarketplaceFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const domains = ['Web', 'Mobile', 'AI/ML', 'IoT', 'Blockchain', 'Game Dev', 'Other'];
  const semesters = ['Fall 2026', 'Spring 2027', 'Summer 2027'];

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (filters.domain) params.domain = filters.domain;
      if (filters.semester) params.semester = filters.semester;
      if (filters.techStack) params.techStack = filters.techStack;

      const response = await api.get<Project[]>('/projects/search', params);
      setProjects(response);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load projects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, filters]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProjects();
  };

  const handleFilterChange = (key: keyof MarketplaceFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
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
            Loading projects...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
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
            onPress={fetchProjects}
            variant="outline"
            style={{ marginTop: spacing.md }}
          />
        </View>
      );
    }

    if (projects.length === 0) {
      return (
        <View style={[styles.centerContainer, { paddingVertical: spacing.xl * 2 }]}>
          <Text
            style={[
              styles.emptyTitle,
              { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
            ]}
          >
            No Projects Found
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
            Try adjusting your filters or create a new project
          </Text>
          <Button
            title="Create Project"
            onPress={() => {
              /* Navigate to create project */
            }}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      );
    }

    return (
      <View style={{ paddingBottom: spacing.xl * 2 }}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onPress={() => {
              /* Navigate to project details */
            }}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.xl, paddingHorizontal: spacing.md }]}>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.onBackground, fontSize: typography.displayLarge.fontSize },
          ]}
        >
          Marketplace
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
          Discover projects and find your team
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { paddingHorizontal: spacing.md, marginTop: spacing.md }]}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surfaceVariant,
              color: colors.onSurface,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              fontSize: typography.bodyLarge.fontSize,
            },
          ]}
          placeholder="Search projects..."
          placeholderTextColor={colors.onSurfaceVariant}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchProjects}
        />
      </View>

      {/* Filter Toggle */}
      <View style={[styles.filterToggle, { paddingHorizontal: spacing.md, marginTop: spacing.md }]}>
        <Pressable onPress={() => setShowFilters(!showFilters)}>
          <Text style={[styles.filterToggleText, { color: colors.primary, fontSize: typography.bodyLarge.fontSize }]}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Text>
        </Pressable>
        {(filters.domain || filters.semester || searchQuery) && (
          <Pressable onPress={clearFilters}>
            <Text style={[styles.clearFiltersText, { color: colors.tertiary, fontSize: typography.bodyMedium.fontSize }]}>
              Clear All
            </Text>
          </Pressable>
        )}
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={[styles.filtersContainer, { paddingHorizontal: spacing.md, marginTop: spacing.md }]}>
          <Text
            style={[
              styles.filterLabel,
              { color: colors.onSurface, fontSize: typography.titleMedium.fontSize, marginBottom: spacing.sm },
            ]}
          >
            Domain
          </Text>
          <View style={styles.chipContainer}>
            {domains.map((domain) => (
              <Chip
                key={domain}
                label={domain}
                selected={filters.domain === domain}
                onPress={() => handleFilterChange('domain', domain)}
                style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
              />
            ))}
          </View>

          <Text
            style={[
              styles.filterLabel,
              { color: colors.onSurface, fontSize: typography.titleMedium.fontSize, marginTop: spacing.md, marginBottom: spacing.sm },
            ]}
          >
            Semester
          </Text>
          <View style={styles.chipContainer}>
            {semesters.map((semester) => (
              <Chip
                key={semester}
                label={semester}
                selected={filters.semester === semester}
                onPress={() => handleFilterChange('semester', semester)}
                style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
              />
            ))}
          </View>
        </View>
      )}

      {/* Projects List */}
      <ScrollView
        style={[styles.scrollView, { marginTop: spacing.md }]}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* FAB - Create Project */}
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            position: 'absolute',
            bottom: spacing.lg,
            right: spacing.lg,
          },
        ]}
        onPress={() => {
          /* Navigate to create project */
        }}
      >
        <Text style={[styles.fabText, { color: colors.onPrimary, fontSize: 24 }]}>+</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {},
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {},
  searchContainer: {},
  searchInput: {
    borderRadius: 12,
    height: 48,
  },
  filterToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterToggleText: {
    fontWeight: '600',
  },
  clearFiltersText: {},
  filtersContainer: {},
  filterLabel: {
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    fontWeight: '700',
  },
});
