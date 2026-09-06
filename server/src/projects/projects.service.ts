import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, RequiredSkillItemDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectFilterDto } from './dto/project-filter.dto';
import { InviteMemberDto, UpdateMemberDto } from './dto/manage-member.dto';
import {
  ProjectRole,
  MemberStatus,
  ProjectStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to verify if a user has LEADER rights on a project
   */
  async isProjectLeader(projectId: string, userId: string): Promise<boolean> {
    const leaderMembership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        role: ProjectRole.LEADER,
        status: MemberStatus.ACCEPTED,
      },
    });

    if (leaderMembership) return true;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    return project?.creatorId === userId;
  }

  /**
   * Helper to resolve skills from skillId or skillName
   */
  private async resolveSkills(
    skillsInput?: RequiredSkillItemDto[],
  ): Promise<Array<{ skillId: string; minimumExperience: any }>> {
    if (!skillsInput || skillsInput.length === 0) {
      return [];
    }

    const resolved: Array<{ skillId: string; minimumExperience: any }> = [];

    for (const item of skillsInput) {
      let finalSkillId = item.skillId;

      if (!finalSkillId && item.skillName) {
        const normalizedName = item.skillName.trim();
        let skill = await this.prisma.skill.findUnique({
          where: { name: normalizedName },
        });

        if (!skill) {
          skill = await this.prisma.skill.create({
            data: { name: normalizedName },
          });
        }
        finalSkillId = skill.id;
      }

      if (finalSkillId) {
        const skillExists = await this.prisma.skill.findUnique({
          where: { id: finalSkillId },
        });

        if (!skillExists) {
          throw new NotFoundException(`Skill with ID '${finalSkillId}' not found`);
        }

        resolved.push({
          skillId: finalSkillId,
          minimumExperience: item.minimumExperience ?? 'BEGINNER',
        });
      }
    }

    // Deduplicate by skillId
    const uniqueMap = new Map<string, { skillId: string; minimumExperience: any }>();
    for (const item of resolved) {
      uniqueMap.set(item.skillId, item);
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Create a new project listing
   */
  async createProject(creatorId: string, dto: CreateProjectDto) {
    const resolvedSkills = await this.resolveSkills(dto.requiredSkills);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          domain: dto.domain.trim(),
          semester: dto.semester.trim(),
          maxMembers: dto.maxMembers ?? 4,
          creatorId,
          status: ProjectStatus.OPEN,
          members: {
            create: {
              userId: creatorId,
              role: ProjectRole.LEADER,
              status: MemberStatus.ACCEPTED,
            },
          },
          requiredSkills: {
            create: resolvedSkills.map((s) => ({
              skillId: s.skillId,
              minimumExperience: s.minimumExperience,
            })),
          },
        },
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
          },
          requiredSkills: {
            include: {
              skill: true,
            },
          },
        },
      });

      return project;
    });
  }

  /**
   * Find all projects with search & filters
   */
  async findAll(query: ProjectFilterDto) {
    const {
      search,
      domain,
      tech,
      semester,
      status,
      skillId,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.ProjectWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (domain) {
      where.domain = { contains: domain, mode: 'insensitive' };
    }

    if (semester) {
      where.semester = { contains: semester, mode: 'insensitive' };
    }

    if (status) {
      where.status = status;
    }

    if (skillId) {
      where.requiredSkills = {
        some: { skillId },
      };
    }

    if (tech) {
      where.OR = [
        ...(where.OR || []),
        {
          requiredSkills: {
            some: {
              skill: {
                name: { contains: tech, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
          requiredSkills: {
            include: {
              skill: true,
            },
          },
          members: {
            where: { status: MemberStatus.ACCEPTED },
            select: {
              id: true,
              userId: true,
              role: true,
              status: true,
              joinedAt: true,
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
          },
          _count: {
            select: {
              members: {
                where: { status: MemberStatus.ACCEPTED },
              },
              tasks: true,
            },
          },
        },
      }),
    ]);

    return {
      projects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search projects (alias for search endpoint)
   */
  async search(query: ProjectFilterDto) {
    return this.findAll(query);
  }

  /**
   * Find project by ID
   */
  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
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
        requiredSkills: {
          include: {
            skill: true,
          },
        },
        members: {
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
          orderBy: { joinedAt: 'asc' },
        },
        _count: {
          select: {
            tasks: true,
            files: true,
            messages: true,
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${id}' not found`);
    }

    return project;
  }

  /**
   * Update project details or status (Leader only)
   */
  async updateProject(projectId: string, userId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    const isLeader = await this.isProjectLeader(projectId, userId);
    if (!isLeader) {
      throw new ForbiddenException('Only a project leader can update this project');
    }

    if (dto.maxMembers !== undefined && dto.maxMembers < project._count.members) {
      throw new BadRequestException(
        `Cannot set maxMembers to ${dto.maxMembers}. The project already has ${project._count.members} accepted members.`,
      );
    }

    let resolvedSkills: Array<{ skillId: string; minimumExperience: any }> | null = null;
    if (dto.requiredSkills) {
      resolvedSkills = await this.resolveSkills(dto.requiredSkills);
    }

    return this.prisma.$transaction(async (tx) => {
      if (resolvedSkills !== null) {
        // Delete existing required skills
        await tx.projectRequiredSkill.deleteMany({
          where: { projectId },
        });

        // Insert new ones
        if (resolvedSkills.length > 0) {
          await tx.projectRequiredSkill.createMany({
            data: resolvedSkills.map((s) => ({
              projectId,
              skillId: s.skillId,
              minimumExperience: s.minimumExperience,
            })),
          });
        }
      }

      return tx.project.update({
        where: { id: projectId },
        data: {
          title: dto.title?.trim(),
          description: dto.description?.trim(),
          domain: dto.domain?.trim(),
          semester: dto.semester?.trim(),
          status: dto.status,
          maxMembers: dto.maxMembers,
        },
        include: {
          creator: {
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
          requiredSkills: {
            include: {
              skill: true,
            },
          },
          members: {
            where: { status: MemberStatus.ACCEPTED },
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
          },
        },
      });
    });
  }

  /**
   * Delete project (Leader only)
   */
  async deleteProject(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    const isLeader = await this.isProjectLeader(projectId, userId);
    if (!isLeader) {
      throw new ForbiddenException('Only a project leader can delete this project');
    }

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    return { message: 'Project deleted successfully' };
  }

  /**
   * Apply to join project (Student application)
   */
  async applyToProject(projectId: string, applicantId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    if (project.status !== ProjectStatus.OPEN) {
      throw new BadRequestException('Project is not currently open for new members');
    }

    if (project._count.members >= project.maxMembers) {
      throw new BadRequestException('Project has reached its maximum member capacity');
    }

    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: applicantId,
        },
      },
    });

    if (existingMember) {
      if (existingMember.status === MemberStatus.ACCEPTED) {
        throw new ConflictException('You are already an accepted member of this project');
      }
      if (existingMember.status === MemberStatus.PENDING) {
        throw new ConflictException('You already have a pending application for this project');
      }
      // If rejected earlier, allow re-applying
      return this.prisma.projectMember.update({
        where: { id: existingMember.id },
        data: {
          status: MemberStatus.PENDING,
          role: ProjectRole.MEMBER,
          joinedAt: new Date(),
        },
      });
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: applicantId,
        role: ProjectRole.MEMBER,
        status: MemberStatus.PENDING,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            domain: true,
          },
        },
      },
    });
  }

  /**
   * Invite member to project (Leader only)
   */
  async inviteMember(projectId: string, leaderId: string, dto: InviteMemberDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    const isLeader = await this.isProjectLeader(projectId, leaderId);
    if (!isLeader) {
      throw new ForbiddenException('Only a project leader can invite members');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!targetUser) {
      throw new NotFoundException(`User with ID '${dto.userId}' not found`);
    }

    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: dto.userId,
        },
      },
    });

    if (existingMember) {
      if (existingMember.status === MemberStatus.ACCEPTED) {
        throw new ConflictException('User is already an accepted member of this project');
      }
      // If pending or rejected, update to invited state
      return this.prisma.projectMember.update({
        where: { id: existingMember.id },
        data: {
          status: MemberStatus.PENDING,
          role: dto.role ?? ProjectRole.MEMBER,
        },
      });
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: dto.role ?? ProjectRole.MEMBER,
        status: MemberStatus.PENDING,
      },
    });
  }

  /**
   * Get all members for a project
   */
  async getProjectMembers(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    return this.prisma.projectMember.findMany({
      where: { projectId },
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
    });
  }

  /**
   * Update member status or role (Accept/Reject/Promote) (Leader only)
   */
  async updateMember(
    projectId: string,
    memberId: string,
    updaterId: string,
    dto: UpdateMemberDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            members: {
              where: { status: MemberStatus.ACCEPTED },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    const isLeader = await this.isProjectLeader(projectId, updaterId);
    if (!isLeader) {
      throw new ForbiddenException('Only a project leader can manage member status or roles');
    }

    const member = await this.prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId,
      },
    });

    if (!member) {
      throw new NotFoundException(`Member record not found in this project`);
    }

    if (
      dto.status === MemberStatus.ACCEPTED &&
      member.status !== MemberStatus.ACCEPTED &&
      project._count.members >= project.maxMembers
    ) {
      throw new BadRequestException(
        'Cannot accept member: project has reached maximum member capacity',
      );
    }

    return this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        status: dto.status ?? member.status,
        role: dto.role ?? member.role,
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
  }

  /**
   * Remove member or leave project
   */
  async removeMember(projectId: string, memberId: string, requesterId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID '${projectId}' not found`);
    }

    const member = await this.prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member record not found in this project');
    }

    const isLeader = await this.isProjectLeader(projectId, requesterId);
    const isSelf = member.userId === requesterId;

    if (!isLeader && !isSelf) {
      throw new ForbiddenException('You do not have permission to remove this member');
    }

    // If a leader is leaving, ensure there is another leader or they cannot abandon without transferring leadership
    if (isSelf && member.role === ProjectRole.LEADER) {
      const leaderCount = await this.prisma.projectMember.count({
        where: {
          projectId,
          role: ProjectRole.LEADER,
          status: MemberStatus.ACCEPTED,
        },
      });

      if (leaderCount <= 1) {
        const otherMembers = await this.prisma.projectMember.count({
          where: {
            projectId,
            id: { not: member.id },
            status: MemberStatus.ACCEPTED,
          },
        });

        if (otherMembers > 0) {
          throw new BadRequestException(
            'As the sole leader, you must promote another member to leader before leaving.',
          );
        }
      }
    }

    await this.prisma.projectMember.delete({
      where: { id: memberId },
    });

    return { message: 'Member removed successfully' };
  }
}
