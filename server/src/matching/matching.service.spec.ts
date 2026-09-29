import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { ExperienceLevel, MemberStatus } from '@prisma/client';

describe('MatchingService', () => {
  let service: MatchingService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    profile: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRecommendations', () => {
    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(
        service.getRecommendations('non-existent-proj'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should exclude project creator and accepted members from recommendations', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        creatorId: 'creator-user',
        requiredSkills: [
          {
            skillId: 's-1',
            minimumExperience: ExperienceLevel.BEGINNER,
            skill: { name: 'React' },
          },
        ],
        members: [
          { userId: 'member-1', status: MemberStatus.ACCEPTED },
          { userId: 'candidate-pending', status: MemberStatus.PENDING },
        ],
      });

      mockPrismaService.profile.findMany.mockResolvedValue([]);

      await service.getRecommendations('proj-1');

      expect(mockPrismaService.profile.findMany).toHaveBeenCalledWith({
        where: {
          userId: {
            notIn: expect.arrayContaining(['creator-user', 'member-1']),
          },
        },
        include: expect.any(Object),
      });
    });

    it('should compute scores and sort candidates in descending order', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        creatorId: 'creator-user',
        requiredSkills: [
          {
            skillId: 's-react',
            minimumExperience: ExperienceLevel.INTERMEDIATE,
            skill: { name: 'React' },
          },
          {
            skillId: 's-node',
            minimumExperience: ExperienceLevel.INTERMEDIATE,
            skill: { name: 'Node.js' },
          },
        ],
        members: [{ userId: 'user-pending', status: MemberStatus.PENDING }],
      });

      const mockProfiles = [
        // Candidate 1: Perfect match (has both skills at ADVANCED level, 5.0 peer rating, available)
        {
          id: 'prof-1',
          userId: 'user-perfect',
          fullName: 'Alice Dev',
          availability: true,
          experienceLevel: ExperienceLevel.ADVANCED,
          user: {
            email: 'alice@uni.edu',
            evaluationsReceived: [{ score: 5.0 }, { score: 5.0 }],
          },
          skills: [
            {
              skillId: 's-react',
              proficiencyLevel: ExperienceLevel.ADVANCED,
              skill: { name: 'React' },
            },
            {
              skillId: 's-node',
              proficiencyLevel: ExperienceLevel.ADVANCED,
              skill: { name: 'Node.js' },
            },
          ],
          githubStats: { publicRepos: 12, contributionsThisYear: 150 },
        },
        // Candidate 2: Partial match (only has React at BEGINNER, no evaluations, available, pending invite)
        {
          id: 'prof-2',
          userId: 'user-pending',
          fullName: 'Bob Junior',
          availability: true,
          experienceLevel: ExperienceLevel.BEGINNER,
          user: {
            email: 'bob@uni.edu',
            evaluationsReceived: [],
          },
          skills: [
            {
              skillId: 's-react',
              proficiencyLevel: ExperienceLevel.BEGINNER,
              skill: { name: 'React' },
            },
          ],
          githubStats: null,
        },
        // Candidate 3: Low match (no matching skills, unavailable, low rating)
        {
          id: 'prof-3',
          userId: 'user-low',
          fullName: 'Charlie Unavail',
          availability: false,
          experienceLevel: ExperienceLevel.BEGINNER,
          user: {
            email: 'charlie@uni.edu',
            evaluationsReceived: [{ score: 2.0 }],
          },
          skills: [
            {
              skillId: 's-python',
              proficiencyLevel: ExperienceLevel.BEGINNER,
              skill: { name: 'Python' },
            },
          ],
          githubStats: null,
        },
      ];

      mockPrismaService.profile.findMany.mockResolvedValue(mockProfiles);

      const results = await service.getRecommendations('proj-1');

      expect(results.length).toBe(3);
      // Alice should be ranked #1
      expect(results[0].fullName).toBe('Alice Dev');
      expect(results[0].matchingSkills).toEqual(['React', 'Node.js']);
      expect(results[0].matchScore).toBeGreaterThan(90);
      expect(results[0].invited).toBe(false);
      expect(results[0].publicRepos).toBe(12);

      // Bob should be ranked #2 and have invited: true
      expect(results[1].fullName).toBe('Bob Junior');
      expect(results[1].matchingSkills).toEqual(['React']);
      expect(results[1].invited).toBe(true);

      // Charlie should be ranked #3 with the lowest score
      expect(results[2].fullName).toBe('Charlie Unavail');
      expect(results[2].matchingSkills).toEqual([]);
      expect(results[2].matchScore).toBeLessThan(results[1].matchScore);
    });

    it('should handle projects with zero required skills gracefully without returning NaN', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-empty-skills',
        creatorId: 'creator-user',
        requiredSkills: [],
        members: [],
      });

      mockPrismaService.profile.findMany.mockResolvedValue([
        {
          id: 'prof-1',
          userId: 'user-1',
          fullName: 'Student One',
          availability: true,
          experienceLevel: ExperienceLevel.INTERMEDIATE,
          user: { email: 'student1@uni.edu', evaluationsReceived: [] },
          skills: [],
          githubStats: null,
        },
      ]);

      const results = await service.getRecommendations('proj-empty-skills');
      expect(results.length).toBe(1);
      expect(Number.isNaN(results[0].matchScore)).toBe(false);
      expect(results[0].matchScore).toBeGreaterThan(0);
    });

    it('should assign neutral prior score (0.70) to candidates with zero evaluations', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        creatorId: 'creator-1',
        requiredSkills: [
          {
            skillId: 's-1',
            minimumExperience: ExperienceLevel.BEGINNER,
            skill: { name: 'React' },
          },
        ],
        members: [],
      });

      mockPrismaService.profile.findMany.mockResolvedValue([
        {
          id: 'prof-newbie',
          userId: 'user-newbie',
          fullName: 'Newbie Student',
          availability: true,
          experienceLevel: ExperienceLevel.BEGINNER,
          user: { email: 'new@uni.edu', evaluationsReceived: [] }, // 0 evaluations
          skills: [
            {
              skillId: 's-1',
              proficiencyLevel: ExperienceLevel.BEGINNER,
              skill: { name: 'React' },
            },
          ],
          githubStats: null,
        },
      ]);

      const results = await service.getRecommendations('proj-1');
      // Overlap: 1.0 * 0.5 = 0.50
      // Experience: 1.0 * 0.2 = 0.20
      // Peer rating prior: 0.70 * 0.2 = 0.14
      // Availability: 1.0 * 0.1 = 0.10
      // Total: 0.50 + 0.20 + 0.14 + 0.10 = 0.94 -> 94%
      expect(results[0].matchScore).toBe(94);
    });
  });

  describe('MatchingService.score (golden cases)', () => {
    const golden = [
      {
        name: 'perfect',
        overlap: 3,
        required: 3,
        experienceMatch: 1,
        avgEvaluation: 1,
        availabilityMatch: 1,
        expected: 1.0,
      },
      {
        name: 'half skills, rest perfect',
        overlap: 1,
        required: 2,
        experienceMatch: 1,
        avgEvaluation: 1,
        availabilityMatch: 1,
        expected: 0.25 + 0.5,
      },
      {
        name: 'no skills, unavailable',
        overlap: 0,
        required: 3,
        experienceMatch: 0,
        avgEvaluation: 0,
        availabilityMatch: 0,
        expected: 0,
      },
    ];

    it.each(golden)('MATCH-U12 golden: $name', (g) => {
      const actual = service.calculateScore({
        overlapCount: g.overlap,
        requiredCount: g.required,
        experienceMatch: g.experienceMatch,
        avgEvaluation: g.avgEvaluation,
        availabilityMatch: g.availabilityMatch,
      });
      expect(actual).toBeCloseTo(g.expected, 3);
    });

    it('MATCH-U10 max score never exceeds 1', () => {
      const s = service.calculateScore({
        overlapCount: 10,
        requiredCount: 3,
        experienceMatch: 1,
        avgEvaluation: 1,
        availabilityMatch: 1,
      });
      expect(s).toBeLessThanOrEqual(1.0001);
    });
  });
});
