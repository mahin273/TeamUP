import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Badge } from '../../components/Badge';
import { projectService } from '../../services/projectService';

export interface CreateProjectScreenProps {
  navigation?: any;
  route?: any;
}

export const CreateProjectScreen: React.FC<CreateProjectScreenProps> = ({ navigation, route }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const prefill = route?.params?.prefill;

  // Current Step: 1 = Basics, 2 = Team & Skills, 3 = Review
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Basics
  const [title, setTitle] = useState(prefill?.title || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [domain, setDomain] = useState(prefill?.domain || '');
  const [semester, setSemester] = useState(prefill?.semester || '');

  // Step 2: Team & Skills
  const [maxMembers, setMaxMembers] = useState(
    prefill?.teamSize ? String(parseInt(prefill.teamSize, 10) || 4) : '4'
  );
  const [newSkill, setNewSkill] = useState('');
  const [skillLevel, setSkillLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('INTERMEDIATE');
  const [skills, setSkills] = useState<{ skillName: string; minimumExperience: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' }[]>(
    () => {
      if (prefill?.techStack && Array.isArray(prefill.techStack)) {
        return prefill.techStack.map((tech: string) => ({
          skillName: tech,
          minimumExperience: 'INTERMEDIATE' as const,
        }));
      }
      return [];
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = 'Project title is required';
    } else if (title.trim().length < 3) {
      errs.title = 'Title must be at least 3 characters long';
    }

    if (!description.trim()) {
      errs.description = 'Project description is required';
    } else if (description.trim().length < 10) {
      errs.description = 'Description must be at least 10 characters long';
    }

    if (!domain.trim()) {
      errs.domain = 'Domain is required (e.g. AI / ML, Web Development)';
    }

    if (!semester.trim()) {
      errs.semester = 'Semester is required (e.g. Fall 2026)';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStep1Next = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleAddSkill = () => {
    if (!newSkill.trim()) return;
    const trimmed = newSkill.trim();
    if (skills.some((s) => s.skillName.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Skill already added', 'This skill is already in the requirements list.');
      return;
    }
    setSkills([...skills, { skillName: trimmed, minimumExperience: skillLevel }]);
    setNewSkill('');
  };

  const handleRemoveSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    setServerError(null);
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await projectService.createProject({
        title: title.trim(),
        description: description.trim(),
        domain: domain.trim(),
        semester: semester.trim(),
        maxMembers: parseInt(maxMembers, 10) || 4,
        requiredSkills: skills,
      });

      Alert.alert('Success', 'Project created successfully!', [
        {
          text: 'Open Workspace',
          onPress: () => {
            navigation?.replace?.('Workspace', {
              projectId: created.id,
              projectTitle: created.title,
            });
          },
        },
      ]);
    } catch (err: any) {
      setServerError(err?.message || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Create Project Listing"
        subtitle={`Step ${currentStep} of 3: ${currentStep === 1 ? 'Basics' : currentStep === 2 ? 'Team & Skills' : 'Review'}`}
        showBack={true}
        onBack={() => {
          if (currentStep > 1) {
            setCurrentStep((prev) => (prev - 1) as any);
          } else {
            navigation?.goBack?.();
          }
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Stepper Bar */}
        <View style={styles.stepperContainer}>
          {[1, 2, 3].map((step) => (
            <TouchableOpacity
              key={step}
              style={[
                styles.stepItem,
                {
                  borderBottomColor: currentStep >= step ? colors.primary : colors.border,
                  borderBottomWidth: 3,
                },
              ]}
              onPress={() => {
                if (step === 1 || validateStep1()) {
                  setCurrentStep(step as any);
                }
              }}
            >
              <Text
                style={{
                  color: currentStep >= step ? colors.primary : colors.textMuted,
                  fontWeight: currentStep === step ? '700' : '500',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                {step === 1 ? '1. Basics' : step === 2 ? '2. Team' : '3. Review'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {serverError && (
          <Card style={{ backgroundColor: colors.errorContainer, marginBottom: spacing.md }}>
            <Text style={[typography.body, { color: colors.onErrorContainer }]}>{serverError}</Text>
          </Card>
        )}

        {/* STEP 1: BASICS */}
        {currentStep === 1 && (
          <View>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
                Basic Information
              </Text>

              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 4 }]}>
                Project Title *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceMuted,
                    color: colors.text,
                    borderColor: errors.title ? colors.accent : colors.border,
                    borderRadius: borderRadius.md,
                    padding: spacing.sm + 2,
                    marginBottom: errors.title ? 4 : spacing.sm,
                  },
                ]}
                placeholder="e.g. Distributed Task Orchestrator"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={(val) => {
                  setTitle(val);
                  if (errors.title) setErrors({ ...errors, title: '' });
                }}
              />
              {errors.title ? (
                <Text style={[styles.errorText, { color: colors.accent, marginBottom: spacing.sm }]}>
                  {errors.title}
                </Text>
              ) : null}

              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 4 }]}>
                Description *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.surfaceMuted,
                    color: colors.text,
                    borderColor: errors.description ? colors.accent : colors.border,
                    borderRadius: borderRadius.md,
                    padding: spacing.sm + 2,
                    marginBottom: errors.description ? 4 : spacing.sm,
                  },
                ]}
                placeholder="Describe project objectives, architecture, expectations..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={(val) => {
                  setDescription(val);
                  if (errors.description) setErrors({ ...errors, description: '' });
                }}
                multiline
                numberOfLines={4}
              />
              {errors.description ? (
                <Text style={[styles.errorText, { color: colors.accent, marginBottom: spacing.sm }]}>
                  {errors.description}
                </Text>
              ) : null}

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.textMuted, marginBottom: 4 }]}>
                    Domain *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surfaceMuted,
                        color: colors.text,
                        borderColor: errors.domain ? colors.accent : colors.border,
                        borderRadius: borderRadius.md,
                        padding: spacing.sm + 2,
                        marginBottom: errors.domain ? 4 : spacing.sm,
                      },
                    ]}
                    placeholder="e.g. Mobile, AI/ML"
                    placeholderTextColor={colors.textMuted}
                    value={domain}
                    onChangeText={(val) => {
                      setDomain(val);
                      if (errors.domain) setErrors({ ...errors, domain: '' });
                    }}
                  />
                  {errors.domain ? (
                    <Text style={[styles.errorText, { color: colors.accent, marginBottom: spacing.sm }]}>
                      {errors.domain}
                    </Text>
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[typography.label, { color: colors.textMuted, marginBottom: 4 }]}>
                    Semester *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surfaceMuted,
                        color: colors.text,
                        borderColor: errors.semester ? colors.accent : colors.border,
                        borderRadius: borderRadius.md,
                        padding: spacing.sm + 2,
                        marginBottom: errors.semester ? 4 : spacing.sm,
                      },
                    ]}
                    placeholder="e.g. Fall 2026"
                    placeholderTextColor={colors.textMuted}
                    value={semester}
                    onChangeText={(val) => {
                      setSemester(val);
                      if (errors.semester) setErrors({ ...errors, semester: '' });
                    }}
                  />
                  {errors.semester ? (
                    <Text style={[styles.errorText, { color: colors.accent, marginBottom: spacing.sm }]}>
                      {errors.semester}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>

            <Button
              title="Create Project"
              variant="primary"
              onPress={() => {
                if (validateStep1()) {
                  setCurrentStep(2);
                }
              }}
              style={{
                marginTop: spacing.sm,
                minWidth: 200,
                maxWidth: 280,
                alignSelf: 'center',
              }}
            />
          </View>
        )}

        {/* STEP 2: TEAM & SKILLS */}
        {currentStep === 2 && (
          <View>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
                Team Configuration
              </Text>

              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 4 }]}>
                Maximum Team Members (2–20)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceMuted,
                    color: colors.text,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                    padding: spacing.sm + 2,
                    marginBottom: spacing.md,
                  },
                ]}
                keyboardType="numeric"
                value={maxMembers}
                onChangeText={setMaxMembers}
              />

              <Text style={[typography.h3, { color: colors.text, marginBottom: 4 }]}>
                Required Skills
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.sm }]}>
                Specify key technologies and experience level.
              </Text>

              <View style={styles.addSkillRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      backgroundColor: colors.surfaceMuted,
                      color: colors.text,
                      borderColor: colors.border,
                      borderRadius: borderRadius.md,
                      padding: spacing.sm + 2,
                      marginRight: spacing.sm,
                    },
                  ]}
                  placeholder="e.g. React Native, NestJS"
                  placeholderTextColor={colors.textMuted}
                  value={newSkill}
                  onChangeText={setNewSkill}
                />
                <Button title="+ Add" variant="secondary" onPress={handleAddSkill} size="sm" />
              </View>

              {/* Experience Level Selector */}
              <View style={styles.expPickerRow}>
                {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((lvl) => (
                  <Chip
                    key={lvl}
                    label={lvl}
                    selected={skillLevel === lvl}
                    onPress={() => setSkillLevel(lvl)}
                    style={{ marginRight: 6 }}
                  />
                ))}
              </View>

              {/* Added Skills List */}
              {skills.length > 0 && (
                <View style={styles.skillsList}>
                  {skills.map((s, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.skillTag,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderColor: colors.border,
                          borderRadius: borderRadius.pill,
                        },
                      ]}
                    >
                      <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '600', marginRight: 6 }]}>
                        {s.skillName} ({s.minimumExperience})
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveSkill(idx)}>
                        <Text style={{ color: colors.accent, fontWeight: '700' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            <View style={styles.stepButtonsRow}>
              <Button
                title="← Back"
                variant="outline"
                onPress={() => setCurrentStep(1)}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Next: Review →"
                variant="primary"
                onPress={() => setCurrentStep(3)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {/* STEP 3: REVIEW & PUBLISH */}
        {currentStep === 3 && (
          <View>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[typography.label, { color: colors.primary, fontWeight: '700', marginBottom: 4 }]}>
                PROJECT PREVIEW
              </Text>
              <Text style={[typography.h2, { color: colors.text, fontWeight: '700', marginBottom: 4 }]}>
                {title || 'Untitled Project'}
              </Text>
              <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.md }]}>
                {description || 'No description provided.'}
              </Text>

              <View style={styles.previewMetaRow}>
                <Badge label={domain || 'General'} variant="primary" style={{ marginRight: 6 }} />
                <Badge label={semester || 'Ongoing'} variant="secondary" style={{ marginRight: 6 }} />
                <Badge label={`👥 Up to ${maxMembers} members`} variant="tertiary" />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <Text style={[typography.label, { color: colors.textMuted, fontWeight: '700', marginBottom: 6 }]}>
                REQUIRED SKILLS ({skills.length})
              </Text>
              {skills.length > 0 ? (
                <View style={styles.previewSkillsRow}>
                  {skills.map((s, idx) => (
                    <Chip key={idx} label={`${s.skillName} • ${s.minimumExperience}`} selected variant="secondary" />
                  ))}
                </View>
              ) : (
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  No specific required skills.
                </Text>
              )}
            </Card>

            <View style={styles.stepButtonsRow}>
              <Button
                title="← Back"
                variant="outline"
                onPress={() => setCurrentStep(2)}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Publish Project 🚀"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting}
                onPress={handlePublish}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    fontSize: 15,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  errorText: {
    fontSize: 12,
  },
  addSkillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  expPickerRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  skillsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  stepButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  previewMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  previewSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
});
