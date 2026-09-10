import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Card } from './Card';

export const AILoadingCard: React.FC = () => {
  const { colors, typography, spacing } = useTheme();
  const [pulseAnim] = useState(() => new Animated.Value(0.3));
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    'Connecting to LLM brainstorming engine...',
    'Analyzing target domain & tech stack requirements...',
    'Synthesizing unique project features and architecture...',
    'Structuring team size, duration & difficulty rating...',
  ];

  useEffect(() => {
    // Pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Step message rotation
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [pulseAnim, steps.length]);

  return (
    <Card style={[styles.card, { marginTop: spacing.md }]}>
      <View style={styles.headerRow}>
        <View style={[styles.badgeSkeleton, { backgroundColor: colors.primaryContainer }]} />
        <Text style={[styles.aiLabel, { color: colors.primary }]}>
          🪄 AI Brainstorming in Progress...
        </Text>
      </View>

      <Text
        style={[
          styles.stepText,
          { color: colors.onSurface, fontSize: typography.bodyMedium.fontSize },
        ]}
      >
        {steps[stepIndex]}
      </Text>

      {/* Idea card geometry skeleton shapes */}
      <Animated.View style={{ opacity: pulseAnim }}>
        <View
          style={[
            styles.titleSkeleton,
            { backgroundColor: colors.surfaceVariant, marginTop: spacing.sm },
          ]}
        />
        <View
          style={[
            styles.descSkeleton,
            { backgroundColor: colors.surfaceVariant, marginTop: spacing.xs },
          ]}
        />
        <View
          style={[
            styles.descSkeletonShort,
            { backgroundColor: colors.surfaceVariant, marginTop: spacing.xs },
          ]}
        />

        {/* Tech Stack Chip Skeletons */}
        <View style={[styles.chipSkeletonRow, { marginTop: spacing.md }]}>
          <View
            style={[
              styles.chipSkeleton,
              { backgroundColor: colors.primaryContainer },
            ]}
          />
          <View
            style={[
              styles.chipSkeleton,
              { backgroundColor: colors.secondaryContainer },
            ]}
          />
          <View
            style={[
              styles.chipSkeleton,
              { backgroundColor: colors.surfaceVariant },
            ]}
          />
        </View>
      </Animated.View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeSkeleton: {
    width: 60,
    height: 24,
    borderRadius: 12,
  },
  aiLabel: {
    marginLeft: 10,
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    marginTop: 10,
    fontStyle: 'italic',
  },
  titleSkeleton: {
    height: 24,
    borderRadius: 6,
    width: '80%',
  },
  descSkeleton: {
    height: 14,
    borderRadius: 4,
    width: '100%',
  },
  descSkeletonShort: {
    height: 14,
    borderRadius: 4,
    width: '60%',
  },
  chipSkeletonRow: {
    flexDirection: 'row',
  },
  chipSkeleton: {
    width: 80,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
});
