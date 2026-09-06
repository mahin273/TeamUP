import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberStatus, TaskStatus, Priority } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive workspace overview and metrics
   */
  async getWorkspaceOverview(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                avatarUrl: true,
                department: true,
                semester: true,
              },
            },
          },
        },
        members: {
          where: { status: MemberStatus.ACCEPTED },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    fullName: true,
                    avatarUrl: true,
                    department: true,
                    semester: true,
                    experienceLevel: true,
                  },
                },
              },
            },
          },
        },
        requiredSkills: {
          include: {
            skill: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    // Parallel fetch for workspace metrics
    const [
      taskCountsByStatus,
      highPriorityTaskCount,
      assignedToMeCount,
      recentTasks,
      fileCount,
      fileSizeAggregation,
      recentFiles,
      messageCount,
      lastMessage,
    ] = await Promise.all([
      // Task counts grouped by status
      this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { status: true },
      }),
      // High priority task count
      this.prisma.task.count({
        where: { projectId, priority: Priority.HIGH },
      }),
      // Tasks assigned to current user
      this.prisma.task.count({
        where: { projectId, assigneeId: userId },
      }),
      // 5 most recent tasks
      this.prisma.task.findMany({
        where: { projectId },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          assignee: {
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
      }),
      // Total file count
      this.prisma.projectFile.count({
        where: { projectId },
      }),
      // Total file storage size
      this.prisma.projectFile.aggregate({
        where: { projectId },
        _sum: { fileSize: true },
      }),
      // 5 most recent files
      this.prisma.projectFile.findMany({
        where: { projectId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: {
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
      }),
      // Total message count
      this.prisma.message.count({
        where: { projectId },
      }),
      // Latest message
      this.prisma.message.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
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
      }),
    ]);

    // Format task breakdown
    const taskBreakdown = {
      todo: 0,
      inProgress: 0,
      testing: 0,
      done: 0,
      total: 0,
    };

    for (const group of taskCountsByStatus) {
      if (group.status === TaskStatus.TODO) taskBreakdown.todo = group._count.status;
      if (group.status === TaskStatus.IN_PROGRESS) taskBreakdown.inProgress = group._count.status;
      if (group.status === TaskStatus.TESTING) taskBreakdown.testing = group._count.status;
      if (group.status === TaskStatus.DONE) taskBreakdown.done = group._count.status;
      taskBreakdown.total += group._count.status;
    }

    // Current user's membership
    const userMembership = project.members.find((m) => m.userId === userId);

    return {
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        domain: project.domain,
        semester: project.semester,
        status: project.status,
        maxMembers: project.maxMembers,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        creator: project.creator,
        requiredSkills: project.requiredSkills,
      },
      userRole: userMembership?.role ?? (project.creatorId === userId ? 'LEADER' : 'MEMBER'),
      members: project.members,
      metrics: {
        tasks: {
          ...taskBreakdown,
          highPriority: highPriorityTaskCount,
          assignedToMe: assignedToMeCount,
          completionPercentage:
            taskBreakdown.total > 0
              ? Math.round((taskBreakdown.done / taskBreakdown.total) * 100)
              : 0,
        },
        files: {
          totalCount: fileCount,
          totalSizeBytes: fileSizeAggregation._sum.fileSize ?? 0,
        },
        chat: {
          totalMessages: messageCount,
          lastActivity: lastMessage?.createdAt ?? null,
        },
      },
      recentTasks,
      recentFiles,
      lastMessage,
    };
  }
}
