import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberStatus, TaskStatus, Priority } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

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
      if (group.status === TaskStatus.TODO)
        taskBreakdown.todo = group._count.status;
      if (group.status === TaskStatus.IN_PROGRESS)
        taskBreakdown.inProgress = group._count.status;
      if (group.status === TaskStatus.TESTING)
        taskBreakdown.testing = group._count.status;
      if (group.status === TaskStatus.DONE)
        taskBreakdown.done = group._count.status;
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
      userRole:
        userMembership?.role ??
        (project.creatorId === userId ? 'LEADER' : 'MEMBER'),
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

  /**
   * Verify user is a member of the project
   */
  private async verifyProjectMembership(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        status: MemberStatus.ACCEPTED,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a project member to perform this action',
      );
    }
  }

  /**
   * Get all tasks for a project (Kanban board data)
   */
  async getProjectTasks(projectId: string, userId: string) {
    await this.verifyProjectMembership(projectId, userId);

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
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
    });

    return tasks;
  }

  /**
   * Create a new task
   */
  async createTask(
    projectId: string,
    userId: string,
    dto: CreateTaskDto,
  ) {
    await this.verifyProjectMembership(projectId, userId);

    // Verify assignee is also a project member if provided
    if (dto.assigneeId) {
      const assigneeMembership = await this.prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: dto.assigneeId,
          status: MemberStatus.ACCEPTED,
        },
      });

      if (!assigneeMembership) {
        throw new BadRequestException(
          'Assignee must be a member of the project',
        );
      }
    }

    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority ?? Priority.MEDIUM,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
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
    });

    if (dto.assigneeId) {
      await this.prisma.notification.create({
        data: {
          userId: dto.assigneeId,
          title: 'Task Assignment',
          body: `You have been assigned to task: ${task.title}`,
          type: 'TASK_ASSIGNED',
          data: { taskId: task.id, projectId },
        },
      });
    }

    return task;
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, userId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID '${taskId}' not found`);
    }

    await this.verifyProjectMembership(task.projectId, userId);

    // Verify assignee is a project member if being updated
    if (dto.assigneeId) {
      const assigneeMembership = await this.prisma.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: dto.assigneeId,
          status: MemberStatus.ACCEPTED,
        },
      });

      if (!assigneeMembership) {
        throw new BadRequestException(
          'Assignee must be a member of the project',
        );
      }
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
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
    });

    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      await this.prisma.notification.create({
        data: {
          userId: dto.assigneeId,
          title: 'Task Assignment',
          body: `You have been assigned to task: ${updatedTask.title}`,
          type: 'TASK_ASSIGNED',
          data: { taskId: updatedTask.id, projectId: task.projectId },
        },
      });
    }

    return updatedTask;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID '${taskId}' not found`);
    }

    await this.verifyProjectMembership(task.projectId, userId);

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return { message: 'Task deleted successfully' };
  }
}
