import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { WorkspaceHomeScreen } from '../screens/Workspace/WorkspaceHomeScreen';
import { KanbanScreen } from '../screens/Kanban/KanbanScreen';
import { ChatScreen } from '../screens/Chat/ChatScreen';
import { MemberListScreen } from '../screens/Workspace/MemberListScreen';
import { FilesScreen } from '../screens/Files/FilesScreen';
import { EvaluationScreen } from '../screens/Evaluation/EvaluationScreen';
import { AnalyticsDashboardScreen } from '../screens/Analytics/AnalyticsDashboardScreen';

export type WorkspaceStackParamList = {
  WorkspaceHome: { projectId: string; projectTitle?: string };
  Kanban: { projectId: string; projectTitle?: string };
  Chat: { projectId: string; projectTitle?: string };
  Members: { projectId: string; projectTitle?: string };
  Files: { projectId: string; projectTitle?: string };
  Evaluation: { projectId: string; projectTitle?: string };
  Analytics: { projectId: string; projectTitle?: string };
};

const Stack = createNativeStackNavigator<WorkspaceStackParamList>();

export interface WorkspaceNavigatorProps {
  route?: {
    params?: {
      projectId: string;
      projectTitle?: string;
    };
  };
}

export const WorkspaceNavigator: React.FC<WorkspaceNavigatorProps> = ({ route }) => {
  const { colors } = useTheme();
  const projectId = route?.params?.projectId || 'default-project';
  const projectTitle = route?.params?.projectTitle || 'Project Workspace';

  return (
    <Stack.Navigator
      initialRouteName="WorkspaceHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.onSurface,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="WorkspaceHome"
        component={WorkspaceHomeScreen}
        initialParams={{ projectId, projectTitle }}
        options={{ title: 'Workspace' }}
      />
      <Stack.Screen
        name="Kanban"
        component={KanbanScreen}
        initialParams={{ projectId, projectTitle }}
        options={{ title: 'Kanban Board' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        initialParams={{ projectId, projectTitle }}
        options={{ title: 'Team Chat' }}
      />
      <Stack.Screen
        name="Members"
        component={MemberListScreen}
        initialParams={{ projectId, projectTitle }}
        options={{ title: 'Team Members' }}
      />
      <Stack.Screen
        name="Files"
        component={FilesScreen}
        initialParams={{ projectId, projectTitle }}
        options={{ title: 'Files' }}
      />
      <Stack.Screen
        name="Evaluation"
        component={EvaluationScreen}
        initialParams={{ projectId, projectTitle }}
        options={{ title: 'Peer Evaluation' }}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsDashboardScreen}
        initialParams={{ projectId, projectTitle }}
        options={{ title: 'Analytics' }}
      />
    </Stack.Navigator>
  );
};
