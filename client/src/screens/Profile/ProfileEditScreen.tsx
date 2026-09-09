import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { api, ApiError } from '../../api/client';

export interface ProfileEditScreenProps {
  onClose: () => void;
  onSaved: () => void;
}

export const ProfileEditScreen: React.FC<ProfileEditScreenProps> = ({
  onClose,
  onSaved,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [semester, setSemester] = useState(user?.semester || '');
  const [experienceLevel, setExperienceLevel] = useState<
    'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  >(user?.experienceLevel || 'INTERMEDIATE');
  const [availability, setAvailability] = useState<boolean>(
    user?.availability !== undefined ? user.availability : true
  );
  const [githubUsername, setGithubUsername] = useState(
    user?.githubUsername || ''
  );
  const [portfolioUrl, setPortfolioUrl] = useState(user?.portfolioUrl || '');

  // Skills local state
  const [skills, setSkills] = useState(user?.skills || []);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;
    try {
      const addedSkill = await api.post('/profiles/me/skills', {
        skillName: newSkillName.trim(),
        category: newSkillCategory.trim() || undefined,
      });
      setSkills((prev) => [...prev, addedSkill]);
      setNewSkillName('');
      setNewSkillCategory('');
    } catch {
      // Fallback local update if offline or mock endpoint
      const tempSkill = {
        id: `temp-${Date.now()}`,
        skillName: newSkillName.trim(),
        category: newSkillCategory.trim() || undefined,
      };
      setSkills((prev) => [...prev, tempSkill]);
      setNewSkillName('');
      setNewSkillCategory('');
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    try {
      await api.delete(`/profiles/me/skills/${skillId}`);
    } catch {
      // ignore API failure for temp skill
    } finally {
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    }
  };

  const handleSave = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg('Full name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload: Partial<UserProfile> = {
      fullName: fullName.trim(),
      bio: bio.trim(),
      department: department.trim(),
      semester: semester.trim(),
      experienceLevel,
      availability,
      githubUsername: githubUsername.trim(),
      portfolioUrl: portfolioUrl.trim(),
    };

    try {
      const updated = await api.patch<UserProfile>('/profiles/me', payload);
      updateUser({ ...updated, skills });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || `Error (${err.code}): Failed to update profile.`);
      } else {
        // Fallback update user state locally if backend returns mock
        updateUser({ ...payload, skills });
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.md }}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize },
            ]}
          >
            Edit Profile
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 16 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: colors.errorContainer, borderColor: colors.error },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>
              ⚠️ {errorMsg}
            </Text>
          </View>
        ) : null}

        {/* Full Name */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Full Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceVariant,
                color: colors.onSurface,
                borderColor: colors.outlineVariant,
                borderRadius: borderRadius.md,
              },
            ]}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Bio */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Bio</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: colors.surfaceVariant,
                color: colors.onSurface,
                borderColor: colors.outlineVariant,
                borderRadius: borderRadius.md,
              },
            ]}
            multiline
            numberOfLines={3}
            placeholder="Tell potential teammates about your interests and project experience..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={bio}
            onChangeText={setBio}
          />
        </View>

        {/* Department & Semester */}
        <View style={styles.row}>
          <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
            <Text style={[styles.label, { color: colors.onSurface }]}>Department</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                  borderRadius: borderRadius.md,
                },
              ]}
              placeholder="Computer Science"
              placeholderTextColor={colors.onSurfaceVariant}
              value={department}
              onChangeText={setDepartment}
            />
          </View>

          <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
            <Text style={[styles.label, { color: colors.onSurface }]}>Semester</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                  borderRadius: borderRadius.md,
                },
              ]}
              placeholder="Spring 2026"
              placeholderTextColor={colors.onSurfaceVariant}
              value={semester}
              onChangeText={setSemester}
            />
          </View>
        </View>

        {/* Experience Level Selector */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Experience Level</Text>
          <View style={styles.chipRow}>
            {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((level) => (
              <Chip
                key={level}
                label={level}
                selected={experienceLevel === level}
                onPress={() => setExperienceLevel(level)}
                variant={level === 'ADVANCED' ? 'tertiary' : 'primary'}
              />
            ))}
          </View>
        </View>

        {/* Availability Toggle */}
        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.onSurface, marginBottom: 0 }]}>
            Available for New Projects
          </Text>
          <Switch
            value={availability}
            onValueChange={setAvailability}
            trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
          />
        </View>

        {/* GitHub & Portfolio */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.onSurface }]}>GitHub Username</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceVariant,
                color: colors.onSurface,
                borderColor: colors.outlineVariant,
                borderRadius: borderRadius.md,
              },
            ]}
            placeholder="octocat"
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            value={githubUsername}
            onChangeText={setGithubUsername}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Portfolio URL</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceVariant,
                color: colors.onSurface,
                borderColor: colors.outlineVariant,
                borderRadius: borderRadius.md,
              },
            ]}
            placeholder="https://myportfolio.dev"
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            value={portfolioUrl}
            onChangeText={setPortfolioUrl}
          />
        </View>

        {/* Skills Management */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Manage Skills</Text>
          <View style={styles.chipRow}>
            {skills.map((sk) => (
              <Chip
                key={sk.id}
                label={`${sk.skillName} ✕`}
                selected
                onPress={() => handleRemoveSkill(sk.id)}
                variant="secondary"
              />
            ))}
          </View>

          <View style={[styles.row, { marginTop: 8 }]}>
            <TextInput
              style={[
                styles.input,
                {
                  flex: 2,
                  backgroundColor: colors.surfaceVariant,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                  borderRadius: borderRadius.md,
                  marginRight: 6,
                },
              ]}
              placeholder="Add skill (e.g. Python)"
              placeholderTextColor={colors.onSurfaceVariant}
              value={newSkillName}
              onChangeText={setNewSkillName}
            />
            <Button title="Add" onPress={handleAddSkill} variant="secondary" style={{ flex: 1 }} />
          </View>
        </View>

        <Button title="Save Profile" onPress={handleSave} loading={saving} style={{ marginTop: spacing.md }} />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
