import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberStatus, ProjectStatus } from '@prisma/client';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Injectable()
export class EvaluationsService {
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
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
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
        'You must be a project member to perform evaluations',
      );
    }
  }

  /**
   * Create a peer evaluation
   */
  async createEvaluation(
    projectId: string,
    evaluatorId: string,
    dto: CreateEvaluationDto,
  ) {
    // Verify evaluator is a member
    await this.verifyProjectMembership(projectId, evaluatorId);

    // Prevent self-evaluation
    if (evaluatorId === dto.evaluateeId) {
      throw new BadRequestException('You cannot evaluate yourself');
    }

    // Verify evaluatee is a member
    await this.verifyProjectMembership(projectId, dto.evaluateeId);

    if (
      dto.score === undefined &&
      (dto.contributionScore === undefined ||
        dto.communicationScore === undefined ||
        dto.teamworkScore === undefined)
    ) {
      throw new BadRequestException(
        'All three evaluation scores (contributionScore, communicationScore, teamworkScore) or score are required',
      );
    }

    const effectiveScore =
      dto.score ??
      (dto.contributionScore !== undefined &&
      dto.communicationScore !== undefined &&
      dto.teamworkScore !== undefined
        ? Number(
            (
              (dto.contributionScore +
                dto.communicationScore +
                dto.teamworkScore) /
              3
            ).toFixed(2),
          )
        : 5);

    const feedback = dto.comment ?? dto.feedback ?? null;

    // Check if evaluation already exists
    const existingEvaluation = await this.prisma.peerEvaluation.findUnique({
      where: {
        projectId_evaluatorId_evaluateeId: {
          projectId,
          evaluatorId,
          evaluateeId: dto.evaluateeId,
        },
      },
    });

    if (existingEvaluation) {
      throw new ConflictException(
        'You have already evaluated this team member for this project',
      );
    }

    // Create evaluation
    const evaluation = await this.prisma.peerEvaluation.create({
      data: {
        projectId,
        evaluatorId,
        evaluateeId: dto.evaluateeId,
        score: effectiveScore,
        feedback,
      },
      include: {
        evaluator: {
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
        evaluatee: {
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

    return evaluation;
  }

  /**
   * Get all evaluations for a project
   */
  async getProjectEvaluations(projectId: string, userId: string) {
    await this.verifyProjectMembership(projectId, userId);

    const evaluations = await this.prisma.peerEvaluation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        evaluator: {
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
        evaluatee: {
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

    return evaluations;
  }

  /**
   * Get evaluations received by a specific user in a project
   */
  async getUserEvaluations(
    projectId: string,
    evaluateeId: string,
    requesterId: string,
  ) {
    await this.verifyProjectMembership(projectId, requesterId);

    // Only the evaluatee or project leader can view individual evaluations
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: requesterId,
        status: MemberStatus.ACCEPTED,
      },
    });

    if (requesterId !== evaluateeId && membership?.role !== 'LEADER') {
      throw new ForbiddenException(
        'You can only view your own evaluations or you must be a project leader',
      );
    }

    const evaluations = await this.prisma.peerEvaluation.findMany({
      where: {
        projectId,
        evaluateeId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        evaluator: {
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

    return evaluations;
  }

  /**
   * Get evaluation statistics for a user in a project
   */
  async getUserEvaluationStats(
    projectId: string,
    evaluateeId: string,
    requesterId: string,
  ) {
    await this.verifyProjectMembership(projectId, requesterId);

    const evaluations = await this.prisma.peerEvaluation.findMany({
      where: {
        projectId,
        evaluateeId,
      },
      select: {
        score: true,
      },
    });

    if (evaluations.length === 0) {
      return {
        evaluateeId,
        totalEvaluations: 0,
        averageScore: null,
        scores: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      };
    }

    // Calculate statistics
    const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
    const averageScore = totalScore / evaluations.length;

    // Count scores
    const scoreDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    evaluations.forEach((e) => {
      scoreDistribution[e.score as 1 | 2 | 3 | 4 | 5]++;
    });

    return {
      evaluateeId,
      totalEvaluations: evaluations.length,
      averageScore: parseFloat(averageScore.toFixed(2)),
      scores: scoreDistribution,
    };
  }

  /**
   * Get evaluation summary for all members in a project
   */
  async getProjectEvaluationSummary(projectId: string, userId: string) {
    await this.verifyProjectMembership(projectId, userId);

    // Get all accepted members
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

    // Get evaluation stats for each member
    const summaries = await Promise.all(
      members.map(async (member) => {
        const stats = await this.getUserEvaluationStats(
          projectId,
          member.userId,
          userId,
        );

        return {
          user: member.user,
          role: member.role,
          stats,
        };
      }),
    );

    return summaries;
  }

  /**
   * Get evaluations given by a specific user
   */
  async getEvaluationsByEvaluator(
    projectId: string,
    evaluatorId: string,
    requesterId: string,
  ) {
    await this.verifyProjectMembership(projectId, requesterId);

    // Only the evaluator themselves can view their given evaluations
    if (evaluatorId !== requesterId) {
      throw new ForbiddenException('You can only view your own evaluations');
    }

    const evaluations = await this.prisma.peerEvaluation.findMany({
      where: {
        projectId,
        evaluatorId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        evaluatee: {
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

    return evaluations;
  }

  /**
   * Update an evaluation (within 24 hours of creation)
   */
  async updateEvaluation(
    evaluationId: string,
    userId: string,
    dto: Partial<CreateEvaluationDto>,
  ) {
    const evaluation = await this.prisma.peerEvaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    // Only evaluator can update
    if (evaluation.evaluatorId !== userId) {
      throw new ForbiddenException('You can only update your own evaluations');
    }

    // Check if within 24 hours
    const hoursSinceCreation =
      (Date.now() - evaluation.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new BadRequestException(
        'Evaluations can only be updated within 24 hours of creation',
      );
    }

    const updated = await this.prisma.peerEvaluation.update({
      where: { id: evaluationId },
      data: {
        score: dto.score,
        feedback: dto.feedback,
      },
      include: {
        evaluator: {
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
        evaluatee: {
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

    return updated;
  }

  /**
   * Delete an evaluation (within 1 hour of creation)
   */
  async deleteEvaluation(evaluationId: string, userId: string) {
    const evaluation = await this.prisma.peerEvaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    // Only evaluator can delete
    if (evaluation.evaluatorId !== userId) {
      throw new ForbiddenException('You can only delete your own evaluations');
    }

    // Check if within 1 hour
    const hoursSinceCreation =
      (Date.now() - evaluation.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 1) {
      throw new BadRequestException(
        'Evaluations can only be deleted within 1 hour of creation',
      );
    }

    await this.prisma.peerEvaluation.delete({
      where: { id: evaluationId },
    });

    return { message: 'Evaluation deleted successfully' };
  }
}
