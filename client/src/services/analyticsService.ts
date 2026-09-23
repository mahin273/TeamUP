import { api } from '../api/client';

export interface TaskCompletionDataPoint {
  date: string;       // ISO date string e.g. "2026-09-15"
  completed: number;
  created: number;
}

export interface MemberContribution {
  memberId: string;
  memberName: string;
  avatarInitial: string;
  tasksCompleted: number;
  tasksAssigned: number;
  completionRate: number; // 0–100
}

export interface ActivityDataPoint {
  date: string;
  commits?: number;
  messages: number;
  tasksUpdated: number;
}

export interface ProjectAnalytics {
  projectId: string;
  generatedAt: string;

  // Summary totals
  totalTasks: number;
  completedTasks: number;
  overallCompletionRate: number; // 0–100

  // Task status breakdown
  tasksByStatus: {
    TODO: number;
    IN_PROGRESS: number;
    TESTING: number;
    DONE: number;
  };

  // Task priority breakdown
  tasksByPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
  };

  // Time-series data (last 14 days by default)
  taskCompletionOverTime: TaskCompletionDataPoint[];

  // Per-member contribution
  memberContributions: MemberContribution[];

  // Team activity over time
  activityOverTime: ActivityDataPoint[];

  // File & chat stats
  totalFiles: number;
  totalMessages: number;
}

export const analyticsService = {
  /**
   * Get analytics aggregation for a project.
   * GET /projects/:id/analytics
   */
  getProjectAnalytics: async (projectId: string): Promise<ProjectAnalytics> => {
    return api.get<ProjectAnalytics>(`/projects/${projectId}/analytics`);
  },
};
