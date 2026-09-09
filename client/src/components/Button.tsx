import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  enableHaptics?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  enableHaptics = true,
}) => {
  const { colors, typography, borderRadius, spacing } = useTheme();
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      speed: 20,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 300,
      damping: 15,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    if (enableHaptics && Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore haptic failures on unsupported devices
      }
    }
    onPress();
  };

  const getBackgroundColor = () => {
    if (disabled) return colors.surfaceVariant;
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.secondaryContainer;
      case 'tertiary':
        return colors.tertiaryContainer;
      case 'outline':
        return 'transparent';
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.onSurfaceVariant;
    switch (variant) {
      case 'primary':
        return colors.onPrimary;
      case 'secondary':
        return colors.onSecondaryContainer;
      case 'tertiary':
        return colors.onTertiaryContainer;
      case 'outline':
        return colors.primary;
      default:
        return colors.onPrimary;
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        style={[
          styles.container,
          {
            backgroundColor: getBackgroundColor(),
            borderRadius: borderRadius.bento,
            borderColor: variant === 'outline' ? colors.outlineVariant : 'transparent',
            borderWidth: variant === 'outline' ? 1 : 0,
            paddingVertical: spacing.sm + 4,
            paddingHorizontal: spacing.lg,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={getTextColor()} size="small" />
        ) : (
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: typography.bodyLarge.fontSize,
                fontWeight: typography.titleMedium.fontWeight,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    textAlign: 'center',
  },
});
