import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Badge } from '../../components/Badge';
import { StateWrapper } from '../../components/StateWrapper';
import { useAuth } from '../../context/AuthContext';

export const ProfileScreen = () => {
  const { colors, typography, spacing, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <StateWrapper state="populated">
        <View style={{ padding: spacing.md }}>
          <Card style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize }]}>
                {user?.fullName || 'User Profile'}
              </Text>
              <Badge label="Active" variant="secondary" />
            </View>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              {user?.email || 'user@example.com'}
            </Text>

            <View style={{ marginVertical: spacing.md }}>
              <Text style={[{ color: colors.onSurface, fontWeight: '600', marginBottom: 8 }]}>
                Skills:
              </Text>
              <View style={styles.chipRow}>
                <Chip label="React Native" selected variant="primary" />
                <Chip label="TypeScript" selected variant="secondary" />
                <Chip label="Node.js" variant="tertiary" />
              </View>
            </View>

            <Button
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
              onPress={toggleTheme}
              variant="secondary"
              style={{ marginTop: spacing.sm }}
            />

            <Button
              title="Logout"
              onPress={logout}
              variant="outline"
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </View>
      </StateWrapper>
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
    marginBottom: 4,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
