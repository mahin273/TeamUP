import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: 'primary' | 'secondary' | 'tertiary';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  style,
  textStyle,
  variant = 'primary',
}) => {
  const { colors, typography, borderRadius, spacing } = useTheme();

  const getBackgroundColor = () => {
    if (selected) {
      switch (variant) {
        case 'secondary':
          return colors.secondaryContainer;
        case 'tertiary':
          return colors.tertiaryContainer;
        case 'primary':
        default:
          return colors.primaryContainer;
      }
    }
    return colors.surfaceVariant;
  };

  const getTextColor = () => {
    if (selected) {
      switch (variant) {
        case 'secondary':
          return colors.onSecondaryContainer;
        case 'tertiary':
          return colors.onTertiaryContainer;
        case 'primary':
        default:
          return colors.onPrimaryContainer;
      }
    }
    return colors.onSurfaceVariant;
  };

  const getBorderColor = () => {
    if (selected) {
      switch (variant) {
        case 'secondary':
          return colors.secondary;
        case 'tertiary':
          return colors.tertiary;
        case 'primary':
        default:
          return colors.primary;
      }
    }
    return colors.outlineVariant;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderRadius: borderRadius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs + 2,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: getTextColor(),
            fontSize: typography.bodyMedium.fontSize,
            fontWeight: selected ? '600' : '400',
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginRight: 6,
    marginBottom: 6,
  },
  text: {
    textAlign: 'center',
  },
});
