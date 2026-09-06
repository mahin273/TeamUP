import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { ExperienceLevel } from '@prisma/client';

describe('ProfilesController', () => {
  let controller: ProfilesController;

  const mockProfilesService = {
    getMyProfile: jest.fn(),
    getProfileById: jest.fn(),
    upsertProfile: jest.fn(),
    addSkillToProfile: jest.fn(),
    removeSkillFromProfile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [{ provide: ProfilesService, useValue: mockProfilesService }],
    }).compile();

    controller = module.get<ProfilesController>(ProfilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getMyProfile', async () => {
    const user = { userId: 'u-1', email: 'test@uni.edu', role: 'STUDENT' as const };
    mockProfilesService.getMyProfile.mockResolvedValue({ id: 'p-1', userId: 'u-1' });

    const result = await controller.getMyProfile(user);
    expect(result).toEqual({ id: 'p-1', userId: 'u-1' });
    expect(mockProfilesService.getMyProfile).toHaveBeenCalledWith('u-1');
  });

  it('should call updateMyProfile', async () => {
    const user = { userId: 'u-1', email: 'test@uni.edu', role: 'STUDENT' as const };
    const dto = { fullName: 'Mahin' };
    mockProfilesService.upsertProfile.mockResolvedValue({ id: 'p-1', fullName: 'Mahin' });

    const result = await controller.updateMyProfile(user, dto);
    expect(result).toEqual({ id: 'p-1', fullName: 'Mahin' });
    expect(mockProfilesService.upsertProfile).toHaveBeenCalledWith('u-1', 'test@uni.edu', dto);
  });

  it('should call addSkill', async () => {
    const user = { userId: 'u-1', email: 'test@uni.edu', role: 'STUDENT' as const };
    const dto = { skillId: 's-1', yearsOfExperience: 1, proficiencyLevel: ExperienceLevel.BEGINNER };
    mockProfilesService.addSkillToProfile.mockResolvedValue({ id: 'ps-1' });

    const result = await controller.addSkill(user, dto);
    expect(result).toEqual({ id: 'ps-1' });
    expect(mockProfilesService.addSkillToProfile).toHaveBeenCalledWith('u-1', 'test@uni.edu', dto);
  });

  it('should call removeSkill', async () => {
    const user = { userId: 'u-1', email: 'test@uni.edu', role: 'STUDENT' as const };
    mockProfilesService.removeSkillFromProfile.mockResolvedValue({ message: 'Skill removed' });

    const result = await controller.removeSkill(user, 's-1');
    expect(result).toEqual({ message: 'Skill removed' });
    expect(mockProfilesService.removeSkillFromProfile).toHaveBeenCalledWith('u-1', 's-1');
  });

  it('should call getProfileById', async () => {
    mockProfilesService.getProfileById.mockResolvedValue({ id: 'p-1' });

    const result = await controller.getProfileById('p-1');
    expect(result).toEqual({ id: 'p-1' });
    expect(mockProfilesService.getProfileById).toHaveBeenCalledWith('p-1');
  });
});
