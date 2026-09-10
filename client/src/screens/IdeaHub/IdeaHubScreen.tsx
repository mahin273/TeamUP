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
import { IdeaCard, ProjectIdea } from '../../components/IdeaCard';
import { AILoadingCard } from '../../components/AILoadingCard';
import { api } from '../../api/client';

const DOMAIN_OPTIONS = ['Fintech', 'Healthcare', 'Education', 'AI & ML', 'Cybersecurity', 'IoT'];
const TECH_OPTIONS = ['React Native', 'TypeScript', 'NestJS', 'Python', 'PostgreSQL', 'Flutter'];

// Sample fallback ideas for feed or LLM outage
const DEFAULT_IDEAS: ProjectIdea[] = [
  {
    id: 'idea-1',
    title: 'EduSprint — Peer Micro-tutoring Platform',
    description: 'A platform matching students needing fast project help with senior student mentors in real-time video slots.',
    domain: 'Education',
    techStack: ['React Native', 'TypeScript', 'NestJS', 'WebRTC'],
    difficulty: 'INTERMEDIATE',
    estimatedDuration: '4-6 weeks',
    teamSize: '3-4 members',
    features: [
      'Real-time peer matching algorithm based on skill tags',
      'In-app whiteboard and screen sharing',
      'Peer rating and token-based reward system',
    ],
    isSaved: false,
  },
  {
    id: 'idea-2',
    title: 'EcoPulse — AI Campus Energy Optimizer',
    description: 'IoT sensor dashboard and predictive model to analyze and lower building power usage across campus.',
    domain: 'IoT',
    techStack: ['Python', 'PostgreSQL', 'React Native', 'TensorFlow'],
    difficulty: 'ADVANCED',
    estimatedDuration: '6-8 weeks',
    teamSize: '4 members',
    features: [
      'Real-time telemetry telemetry ingestion pipeline',
      'Predictive usage anomaly detection',
      'Gamified department energy savings leaderboard',
    ],
    isSaved: true,
  },
  {
    id: 'idea-3',
    title: 'PayBuddy — Shared Expenses & Budget Tracker',
    description: 'Split student house bills and project budget expenses with automated receipt OCR scanning.',
    domain: 'Fintech',
    techStack: ['React Native', 'NestJS', 'PostgreSQL'],
    difficulty: 'BEGINNER',
    estimatedDuration: '3-4 weeks',
    teamSize: '2-3 members',
    features: [
      'Automated receipt parsing via vision API',
      'Equal & custom percentage bill splitting',
      'Monthly budget analytics and reminder push alerts',
    ],
    isSaved: false,
  },
];

