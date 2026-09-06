import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesService } from './profiles.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { ExperienceLevel } from '@prisma/client';

describe('ProfilesService', () => {
  let service: ProfilesService;

  const mockPrismaService = {
    profile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    skill: {
      findUnique: jest.fn(),
    },
    profileSkill: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyProfile', () => {
    it('should return profile with skills when found', async () => {
      const mockProfile = {
        id: 'prof-1',
        userId: 'user-1',
        fullName: 'Mahin',
        skills: [{ id: 'ps-1', skill: { id: 's-1', name: 'TypeScript' } }],
      };
      mockPrismaService.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getMyProfile('user-1');
      expect(result).toEqual(mockProfile);
      expect(mockPrismaService.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { skills: { include: { skill: true } } },
      });
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.getMyProfile('user-unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfileById', () => {
    it('should return profile by id or userId', async () => {
      const mockProfile = { id: 'prof-1', fullName: 'Mahin' };
      mockPrismaService.profile.findFirst.mockResolvedValue(mockProfile);

      const result = await service.getProfileById('prof-1');
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.profile.findFirst.mockResolvedValue(null);

      await expect(service.getProfileById('none')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertProfile', () => {
    it('should create or update profile', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);
      const mockUpserted = {
        id: 'prof-1',
        userId: 'user-1',
        fullName: 'Mahin Dev',
        bio: 'Fullstack developer',
        experienceLevel: ExperienceLevel.ADVANCED,
      };
      mockPrismaService.profile.upsert.mockResolvedValue(mockUpserted);

      const result = await service.upsertProfile('user-1', 'mahin@uni.edu', {
        fullName: 'Mahin Dev',
        bio: 'Fullstack developer',
        experienceLevel: ExperienceLevel.ADVANCED,
      });

      expect(result).toEqual(mockUpserted);
      expect(mockPrismaService.profile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            userId: 'user-1',
            fullName: 'Mahin Dev',
            bio: 'Fullstack developer',
          }),
        }),
      );
    });
  });

  describe('addSkillToProfile', () => {
    it('should throw NotFoundException if skill does not exist', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(null);

      await expect(
        service.addSkillToProfile('user-1', 'test@uni.edu', { skillId: 'invalid-skill' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should associate skill with profile and return join record', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue({ id: 's-1', name: 'React' });
      mockPrismaService.profile.findUnique.mockResolvedValue({ id: 'prof-1', userId: 'user-1' });
      const mockProfileSkill = {
        id: 'ps-1',
        profileId: 'prof-1',
        skillId: 's-1',
        yearsOfExperience: 2,
        proficiencyLevel: ExperienceLevel.INTERMEDIATE,
        skill: { id: 's-1', name: 'React' },
      };
      mockPrismaService.profileSkill.upsert.mockResolvedValue(mockProfileSkill);

      const result = await service.addSkillToProfile('user-1', 'test@uni.edu', {
        skillId: 's-1',
        yearsOfExperience: 2,
        proficiencyLevel: ExperienceLevel.INTERMEDIATE,
      });

      expect(result).toEqual(mockProfileSkill);
      expect(mockPrismaService.profileSkill.upsert).toHaveBeenCalled();
    });
  });

  describe('removeSkillFromProfile', () => {
    it('should throw NotFoundException if profile does not exist', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue(null);

      await expect(service.removeSkillFromProfile('user-1', 's-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if association does not exist', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrismaService.profileSkill.findUnique.mockResolvedValue(null);

      await expect(service.removeSkillFromProfile('user-1', 's-1')).rejects.toThrow(NotFoundException);
    });

    it('should delete association and return confirmation message', async () => {
      mockPrismaService.profile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrismaService.profileSkill.findUnique.mockResolvedValue({ id: 'ps-1' });
      mockPrismaService.profileSkill.delete.mockResolvedValue({ id: 'ps-1' });

      const result = await service.removeSkillFromProfile('user-1', 's-1');
      expect(result).toEqual({ message: 'Skill removed successfully from profile' });
      expect(mockPrismaService.profileSkill.delete).toHaveBeenCalled();
    });
  });
});
