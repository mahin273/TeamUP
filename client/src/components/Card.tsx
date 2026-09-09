import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Animated,
  ViewStyle,
  View,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'surface' | 'surfaceVariant' | 'outline';
  enableHaptics?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  variant = 'surface',
  enableHaptics = false,
}) => {
  const { colors, borderRadius, spacing } = useTheme();
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      speed: 20,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 300,
      damping: 15,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (!onPress) return;
    if (enableHaptics && Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore haptics
      }
    }
    onPress();
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'surfaceVariant':
        return colors.surfaceVariant;
      case 'outline':
        return 'transparent';
      case 'surface':
      default:
        return colors.surface;
    }
  };

  const cardContent = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: borderRadius.bento,
          borderColor: colors.outlineVariant,
          borderWidth: 1,
          padding: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) {
    return cardContent;
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        {cardContent}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});
