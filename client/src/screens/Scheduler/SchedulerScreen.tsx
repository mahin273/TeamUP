import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';

export const SchedulerScreen = () => {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.onSurface, fontSize: typography.headlineMedium.fontSize }]}>
            Scheduler & Calendar
          </Text>
          <Badge label="Features 8 & 9" variant="primary" />
        </View>
        <Text style={{ color: colors.onSurfaceVariant, marginTop: spacing.xs }}>
          Propose meeting slots, vote, and shared calendar view.
        </Text>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
  },
});
