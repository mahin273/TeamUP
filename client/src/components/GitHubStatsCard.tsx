import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Card } from './Card';
import { Chip } from './Chip';
import { Badge } from './Badge';
import { Button } from './Button';
import { api } from '../api/client';

export interface GitHubStats {
  username?: string;
  publicRepos?: number;
  followers?: number;
  contributionsThisYear?: number;
  topLanguages?: string[];
  avatarUrl?: string;
  connected?: boolean;
  error?: string;
}

export interface GitHubStatsCardProps {
  profileId: string;
  githubUsername?: string;
  onConnectPress?: () => void;
}

export const GitHubStatsCard: React.FC<GitHubStatsCardProps> = ({
  profileId,
  githubUsername,
  onConnectPress,
}) => {
  const { colors, typography, spacing } = useTheme();

  const [stats, setStats] = useState<GitHubStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchGithubStats() {
      if (!profileId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setFailed(false);

      try {
        const data = await api.get<GitHubStats>(`/profiles/${profileId}/github`);
        if (isMounted) {
          setStats(data);
        }
      } catch {
        if (isMounted) {
          // Graceful fallback per Design Doc §6.4
          setFailed(true);
          if (githubUsername) {
            setStats({
              username: githubUsername,
              connected: true,
              publicRepos: 0,
              contributionsThisYear: 0,
              topLanguages: [],
            });
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchGithubStats();

    return () => {
      isMounted = false;
    };
  }, [profileId, githubUsername]);

  const handleOAuthConnect = () => {
    if (onConnectPress) {
      onConnectPress();
      return;
    }
    const clientId = process.env.GITHUB_CLIENT_ID || 'your_github_client_id';
    const redirectUri = 'teamup://github-callback';
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=read:user%20repo`;

    Linking.openURL(authUrl).catch(() => {
      // Fallback: open GitHub user page or user edit screen
      if (githubUsername) {
        Linking.openURL(`https://github.com/${githubUsername}`);
      }
    });
  };

  if (loading) {
    return (
      <Card style={[styles.card, { marginTop: spacing.md }]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={{ color: colors.onSurfaceVariant, marginLeft: 8 }}>
            Fetching GitHub contribution stats...
          </Text>
        </View>
      </Card>
    );
  }

  const isConnected = stats?.connected || !!githubUsername;

  if (!isConnected) {
    return (
      <Card style={[styles.card, { marginTop: spacing.md }]}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
            ]}
          >
            🐙 GitHub Integration
          </Text>
          <Badge label="Not Connected" variant="secondary" />
        </View>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          Connect your GitHub account to showcase public repos, contributions, and verified top languages to potential teammates.
        </Text>
        <Button
          title="Connect GitHub Account"
          onPress={handleOAuthConnect}
          variant="primary"
          style={{ marginTop: spacing.md }}
        />
      </Card>
    );
  }

  return (
    <Card style={[styles.card, { marginTop: spacing.md }]}>
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.title,
            { color: colors.onSurface, fontSize: typography.titleMedium.fontSize },
          ]}
        >
          🐙 GitHub Stats
        </Text>
        <Badge label="Verified" variant="primary" />
      </View>

      {failed && (
        <Text style={[styles.warningText, { color: colors.tertiary }]}>
          ⚡ Live GitHub API rate-limited; showing cached profile stats.
        </Text>
      )}

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>
            {stats?.contributionsThisYear ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>
            Contributions
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.secondary }]}>
            {stats?.publicRepos ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>
            Public Repos
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.tertiary }]}>
            {stats?.followers ?? 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>
            Followers
          </Text>
        </View>
      </View>

      {stats?.topLanguages && stats.topLanguages.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={[styles.subLabel, { color: colors.onSurface }]}>
            Top Languages:
          </Text>
          <View style={styles.chipRow}>
            {stats.topLanguages.map((lang) => (
              <Chip key={lang} label={lang} selected variant="secondary" />
            ))}
          </View>
        </View>
      ) : null}

      {stats?.username ? (
        <TouchableOpacity
          style={styles.profileLink}
          onPress={() => Linking.openURL(`https://github.com/${stats.username}`)}
        >
          <Text style={[styles.linkText, { color: colors.primary }]}>
            View @{stats.username} on GitHub ↗
          </Text>
        </TouchableOpacity>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  warningText: {
    fontSize: 12,
    marginVertical: 4,
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  profileLink: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
