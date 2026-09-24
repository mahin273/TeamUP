import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { GitHubIcon } from '../../components/GitHubIcon';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../api/client';

export const RegisterScreen = ({ navigation }: any) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGitHubRegister = async () => {
    setGithubLoading(true);
    setErrorMsg(null);
    try {
      const redirectUri =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : 'teamup://github-callback';

      let targetUrl = `https://github.com/login/oauth/authorize?client_id=Ov23liDPxJFmHfgane2n&scope=read:user%20repo&redirect_uri=${encodeURIComponent(
        redirectUri
      )}`;

      try {
        const res = await api.get<{ url: string }>(
          `/github/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`
        );
        if (res && res.url) {
          targetUrl = res.url;
        }
      } catch {
        // Fallback targetUrl
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = targetUrl;
      } else {
        await Linking.openURL(targetUrl);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to initiate GitHub authorization.');
    } finally {
      setGithubLoading(false);
    }
  };

  const validate = (): boolean => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg('Full name must be at least 2 characters.');
      return false;
    }
    if (!email.trim()) {
      setErrorMsg('Email address is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      await register(fullName.trim(), email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || `Error (${err.code}): Registration failed.`);
      } else {
        setErrorMsg('Unable to connect to server. Please check your network.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { backgroundColor: colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centerContainer}>
          <Card style={styles.card}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.primary,
                  fontSize: typography.displayLarge.fontSize,
                },
              ]}
            >
              Create Account
            </Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              Join TeamUp to connect with project teammates
            </Text>

            {errorMsg ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: colors.errorContainer,
                    borderColor: colors.error,
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.onSurface }]}>
                Full Name
              </Text>
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
                placeholder="Alex Morgan"
                placeholderTextColor={colors.onSurfaceVariant}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errorMsg) setErrorMsg(null);
                }}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.onSurface }]}>
                Email Address
              </Text>
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
                placeholder="student@university.edu"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMsg) setErrorMsg(null);
                }}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.onSurface }]}>
                Password
              </Text>
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
                placeholder="At least 6 characters"
                placeholderTextColor={colors.onSurfaceVariant}
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMsg) setErrorMsg(null);
                }}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.onSurface }]}>
                Confirm Password
              </Text>
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
                placeholder="Repeat password"
                placeholderTextColor={colors.onSurfaceVariant}
                secureTextEntry
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorMsg) setErrorMsg(null);
                }}
              />
            </View>

            <Button
              title="Register"
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: spacing.md }}
            />

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.outlineVariant }]} />
              <Text style={[styles.dividerText, { color: colors.onSurfaceVariant }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.outlineVariant }]} />
            </View>

            <Button
              title="Sign up with GitHub"
              variant="outline"
              icon={<GitHubIcon size={18} color={colors.onSurface} />}
              onPress={handleGitHubRegister}
              loading={githubLoading}
              textStyle={{ color: colors.onSurface, fontWeight: '600' }}
            />

            <View style={styles.footerRow}>
              <Text style={{ color: colors.onSurfaceVariant }}>
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.footerRow, { marginTop: 12 }]}>
              <TouchableOpacity onPress={() => navigation.navigate('Landing')}>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>
                  Back to Home
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  centerContainer: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    padding: 24,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  linkText: {
    fontWeight: '600',
  },
});
