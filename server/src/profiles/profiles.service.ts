import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddProfileSkillDto } from './dto/add-profile-skill.dto';
import { ProfileFilterDto } from './dto/profile-filter.dto';
import { ExperienceLevel, Prisma } from '@prisma/client';
import { GithubService } from '../github/github.service';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GithubService,
  ) {}

  async getMyProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please create your profile.',
      );
    }

    return profile;
  }

  async getProfileById(id: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid user or profile ID format');
    }

    const profile = await this.prisma.profile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async upsertProfile(userId: string, email: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });
    const fullName = dto.fullName ?? existing?.fullName ?? email.split('@')[0];
    const semesterStr =
      dto.semester !== undefined ? String(dto.semester) : undefined;

    return this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        fullName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        department: dto.department,
        semester: semesterStr,
        availability: dto.availability ?? true,
        experienceLevel: dto.experienceLevel ?? ExperienceLevel.BEGINNER,
        githubUsername: dto.githubUsername,
        portfolioUrl: dto.portfolioUrl,
      },
      update: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(semesterStr !== undefined && { semester: semesterStr }),
        ...(dto.availability !== undefined && {
          availability: dto.availability,
        }),
        ...(dto.experienceLevel !== undefined && {
          experienceLevel: dto.experienceLevel,
        }),
        ...(dto.githubUsername !== undefined && {
          githubUsername: dto.githubUsername,
        }),
        ...(dto.portfolioUrl !== undefined && {
          portfolioUrl: dto.portfolioUrl,
        }),
      },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });
  }

  async addSkillToProfile(
    userId: string,
    email: string,
    dto: AddProfileSkillDto,
  ) {
    let skillId = dto.skillId;
    if (!skillId && dto.skillName) {
      const normalizedName = dto.skillName.trim();
      let skill = await this.prisma.skill.findFirst({
        where: { name: { equals: normalizedName, mode: 'insensitive' } },
      });
      if (!skill) {
        skill = await this.prisma.skill.create({
          data: { name: normalizedName },
        });
      }
      skillId = skill.id;
    }

    if (skillId) {
      const existing = await this.prisma.skill.findUnique({
        where: { id: skillId },
      });
      if (!existing) {
        throw new NotFoundException('Skill not found');
      }
    }

    if (!skillId) {
      throw new BadRequestException('skillId or skillName is required');
    }

    let profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await this.prisma.profile.create({
        data: {
          userId,
          fullName: email.split('@')[0],
        },
      });
    }

    const proficiencyLevel =
      dto.proficiencyLevel ?? dto.proficiency ?? ExperienceLevel.BEGINNER;

    return this.prisma.profileSkill.upsert({
      where: {
        profileId_skillId: {
          profileId: profile.id,
          skillId,
        },
      },
      create: {
        profileId: profile.id,
        skillId,
        yearsOfExperience: dto.yearsOfExperience ?? 0,
        proficiencyLevel,
      },
      update: {
        ...(dto.yearsOfExperience !== undefined && {
          yearsOfExperience: dto.yearsOfExperience,
        }),
        proficiencyLevel,
      },
      include: {
        skill: true,
      },
    });
  }

  async removeSkillFromProfile(userId: string, skillId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const association = await this.prisma.profileSkill.findUnique({
      where: {
        profileId_skillId: {
          profileId: profile.id,
          skillId,
        },
      },
    });

    if (!association) {
      throw new NotFoundException(
        'Skill association not found on this profile',
      );
    }

    await this.prisma.profileSkill.delete({
      where: {
        profileId_skillId: {
          profileId: profile.id,
          skillId,
        },
      },
    });

    return { message: 'Skill removed successfully from profile' };
  }

  async getGithubStats(id: string) {
    return this.githubService.getStatsForProfile(id);
  }

  /**
   * Search profiles with multi-criteria filters
   */
  async searchProfiles(query: ProfileFilterDto) {
    const {
      search,
      skill,
      department,
      semester,
      experienceLevel,
      availability,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.ProfileWhereInput = {};

    if (search && search.trim()) {
      const keyword = search.trim();
      where.OR = [
        { fullName: { contains: keyword, mode: 'insensitive' } },
        { bio: { contains: keyword, mode: 'insensitive' } },
        { department: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (department && department !== 'All') {
      where.department = { contains: department, mode: 'insensitive' };
    }

    if (semester && semester !== 'All') {
      where.semester = { contains: semester, mode: 'insensitive' };
    }

    if (experienceLevel) {
      where.experienceLevel = experienceLevel;
    }

    if (availability !== undefined) {
      where.availability = availability;
    }

    if (skill && skill !== 'All') {
      where.skills = {
        some: {
          skill: {
            name: { contains: skill, mode: 'insensitive' },
          },
        },
      };
    }

    const skip = (page - 1) * limit;

    const [total, profiles] = await Promise.all([
      this.prisma.profile.count({ where }),
      this.prisma.profile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          skills: {
            include: {
              skill: true,
            },
          },
        },
      }),
    ]);

    return {
      profiles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
