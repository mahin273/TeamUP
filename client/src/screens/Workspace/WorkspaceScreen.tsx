import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { KanbanScreen } from '../Kanban/KanbanScreen';
import { ChatScreen } from '../Chat/ChatScreen';
import { FilesScreen } from '../Files/FilesScreen';

interface WorkspaceScreenProps {
  projectId: string;
  currentUserId: string;
}

type TabKey = 'kanban' | 'chat' | 'files';

export const WorkspaceScreen: React.FC<WorkspaceScreenProps> = ({ projectId, currentUserId }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('kanban');

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'kanban', label: 'Kanban', icon: '📋' },
    { key: 'chat', label: 'Chat', icon: '💬' },
    { key: 'files', label: 'Files', icon: '📁' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'kanban':
        return <KanbanScreen projectId={projectId} />;
      case 'chat':
        return <ChatScreen projectId={projectId} currentUserId={currentUserId} />;
      case 'files':
        return <FilesScreen projectId={projectId} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Navigation */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.outlineVariant,
            borderBottomWidth: 1,
            paddingTop: spacing.xl,
            paddingBottom: spacing.sm,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View style={styles.tabContainer}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                {
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: borderRadius.pill,
                  backgroundColor:
                    activeTab === tab.key ? colors.primaryContainer : 'transparent',
                  flex: 1,
                  marginHorizontal: spacing.xs / 2,
                },
              ]}
            >
              <Text style={{ fontSize: 20, textAlign: 'center' }}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === tab.key ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                    fontSize: typography.labelMedium.fontSize,
                    fontWeight: activeTab === tab.key ? '600' : '400',
                    marginTop: spacing.xs / 2,
                    textAlign: 'center',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {},
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tab: {
    alignItems: 'center',
  },
  tabText: {},
  content: {
    flex: 1,
  },
});
