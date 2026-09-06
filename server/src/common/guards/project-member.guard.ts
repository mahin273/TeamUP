import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberStatus, ProjectRole } from '@prisma/client';

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const projectId =
      request.params.projectId ||
      request.params.id ||
      request.body?.projectId ||
      request.query?.projectId;

    if (!projectId) {
      throw new BadRequestException('Project ID is required for workspace access');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        creatorId: true,
        status: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    // Check if user has an accepted membership in this project
    const member = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: user.userId,
        status: MemberStatus.ACCEPTED,
      },
    });

    if (!member) {
      // If user is project creator, allow access and treat as LEADER
      if (project.creatorId === user.userId) {
        request.project = project;
        request.projectMember = {
          projectId,
          userId: user.userId,
          role: ProjectRole.LEADER,
          status: MemberStatus.ACCEPTED,
        };
        return true;
      }

      throw new ForbiddenException(
        'Access denied: You must be an accepted member of this project workspace to access its resources',
      );
    }

    request.project = project;
    request.projectMember = member;
    return true;
  }
}
