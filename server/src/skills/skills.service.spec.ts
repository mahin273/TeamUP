import { Test, TestingModule } from '@nestjs/testing';
import { SkillsService } from './skills.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('SkillsService', () => {
  let service: SkillsService;

  const mockPrismaService = {
    skill: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return list of skills ordered by name', async () => {
      const skills = [{ id: 's-1', name: 'Node.js', category: 'Backend' }];
      mockPrismaService.skill.findMany.mockResolvedValue(skills);

      const result = await service.findAll();
      expect(result).toEqual(skills);
      expect(mockPrismaService.skill.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });

    it('should apply category filter when provided', async () => {
      mockPrismaService.skill.findMany.mockResolvedValue([]);

      await service.findAll('Frontend', 'React');
      expect(mockPrismaService.skill.findMany).toHaveBeenCalledWith({
        where: {
          category: { equals: 'Frontend', mode: 'insensitive' },
          name: { contains: 'React', mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('should return skill by id', async () => {
      const skill = { id: 's-1', name: 'PostgreSQL' };
      mockPrismaService.skill.findUnique.mockResolvedValue(skill);

      const result = await service.findById('s-1');
      expect(result).toEqual(skill);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(null);

      await expect(service.findById('none')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if skill name already exists', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue({ id: 's-1', name: 'Docker' });

      await expect(service.create({ name: 'Docker' })).rejects.toThrow(ConflictException);
    });

    it('should create new skill with trimmed name', async () => {
      mockPrismaService.skill.findUnique.mockResolvedValue(null);
      const newSkill = { id: 's-2', name: 'GraphQL', category: 'Backend' };
      mockPrismaService.skill.create.mockResolvedValue(newSkill);

      const result = await service.create({ name: '  GraphQL  ', category: ' Backend ' });
      expect(result).toEqual(newSkill);
      expect(mockPrismaService.skill.create).toHaveBeenCalledWith({
        data: {
          name: 'GraphQL',
          category: 'Backend',
        },
      });
    });
  });
});
