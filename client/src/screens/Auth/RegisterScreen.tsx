import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export const RegisterScreen = ({ navigation }: any) => {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.primary, fontSize: typography.displayLarge.fontSize }]}>
          Register
        </Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          Create a new TeamUp account
        </Text>
        <Button
          title="Back to Login"
          onPress={() => navigation.navigate('Login')}
          variant="outline"
          style={{ marginTop: spacing.md }}
        />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    padding: 24,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
});
