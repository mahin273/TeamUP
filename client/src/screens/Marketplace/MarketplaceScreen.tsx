import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeInsets } from '../../utils/useSafeInsets';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { SearchBar } from '../../components/SearchBar';
import { StateWrapper, ScreenState } from '../../components/StateWrapper';
import { projectService, Project } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';

export interface MarketplaceScreenProps {
  navigation?: any;
}

const DOMAIN_FILTERS = ['All', 'Web', 'Mobile', 'AI', 'Design'];

export const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeInsets();
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = user?.fullName ? user.fullName.split(' ')[0] : 'there';
    if (hour < 12) return `Good morning, ${name} 👋`;
    if (hour < 18) return `Good afternoon, ${name} 👋`;
    return `Good evening, ${name} 👋`;
  }, [user]);

  const fetchProjects = useCallback((search?: string, domain?: string) => {
    const params: Record<string, any> = {};
    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }
    if (domain && domain !== 'All') {
      params.domain = domain;
    }

    projectService
      .getProjects(params)
      .then((data) => {
        setProjects(data);
        setScreenState(data.length === 0 ? 'empty' : 'populated');
        setErrorMessage(undefined);
      })
      .catch((err: any) => {
        setErrorMessage(err?.message || 'Failed to load projects');
        setScreenState('error');
      });
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const params: Record<string, any> = {};
      if (searchQuery.trim().length > 0) {
        params.search = searchQuery.trim();
      }
      if (selectedDomain !== 'All') {
        params.domain = selectedDomain;
      }
      const data = await projectService.getProjects(params);
      setProjects(data);
      setScreenState(data.length === 0 ? 'empty' : 'populated');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const executeSearch = () => {
    setScreenState('loading');
    fetchProjects(searchQuery, selectedDomain);
  };

  const handleSelectDomain = (domain: string) => {
    setSelectedDomain(domain);
    setScreenState('loading');
    fetchProjects(searchQuery, domain);
  };

  const featuredProject = useMemo(() => {
    if (projects.length > 0) return projects[0];
    return null;
  }, [projects]);

  const regularProjects = useMemo(() => {
    if (projects.length > 1) return projects.slice(1);
    return projects;
  }, [projects]);

  const renderProjectItem = ({ item }: { item: Project }) => {
    const isCreator = user?.id === item.creatorId;
    const isMember = item.members?.some((m) => m.userId === user?.id && m.status === 'ACCEPTED');
    const memberCount = item._count?.members ?? (item.members?.length || 1);

    return (
      <Card
        style={[styles.projectCard, { marginBottom: spacing.md }]}
        onPress={() => navigation?.navigate('ProjectDetail', { projectId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <View style={styles.iconTitleRow}>
              <View
                style={[
                  styles.projectIconBadge,
                  { backgroundColor: colors.primarySoft, borderRadius: borderRadius.sm },
                ]}
              >
                <Text style={{ fontSize: 16 }}>🚀</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text
                  style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              </View>
            </View>
          </View>
          <Badge
            label={item.status || 'OPEN'}
            variant={item.status === 'OPEN' ? 'secondary' : 'primary'}
          />
        </View>

        <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
          <Chip label={item.domain} style={{ marginRight: spacing.xs }} />
          {item.semester ? <Chip label={item.semester} style={{ marginRight: spacing.xs }} /> : null}
          <Badge
            label={`${memberCount}/${item.maxMembers || 4} Members`}
            variant="tertiary"
          />
        </View>

        {item.requiredSkills && item.requiredSkills.length > 0 && (
          <View style={[styles.skillsRow, { marginTop: spacing.xs }]}>
            {item.requiredSkills.slice(0, 3).map((req, idx) => {
              const skillName = req.skill?.name || req.skillName || 'Skill';
              return (
                <Chip
                  key={req.id || idx.toString()}
                  label={skillName}
                  style={{ marginRight: spacing.xs, marginBottom: spacing.xs }}
                />
              );
            })}
            {item.requiredSkills.length > 3 && (
              <Chip
                label={`+${item.requiredSkills.length - 3} more`}
                style={{ marginBottom: spacing.xs }}
              />
            )}
          </View>
        )}

        <View style={[styles.cardFooter, { marginTop: spacing.md }]}>
          {isCreator || isMember ? (
            <Button
              title="Open Workspace"
              variant="secondary"
              onPress={() =>
                navigation?.navigate('Workspace', {
                  projectId: item.id,
                  projectTitle: item.title,
                })
              }
            />
          ) : (
            <Button
              title="View Details"
              variant="outline"
              onPress={() => navigation?.navigate('ProjectDetail', { projectId: item.id })}
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header section with Greeting and Actions */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.screenPadding,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text
              style={[
                styles.greetingText,
                { color: colors.text, fontSize: typography.h2.fontSize, fontWeight: '700' },
              ]}
            >
              {greeting}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
              Find something worth building.
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => navigation?.navigate('Notifications')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={{ fontSize: 18 }}>🔔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Create Project"
              onPress={() => navigation?.navigate('CreateProject')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.createBtn,
                { backgroundColor: colors.primary, borderRadius: borderRadius.pill },
              ]}
            >
              <Text style={styles.createBtnText}>+ Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Global Search Bar */}
        <View style={{ marginTop: spacing.md }}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearch}
            onSubmitEditing={executeSearch}
            onClear={() => {
              setSearchQuery('');
              fetchProjects('', selectedDomain);
            }}
            placeholder="Search projects by title, domain, tech..."
          />
        </View>

        {/* Horizontal Domain Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filtersScroll, { paddingVertical: spacing.sm }]}
        >
          {DOMAIN_FILTERS.map((domain) => (
            <Chip
              key={domain}
              label={domain}
              selected={selectedDomain === domain}
              onPress={() => handleSelectDomain(domain)}
              style={{ marginRight: spacing.xs }}
            />
          ))}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <View style={styles.body}>
        <StateWrapper
          state={screenState}
          errorMessage={errorMessage}
          onRetry={() => {
            setScreenState('loading');
            fetchProjects(searchQuery, selectedDomain);
          }}
          emptyTitle="No Projects Found"
          emptySubtitle="Be the first to create an exciting new project listing!"
          emptyActionLabel="Create Project"
          onEmptyAction={() => navigation?.navigate('CreateProject')}
        >
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            renderItem={renderProjectItem}
            contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: 90 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          />
        </StateWrapper>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: {
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  createBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  filtersScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  projectCard: {},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  projectIconBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
