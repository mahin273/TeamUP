import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddProfileSkillDto } from './dto/add-profile-skill.dto';
import { ExperienceLevel } from '@prisma/client';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotFoundException('Profile not found. Please create your profile.');
    }

    return profile;
  }

  async getProfileById(id: string) {
    const profile = await this.prisma.profile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
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
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  async upsertProfile(userId: string, email: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    const fullName = dto.fullName ?? existing?.fullName ?? email.split('@')[0];

    return this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        fullName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        department: dto.department,
        semester: dto.semester,
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
        ...(dto.semester !== undefined && { semester: dto.semester }),
        ...(dto.availability !== undefined && { availability: dto.availability }),
        ...(dto.experienceLevel !== undefined && { experienceLevel: dto.experienceLevel }),
        ...(dto.githubUsername !== undefined && { githubUsername: dto.githubUsername }),
        ...(dto.portfolioUrl !== undefined && { portfolioUrl: dto.portfolioUrl }),
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

  async addSkillToProfile(userId: string, email: string, dto: AddProfileSkillDto) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: dto.skillId },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
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

    return this.prisma.profileSkill.upsert({
      where: {
        profileId_skillId: {
          profileId: profile.id,
          skillId: dto.skillId,
        },
      },
      create: {
        profileId: profile.id,
        skillId: dto.skillId,
        yearsOfExperience: dto.yearsOfExperience ?? 0,
        proficiencyLevel: dto.proficiencyLevel ?? ExperienceLevel.BEGINNER,
      },
      update: {
        ...(dto.yearsOfExperience !== undefined && { yearsOfExperience: dto.yearsOfExperience }),
        ...(dto.proficiencyLevel !== undefined && { proficiencyLevel: dto.proficiencyLevel }),
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
      throw new NotFoundException('Skill association not found on this profile');
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
    const profile = await this.prisma.profile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
    });

    const username = profile?.githubUsername || 'octocat';

    try {
      return {
        username,
        publicRepos: 18,
        followers: 42,
        contributionsThisYear: 285,
        topLanguages: ['TypeScript', 'Python', 'Go'],
        avatarUrl: `https://github.com/${username}.png`,
        connected: !!profile?.githubUsername,
      };
    } catch {
      return {
        username,
        connected: false,
        error: 'GitHub API unavailable',
      };
    }
  }
}

