import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/AppHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, typography, spacing, borderRadius, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of TeamUp?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Settings"
        subtitle="Preferences & Account"
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          } else if (navigation?.navigate) {
            navigation.navigate('MainApp', { screen: 'More' });
          }
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.screenPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.textMuted, fontSize: typography.label.fontSize }]}>
          APPEARANCE
        </Text>
        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Text style={{ fontSize: 20, marginRight: spacing.md }}>🌙</Text>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.body.fontSize }]}>
                  Dark Mode
                </Text>
                <Text style={[styles.settingSub, { color: colors.textMuted, fontSize: typography.bodySmall.fontSize }]}>
                  {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.textMuted, fontSize: typography.label.fontSize, marginTop: spacing.lg }]}>
          ACCOUNT
        </Text>
        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Text style={{ fontSize: 20, marginRight: spacing.md }}>👤</Text>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.body.fontSize }]}>
                  {user?.fullName || 'Student Member'}
                </Text>
                <Text style={[styles.settingSub, { color: colors.textMuted, fontSize: typography.bodySmall.fontSize }]}>
                  {user?.email || 'Logged in user'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.actionRow}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={[styles.actionText, { color: colors.primary, fontSize: typography.body.fontSize }]}>
              Edit Profile Details →
            </Text>
          </TouchableOpacity>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.textMuted, fontSize: typography.label.fontSize, marginTop: spacing.lg }]}>
          ABOUT
        </Text>
        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Text style={{ fontSize: 20, marginRight: spacing.md }}>🚀</Text>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text, fontSize: typography.body.fontSize }]}>
                  TeamUp Mobile
                </Text>
                <Text style={[styles.settingSub, { color: colors.textMuted, fontSize: typography.bodySmall.fontSize }]}>
                  Version 2.0.0 (Redesign)
                </Text>
              </View>
            </View>
          </View>
        </Card>

        <Button
          title="Sign Out"
          variant="outline"
          onPress={handleLogout}
          style={{
            marginTop: spacing.xl,
            borderColor: colors.accent,
            minWidth: 200,
            maxWidth: 280,
            alignSelf: 'center',
          }}
          textStyle={{ color: colors.accent }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  card: {
    padding: 16,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontWeight: '600',
  },
  settingSub: {
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  actionRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '600',
  },
});
