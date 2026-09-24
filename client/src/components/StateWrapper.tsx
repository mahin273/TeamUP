import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';
import { Card } from './Card';

export type ScreenState = 'loading' | 'populated' | 'empty' | 'error';

export interface StateWrapperProps {
  state: ScreenState;
  children?: React.ReactNode;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  errorMessage?: string;
  errorCode?: string;
  onRetry?: () => void;
  retryActionLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const StateWrapper: React.FC<StateWrapperProps> = ({
  state,
  children,
  emptyTitle = 'No data found',
  emptySubtitle = 'There is nothing to display right now.',
  emptyActionLabel,
  onEmptyAction,
  errorMessage = 'An error occurred while loading data.',
  errorCode,
  onRetry,
  retryActionLabel = 'Try Again',
  style,
}) => {
  const { colors, typography, spacing } = useTheme();
  const [shimmerAnim] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    if (state === 'loading') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 0.9,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [state, shimmerAnim]);

  if (state === 'populated') {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }

  if (state === 'loading') {
    return (
      <View style={[styles.container, style]}>
        {[1, 2, 3].map((key) => (
          <Card key={key} style={styles.skeletonCard}>
            <Animated.View
              style={[
                styles.skeletonLine,
                {
                  backgroundColor: colors.surfaceVariant,
                  opacity: shimmerAnim,
                  width: '60%',
                  height: 20,
                  marginBottom: spacing.sm,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonLine,
                {
                  backgroundColor: colors.surfaceVariant,
                  opacity: shimmerAnim,
                  width: '90%',
                  height: 14,
                  marginBottom: spacing.xs,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonLine,
                {
                  backgroundColor: colors.surfaceVariant,
                  opacity: shimmerAnim,
                  width: '40%',
                  height: 14,
                },
              ]}
            />
          </Card>
        ))}
      </View>
    );
  }

  if (state === 'empty') {
    return (
      <View
        accessibilityRole="summary"
        style={[styles.centeredContainer, style]}
      >
        <View
          style={[
            styles.iconPlaceholder,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.primary }}>✦</Text>
        </View>
        <Text
          style={[
            styles.title,
            {
              color: colors.onSurface,
              fontSize: typography.titleMedium.fontSize,
              fontWeight: typography.titleMedium.fontWeight,
            },
          ]}
        >
          {emptyTitle}
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.onSurfaceVariant,
              fontSize: typography.bodyMedium.fontSize,
            },
          ]}
        >
          {emptySubtitle}
        </Text>
        {emptyActionLabel && onEmptyAction ? (
          <Button
            title={emptyActionLabel}
            onPress={onEmptyAction}
            style={{
              marginTop: spacing.md,
              alignSelf: 'center',
              minWidth: 160,
              maxWidth: 240,
            }}
          />
        ) : null}
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View
        accessibilityRole="alert"
        style={[styles.centeredContainer, style]}
      >
        <View
          style={[
            styles.iconPlaceholder,
            { backgroundColor: colors.errorContainer },
          ]}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.onErrorContainer }}>!</Text>
        </View>
        <Text
          style={[
            styles.title,
            {
              color: colors.error,
              fontSize: typography.titleMedium.fontSize,
              fontWeight: typography.titleMedium.fontWeight,
            },
          ]}
        >
          {errorCode ? `Error: ${errorCode}` : "We couldn't load this content"}
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.onSurfaceVariant,
              fontSize: typography.bodyMedium.fontSize,
            },
          ]}
        >
          {errorMessage}
        </Text>
        {onRetry && (
          <Button
            title={retryActionLabel}
            onPress={onRetry}
            variant="outline"
            style={{
              marginTop: spacing.md,
              alignSelf: 'center',
              minWidth: 160,
              maxWidth: 240,
            }}
          />
        )}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  skeletonCard: {
    marginBottom: 16,
  },
  skeletonLine: {
    borderRadius: 4,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
});
