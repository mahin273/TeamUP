import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberStatus, TaskStatus, Priority } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verify user is a member of the project
   */
  private async verifyProjectMembership(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    if (!project) {
      throw new ForbiddenException(
        'Project not found or you are not a project member',
      );
    }

    if (project.creatorId === userId) {
      return;
    }

    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        status: MemberStatus.ACCEPTED,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a project member to view analytics',
      );
    }
  }

  /**
   * Get comprehensive project analytics dashboard
   */
  async getProjectAnalytics(projectId: string, userId: string) {
    await this.verifyProjectMembership(projectId, userId);

    // Run all queries in parallel for performance
    const [
      project,
      taskStats,
      memberStats,
      activityStats,
      evaluationStats,
      timelineStats,
    ] = await Promise.all([
      this.getProjectBasicInfo(projectId),
      this.getTaskStatistics(projectId),
      this.getMemberStatistics(projectId),
      this.getActivityStatistics(projectId),
      this.getEvaluationStatistics(projectId),
      this.getTimelineStatistics(projectId),
    ]);

    return {
      project,
      tasks: taskStats,
      members: memberStats,
      activity: activityStats,
      evaluations: evaluationStats,
      timeline: timelineStats,
    };
  }

  /**
   * Get basic project information
   */
  private async getProjectBasicInfo(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        description: true,
        domain: true,
        semester: true,
        status: true,
        maxMembers: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return project;
  }

  /**
   * Get task completion statistics
   */
  private async getTaskStatistics(projectId: string) {
    const [tasksByStatus, tasksByPriority, overdueTasks, recentCompletions] =
      await Promise.all([
        // Task breakdown by status
        this.prisma.task.groupBy({
          by: ['status'],
          where: { projectId },
          _count: { status: true },
        }),
        // Task breakdown by priority
        this.prisma.task.groupBy({
          by: ['priority'],
          where: { projectId },
          _count: { priority: true },
        }),
        // Overdue tasks
        this.prisma.task.count({
          where: {
            projectId,
            dueDate: { lt: new Date() },
            status: { not: TaskStatus.DONE },
          },
        }),
        // Recently completed tasks (last 7 days)
        this.prisma.task.count({
          where: {
            projectId,
            status: TaskStatus.DONE,
            updatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

    // Format status breakdown
    const statusBreakdown = {
      TODO: 0,
      IN_PROGRESS: 0,
      TESTING: 0,
      DONE: 0,
      total: 0,
    };

    tasksByStatus.forEach((group) => {
      statusBreakdown[group.status] = group._count.status;
      statusBreakdown.total += group._count.status;
    });

    // Format priority breakdown
    const priorityBreakdown = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };

    tasksByPriority.forEach((group) => {
      priorityBreakdown[group.priority] = group._count.priority;
    });

    // Calculate completion rate
    const completionRate =
      statusBreakdown.total > 0
        ? Math.round((statusBreakdown.DONE / statusBreakdown.total) * 100)
        : 0;

    return {
      byStatus: statusBreakdown,
      byPriority: priorityBreakdown,
      completionRate,
      overdue: overdueTasks,
      recentCompletions,
    };
  }

  /**
   * Get member activity and contribution statistics
   */
  private async getMemberStatistics(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId,
        status: MemberStatus.ACCEPTED,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Get contribution stats for each member
    const memberContributions = await Promise.all(
      members.map(async (member) => {
        const [tasksAssigned, tasksCompleted, messagesCount, filesUploaded] =
          await Promise.all([
            this.prisma.task.count({
              where: {
                projectId,
                assigneeId: member.userId,
              },
            }),
            this.prisma.task.count({
              where: {
                projectId,
                assigneeId: member.userId,
                status: TaskStatus.DONE,
              },
            }),
            this.prisma.message.count({
              where: {
                projectId,
                senderId: member.userId,
              },
            }),
            this.prisma.projectFile.count({
              where: {
                projectId,
                uploaderId: member.userId,
              },
            }),
          ]);

        const taskCompletionRate =
          tasksAssigned > 0
            ? Math.round((tasksCompleted / tasksAssigned) * 100)
            : 0;

        return {
          user: member.user,
          role: member.role,
          contributions: {
            tasksAssigned,
            tasksCompleted,
            taskCompletionRate,
            messages: messagesCount,
            filesUploaded,
          },
        };
      }),
    );

    return {
      totalMembers: members.length,
      members: memberContributions,
    };
  }

  /**
   * Get activity statistics (messages, files, task updates)
   */
  private async getActivityStatistics(projectId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalMessages,
      messagesLast7Days,
      totalFiles,
      filesLast7Days,
      taskUpdatesLast7Days,
      lastActivity,
    ] = await Promise.all([
      this.prisma.message.count({ where: { projectId } }),
      this.prisma.message.count({
        where: { projectId, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.projectFile.count({ where: { projectId } }),
      this.prisma.projectFile.count({
        where: { projectId, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.task.count({
        where: { projectId, updatedAt: { gte: sevenDaysAgo } },
      }),
      this.getLastActivityTimestamp(projectId),
    ]);

    // Get daily activity for the last 7 days
    const dailyActivity = await this.getDailyActivityChart(projectId, 7);

    return {
      messages: {
        total: totalMessages,
        last7Days: messagesLast7Days,
      },
      files: {
        total: totalFiles,
        last7Days: filesLast7Days,
      },
      taskUpdates: {
        last7Days: taskUpdatesLast7Days,
      },
      lastActivity,
      dailyActivity,
    };
  }

  /**
   * Get last activity timestamp across all project activities
   */
  private async getLastActivityTimestamp(projectId: string) {
    const [lastMessage, lastTask, lastFile] = await Promise.all([
      this.prisma.message.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.task.findFirst({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      this.prisma.projectFile.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const timestamps: Date[] = [
      lastMessage?.createdAt,
      lastTask?.updatedAt,
      lastFile?.createdAt,
    ].filter((d): d is Date => Boolean(d));

    return timestamps.length > 0
      ? new Date(Math.max(...timestamps.map((d) => d.getTime())))
      : null;
  }

  /**
   * Get daily activity chart data
   */
  private async getDailyActivityChart(projectId: string, days: number) {
    const activityData: Array<{
      date: string;
      messages: number;
      tasks: number;
      files: number;
      total: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [messages, tasks, files] = await Promise.all([
        this.prisma.message.count({
          where: {
            projectId,
            createdAt: { gte: date, lt: nextDate },
          },
        }),
        this.prisma.task.count({
          where: {
            projectId,
            updatedAt: { gte: date, lt: nextDate },
          },
        }),
        this.prisma.projectFile.count({
          where: {
            projectId,
            createdAt: { gte: date, lt: nextDate },
          },
        }),
      ]);

      activityData.push({
        date: date.toISOString().split('T')[0],
        messages,
        tasks,
        files,
        total: messages + tasks + files,
      });
    }

    return activityData;
  }

  /**
   * Get evaluation statistics
   */
  private async getEvaluationStatistics(projectId: string) {
    const evaluations = await this.prisma.peerEvaluation.findMany({
      where: { projectId },
      select: { score: true },
    });

    if (evaluations.length === 0) {
      return {
        totalEvaluations: 0,
        averageScore: null,
        scoreDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
    const averageScore = totalScore / evaluations.length;

    const scoreDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    evaluations.forEach((e) => {
      scoreDistribution[e.score as 1 | 2 | 3 | 4 | 5]++;
    });

    return {
      totalEvaluations: evaluations.length,
      averageScore: parseFloat(averageScore.toFixed(2)),
      scoreDistribution,
    };
  }

  /**
   * Get timeline and milestone statistics
   */
  private async getTimelineStatistics(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { createdAt: true },
    });

    const now = new Date();
    const projectAge = project?.createdAt
      ? Math.floor(
          (now.getTime() - project.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;

    const [upcomingDeadlines, completedMilestones, totalEvents] =
      await Promise.all([
        this.prisma.calendarEvent.count({
          where: {
            projectId,
            startDate: { gte: now },
            eventType: 'DEADLINE',
          },
        }),
        this.prisma.calendarEvent.count({
          where: {
            projectId,
            startDate: { lt: now },
            eventType: 'MILESTONE',
          },
        }),
        this.prisma.calendarEvent.count({
          where: { projectId },
        }),
      ]);

    // Get upcoming events (next 7 days)
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingEvents = await this.prisma.calendarEvent.findMany({
      where: {
        projectId,
        startDate: { gte: now, lte: sevenDaysLater },
      },
      orderBy: { startDate: 'asc' },
      take: 5,
    });

    return {
      projectAge: `${projectAge} days`,
      upcomingDeadlines,
      completedMilestones,
      totalEvents,
      upcomingEvents,
    };
  }

  /**
   * Get task velocity (tasks completed per week)
   */
  async getTaskVelocity(projectId: string, userId: string, weeks: number = 4) {
    await this.verifyProjectMembership(projectId, userId);

    const velocityData: Array<{
      week: string;
      weekStart: string;
      weekEnd: string;
      tasksCompleted: number;
    }> = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const completedTasks = await this.prisma.task.count({
        where: {
          projectId,
          status: TaskStatus.DONE,
          updatedAt: { gte: weekStart, lt: weekEnd },
        },
      });

      velocityData.push({
        week: `Week ${weeks - i}`,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        tasksCompleted: completedTasks,
      });
    }

    const averageVelocity =
      velocityData.reduce((sum, w) => sum + w.tasksCompleted, 0) / weeks;

    return {
      weeks: velocityData,
      averageVelocity: parseFloat(averageVelocity.toFixed(2)),
    };
  }

  /**
   * Get project health score (0-100)
   */
  async getProjectHealth(projectId: string, userId: string) {
    await this.verifyProjectMembership(projectId, userId);

    const [taskStats, activityStats, memberCount, evaluationStats] =
      await Promise.all([
        this.getTaskStatistics(projectId),
        this.getActivityStatistics(projectId),
        this.prisma.projectMember.count({
          where: { projectId, status: MemberStatus.ACCEPTED },
        }),
        this.getEvaluationStatistics(projectId),
      ]);

    // Calculate health score based on multiple factors
    let healthScore = 0;

    // Task completion (40 points)
    healthScore += taskStats.completionRate * 0.4;

    // Recent activity (30 points)
    const activityScore =
      activityStats.messages.last7Days > 0 ||
      activityStats.files.last7Days > 0 ||
      activityStats.taskUpdates.last7Days > 0
        ? 30
        : 0;
    healthScore += activityScore;

    // Team size (10 points)
    const teamScore = memberCount >= 2 ? 10 : memberCount * 5;
    healthScore += teamScore;

    // Evaluation score (20 points)
    const evalScore = evaluationStats.averageScore
      ? (evaluationStats.averageScore / 5) * 20
      : 0;
    healthScore += evalScore;

    // Determine health status
    let status: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
    if (healthScore >= 80) status = 'Excellent';
    else if (healthScore >= 60) status = 'Good';
    else if (healthScore >= 40) status = 'Fair';
    else status = 'Needs Attention';

    return {
      healthScore: Math.round(healthScore),
      status,
      factors: {
        taskCompletion: taskStats.completionRate,
        recentActivity: activityScore > 0,
        teamSize: memberCount,
        averageEvaluation: evaluationStats.averageScore,
      },
    };
  }
}
