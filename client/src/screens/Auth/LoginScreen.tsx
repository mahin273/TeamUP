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
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';

export const LoginScreen = ({ navigation }: any) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!email.trim()) {
      setErrorMsg('Email address is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setErrorMsg('Password is required.');
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || `Error (${err.code}): Failed to sign in.`);
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
              TeamUp
            </Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              Sign in to find teammates and manage projects
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
                  ⚠️ {errorMsg}
                </Text>
              </View>
            ) : null}

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
                placeholder="••••••••"
                placeholderTextColor={colors.onSurfaceVariant}
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMsg) setErrorMsg(null);
                }}
              />
            </View>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: spacing.md }}
            />

            <View style={styles.footerRow}>
              <Text style={{ color: colors.onSurfaceVariant }}>
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  Register
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
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  linkText: {
    fontWeight: '600',
  },
});