export const IdeaHubScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();

  const [activeTab, setActiveTab] = useState<'generator' | 'feed'>('generator');

  // Generator Form State
  const [selectedDomain, setSelectedDomain] = useState<string>('Fintech');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [selectedTechs, setSelectedTechs] = useState<string[]>(['React Native', 'NestJS']);
  const [customTech, setCustomTech] = useState<string>('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('INTERMEDIATE');

  // Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedIdea, setGeneratedIdea] = useState<ProjectIdea | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);

  // Feed State
  const [feedIdeas, setFeedIdeas] = useState<ProjectIdea[]>([]);
  const [feedState, setFeedState] = useState<ScreenState>('loading');
  const [feedFilterDomain, setFeedFilterDomain] = useState<string>('All');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchFeedIdeas = useCallback(async () => {
    setFeedState('loading');
    try {
      const data = await api.get<ProjectIdea[]>('/ideas');
      const list = Array.isArray(data) ? data : [];
      if (list.length === 0) {
        setFeedIdeas(DEFAULT_IDEAS);
      } else {
        setFeedIdeas(list);
      }
      setFeedState('populated');
    } catch {
      // Graceful fallback to initial community templates if feed endpoint is quiet
      setFeedIdeas(DEFAULT_IDEAS);
      setFeedState('populated');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initFeed() {
      setFeedState('loading');
      try {
        const data = await api.get<ProjectIdea[]>('/ideas');
        if (!isMounted) return;

        const list = Array.isArray(data) ? data : [];
        if (list.length === 0) {
          setFeedIdeas(DEFAULT_IDEAS);
        } else {
          setFeedIdeas(list);
        }
        setFeedState('populated');
      } catch {
        if (!isMounted) return;
        setFeedIdeas(DEFAULT_IDEAS);
        setFeedState('populated');
      }
    }

    initFeed();

    return () => {
      isMounted = false;
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchFeedIdeas();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleTech = (tech: string) => {
    if (selectedTechs.includes(tech)) {
      setSelectedTechs(selectedTechs.filter((t) => t !== tech));
    } else {
      setSelectedTechs([...selectedTechs, tech]);
    }
  };

  const handleAddCustomTech = () => {
    const trimmed = customTech.trim();
    if (trimmed && !selectedTechs.includes(trimmed)) {
      setSelectedTechs([...selectedTechs, trimmed]);
      setCustomTech('');
    }
  };

  const handleGenerateIdea = async () => {
    const domain = customDomain.trim() || selectedDomain;
    if (!domain) return;

    setIsGenerating(true);
    setLlmError(null);
    setGeneratedIdea(null);

    try {
      const payload = {
        domain,
        techStack: selectedTechs,
        difficulty,
      };

      const response = await api.post<ProjectIdea>('/ideas/generate', payload);

      if (response && response.title) {
        setGeneratedIdea(response);
      } else {
        // Fallback generated response structure
        const fallbackIdea: ProjectIdea = {
          id: `gen-${Date.now()}`,
          title: `${domain} Smart Assistant Platform`,
          description: `An intelligent ${domain.toLowerCase()} platform leveraging ${selectedTechs.join(
            ', '
          )} to automate team workflows and provide real-time insights.`,
          domain,
          techStack: selectedTechs.length > 0 ? selectedTechs : ['React Native', 'TypeScript'],
          difficulty,
          estimatedDuration: '4-6 weeks',
          teamSize: '3-4 members',
          features: [
            'Automated AI-assisted workflow dashboard',
            'Role-based security & real-time synchronization',
            'Comprehensive exportable analytics report',
          ],
          isSaved: false,
        };
        setGeneratedIdea(fallbackIdea);
      }
    } catch (err: any) {
      // LLM Graceful Fallback per Design Doc / Instructions
      const message = err?.message || 'LLM Service Busy — AI generator is experiencing high demand. Please try again in a moment.';
      setLlmError(message);

      // Provide fallback generated template so screen never crashes
      setGeneratedIdea({
        id: `fallback-${Date.now()}`,
        title: `${domain} Collaborative Hub (Offline Template)`,
        description: `A robust ${domain.toLowerCase()} application template using ${selectedTechs.join(
          ', '
        )}. (Generated via backup template due to temporary LLM API rate limit).`,
        domain,
        techStack: selectedTechs.length > 0 ? selectedTechs : ['React Native', 'Node.js'],
        difficulty,
        estimatedDuration: '4 weeks',
        teamSize: '3 members',
        features: [
          'Modular project dashboard & task list',
          'Responsive UI with Material 3 design tokens',
          'RESTful API client envelope integration',
        ],
        isSaved: false,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleSave = (ideaId: string) => {
    setFeedIdeas((prev) =>
      prev.map((item) =>
        item.id === ideaId ? { ...item, isSaved: !item.isSaved } : item
      )
    );
    if (generatedIdea && generatedIdea.id === ideaId) {
      setGeneratedIdea({ ...generatedIdea, isSaved: !generatedIdea.isSaved });
    }
  };

  const filteredFeedIdeas = feedFilterDomain === 'All'
    ? feedIdeas
    : feedIdeas.filter((item) => item.domain.toLowerCase() === feedFilterDomain.toLowerCase());

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={{ padding: spacing.md }}>
        {/* Top Header Card */}
        <Card style={styles.headerCard}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
              ]}
            >
              Idea Hub & AI Generator
            </Text>
            <Badge label="AI Brainstorm" variant="tertiary" />
          </View>
          <Text
            style={[
              styles.subtitle,
              { color: colors.onSurfaceVariant, marginTop: spacing.xs },
            ]}
          >
            Generate tailored university project ideas powered by LLM or explore community project benchmarks.
          </Text>

          {/* Mode Switcher Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.surfaceVariant, marginTop: spacing.md }]}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'generator' && { backgroundColor: colors.surface },
              ]}
              onPress={() => setActiveTab('generator')}
            >
              <Text
                style={{
                  color: activeTab === 'generator' ? colors.primary : colors.onSurfaceVariant,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                🪄 AI Generator
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'feed' && { backgroundColor: colors.surface },
              ]}
              onPress={() => setActiveTab('feed')}
            >
              <Text
                style={{
                  color: activeTab === 'feed' ? colors.primary : colors.onSurfaceVariant,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                💡 Idea Hub Feed
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {activeTab === 'generator' ? (
          <View style={{ marginTop: spacing.md }}>
            {/* AI Generator Form Bento Card */}
            <Card style={styles.formCard}>
              <Text
                style={[
                  styles.formSectionTitle,
                  { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
                ]}
              >
                1. Select Target Domain
              </Text>
              <View style={[styles.chipGrid, { marginTop: spacing.xs }]}>
                {DOMAIN_OPTIONS.map((domain) => (
                  <Chip
                    key={domain}
                    label={domain}
                    selected={selectedDomain === domain && !customDomain}
                    onPress={() => {
                      setSelectedDomain(domain);
                      setCustomDomain('');
                    }}
                    variant="primary"
                  />
                ))}
              </View>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: colors.onSurface,
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.outlineVariant,
                    marginTop: spacing.xs,
                  },
                ]}
                value={customDomain}
                onChangeText={setCustomDomain}
                placeholder="Or enter custom domain (e.g. Robotics)"
                placeholderTextColor={colors.onSurfaceVariant}
              />

              <Text
                style={[
                  styles.formSectionTitle,
                  { color: colors.onSurface, fontSize: typography.titleMedium.fontSize, marginTop: spacing.md },
                ]}
              >
                2. Target Tech Stack
              </Text>
              <View style={[styles.chipGrid, { marginTop: spacing.xs }]}>
                {TECH_OPTIONS.map((tech) => (
                  <Chip
                    key={tech}
                    label={tech}
                    selected={selectedTechs.includes(tech)}
                    onPress={() => toggleTech(tech)}
                    variant="secondary"
                  />
                ))}
              </View>

              <View style={[styles.customTechRow, { marginTop: spacing.xs }]}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      flex: 1,
                      color: colors.onSurface,
                      backgroundColor: colors.surfaceVariant,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  value={customTech}
                  onChangeText={setCustomTech}
                  placeholder="Add custom tech (e.g. GraphQL)"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
                <TouchableOpacity
                  style={[styles.addTechBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAddCustomTech}
                >
                  <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.formSectionTitle,
                  { color: colors.onSurface, fontSize: typography.titleMedium.fontSize, marginTop: spacing.md },
                ]}
              >
                3. Difficulty Level
              </Text>
              <View style={[styles.difficultyRow, { marginTop: spacing.xs }]}>
                {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((level) => (
                  <Chip
                    key={level}
                    label={level}
                    selected={difficulty === level}
                    onPress={() => setDifficulty(level)}
                    variant={level === 'ADVANCED' ? 'tertiary' : 'primary'}
                  />
                ))}
              </View>

              {/* Generate Action Button */}
              <Button
                title="Generate Project Idea with AI 🪄"
                onPress={handleGenerateIdea}
                variant="primary"
                loading={isGenerating}
                disabled={isGenerating}
                style={{ marginTop: spacing.lg }}
              />
            </Card>

            {/* AI Generation Loading Skeleton State */}
            {isGenerating && <AILoadingCard />}

            {/* Graceful Fallback LLM Warning Card */}
            {llmError && (
              <Card style={[styles.errorCard, { borderColor: colors.error, marginTop: spacing.md }]}>
                <Text style={[styles.errorTitle, { color: colors.error }]}>
                  ⚡ LLM Service Notice
                </Text>
                <Text style={{ color: colors.onSurface, fontSize: 13, marginTop: 4 }}>
                  {llmError}
                </Text>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>
                  A backup project template was generated below so you can proceed without interruption.
                </Text>
              </Card>
            )}

            {/* Generated Idea Result Card */}
            {!isGenerating && generatedIdea && (
              <View style={{ marginTop: spacing.sm }}>
                <Text
                  style={[
                    styles.resultHeader,
                    { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
                  ]}
                >
                  Generated Idea Result:
                </Text>
                <IdeaCard
                  idea={generatedIdea}
                  isGenerated
                  onSaveToggle={handleToggleSave}
                />
              </View>
            )}
          </View>
        ) : (
          /* Idea Hub Feed Tab */
          <View style={{ marginTop: spacing.md }}>
            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              {['All', 'Education', 'IoT', 'Fintech', 'Healthcare', 'AI & ML'].map((d) => (
                <Chip
                  key={d}
                  label={d}
                  selected={feedFilterDomain === d}
                  onPress={() => setFeedFilterDomain(d)}
                  variant="primary"
                />
              ))}
            </ScrollView>

            <StateWrapper
              state={filteredFeedIdeas.length === 0 ? 'empty' : feedState}
              emptyTitle="No Ideas Found"
              emptySubtitle="No community ideas found for this domain tag yet. Switch to the AI Generator tab to create one!"
              emptyActionLabel="Generate New Idea"
              onEmptyAction={() => setActiveTab('generator')}
              onRetry={fetchFeedIdeas}
            >
              {filteredFeedIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onSaveToggle={handleToggleSave}
                />
              ))}
            </StateWrapper>
          </View>
        )}
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
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    padding: 18,
  },
  formSectionTitle: {
    fontWeight: '600',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  customTechRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addTechBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  errorCard: {
    padding: 14,
    borderWidth: 1,
  },
  errorTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  resultHeader: {
    fontWeight: '700',
    marginTop: 8,
  },
});
