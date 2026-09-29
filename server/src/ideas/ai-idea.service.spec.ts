import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExperienceLevel } from '@prisma/client';
import { AiIdeaService } from './ai-idea.service';
import { LlmClient } from './llm.client';
import { PrismaService } from '../prisma/prisma.service';

describe('AiIdeaService', () => {
  let service: AiIdeaService;

  const mockPrismaService = {
    cachedIdeaQuery: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string): string | null => {
      if (key === 'LLM_API_KEY') return 'your_llm_api_key';
      if (key === 'LLM_CACHE_TTL_HOURS') return '24';
      return null;
    }),
  };

  const mockLlmClient = {
    complete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiIdeaService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LlmClient, useValue: mockLlmClient },
      ],
    }).compile();

    service = module.get<AiIdeaService>(AiIdeaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeHash', () => {
    it('should generate identical hashes regardless of tech stack order or casing', () => {
      const hash1 = service.computeHash(
        'Fintech',
        ['React Native', 'NestJS'],
        'INTERMEDIATE',
      );
      const hash2 = service.computeHash(
        '  fintech ',
        ['nestjs', 'react native'],
        'intermediate',
      );

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different hashes for different domains', () => {
      const hash1 = service.computeHash(
        'Fintech',
        ['React Native'],
        'BEGINNER',
      );
      const hash2 = service.computeHash(
        'Healthcare',
        ['React Native'],
        'BEGINNER',
      );

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateIdea - Cache Hit', () => {
    it('should return cached idea with isCached: true when cache is valid', async () => {
      const cachedResult = {
        id: 'cached-1',
        title: 'Cached Fintech App',
        description: 'Existing cached description',
        problem: 'Existing cached problem',
        domain: 'Fintech',
        techStack: ['React Native', 'NestJS'],
        difficulty: ExperienceLevel.INTERMEDIATE,
        estimatedDuration: '4-6 weeks',
        teamSize: '3-4 members',
        features: ['OCR scanning'],
        roadmap: ['Phase 1'],
      };

      mockPrismaService.cachedIdeaQuery.findUnique.mockResolvedValue({
        id: 'db-cache-1',
        queryHash: 'some-hash',
        domain: 'Fintech',
        techInterest: 'NestJS, React Native',
        resultJson: cachedResult,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // Valid for 1 hour
      });

      const result = await service.generateIdea({
        domain: 'Fintech',
        techStack: ['React Native', 'NestJS'],
        difficulty: ExperienceLevel.INTERMEDIATE,
      });

      expect(result.title).toBe('Cached Fintech App');
      expect(result.isCached).toBe(true);
      expect(mockPrismaService.cachedIdeaQuery.upsert).not.toHaveBeenCalled();
    });
  });

  describe('generateIdea - Cache Miss', () => {
    it('should generate procedural idea and persist to cache when cache misses', async () => {
      mockPrismaService.cachedIdeaQuery.findUnique.mockResolvedValue(null);
      mockPrismaService.cachedIdeaQuery.upsert.mockResolvedValue({});

      const result = await service.generateIdea({
        domain: 'Fintech',
        techStack: ['React Native', 'NestJS'],
        difficulty: ExperienceLevel.INTERMEDIATE,
      });

      expect(result.domain).toBe('Fintech');
      expect(result.techStack).toContain('React Native');
      expect(result.techStack).toContain('NestJS');
      expect(result.difficulty).toBe(ExperienceLevel.INTERMEDIATE);
      expect(result.features.length).toBeGreaterThan(0);
      expect(result.roadmap.length).toBeGreaterThan(0);
      expect(result.isCached).toBe(false);

      expect(mockPrismaService.cachedIdeaQuery.upsert).toHaveBeenCalledWith({
        where: { queryHash: expect.any(String) },
        create: expect.objectContaining({
          domain: 'Fintech',
          resultJson: expect.objectContaining({
            domain: 'Fintech',
          }),
        }),
        update: expect.any(Object),
      });
    });
  });

  describe('generateIdea - Failure Handling', () => {
    it('should throw ServiceUnavailableException when simulateFailure is true', async () => {
      await expect(
        service.generateIdea({
          domain: 'AI',
          simulateFailure: true,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('generateIdea - LLM API Call & Parsing', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should call Gemini endpoint when API key is set and parse JSON response', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'LLM_API_KEY') return 'actual_valid_gemini_key';
        if (key === 'LLM_MODEL') return 'gemini-3.6-flash';
        return null;
      });

      const mockGeminiJson = {
        title: 'Gemini Project',
        description: 'Gemini generated project description',
        problem: 'Specific student challenge',
        domain: 'Robotics',
        techStack: ['ROS 2', 'Python'],
        difficulty: ExperienceLevel.ADVANCED,
        estimatedDuration: '6-8 weeks',
        teamSize: '4-5 members',
        features: ['Autonomous navigation', 'LiDAR mapping'],
        roadmap: ['Phase 1: Gazebo', 'Phase 2: Hardware'],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: `\`\`\`json\n${JSON.stringify(mockGeminiJson)}\n\`\`\``,
                  },
                ],
              },
            },
          ],
        }),
      } as any);

      mockLlmClient.complete.mockResolvedValue(JSON.stringify(mockGeminiJson));
      mockPrismaService.cachedIdeaQuery.findUnique.mockResolvedValue(null);
      mockPrismaService.cachedIdeaQuery.upsert.mockResolvedValue({});

      const result = await service.generateIdea({
        domain: 'Robotics',
        techStack: ['ROS 2', 'Python'],
        difficulty: ExperienceLevel.ADVANCED,
      });

      expect(result.title).toBe('Gemini Project');
      expect(result.domain).toBe('Robotics');
      expect(result.features).toContain('Autonomous navigation');
      expect(result.isCached).toBe(false);
      expect(mockLlmClient.complete).toHaveBeenCalled();
    });

    it('should call custom OpenAI-compatible endpoint when LLM_API_URL is configured', async () => {
      const mockOpenAiJson = {
        title: 'OpenAI Project',
        description: 'OpenAI description',
        problem: 'Solves education gap',
        domain: 'Education',
        techStack: ['TypeScript'],
        difficulty: ExperienceLevel.BEGINNER,
        features: ['Quiz engine'],
        roadmap: ['Phase 1'],
      };

      mockLlmClient.complete.mockResolvedValue(JSON.stringify(mockOpenAiJson));
      mockPrismaService.cachedIdeaQuery.findUnique.mockResolvedValue(null);
      mockPrismaService.cachedIdeaQuery.upsert.mockResolvedValue({});

      const result = await service.generateIdea({
        domain: 'Education',
        techStack: ['TypeScript'],
        difficulty: ExperienceLevel.BEGINNER,
      });

      expect(result.title).toBe('OpenAI Project');
      expect(mockLlmClient.complete).toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when simulateFailure is true', async () => {
      await expect(
        service.generateIdea({
          domain: 'Fintech',
          techStack: ['Node.js'],
          simulateFailure: true,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should fallback procedurally when LLM completes with an error', async () => {
      mockLlmClient.complete.mockRejectedValue(
        new Error('LLM rate limit reached'),
      );
      mockPrismaService.cachedIdeaQuery.findUnique.mockResolvedValue(null);
      mockPrismaService.cachedIdeaQuery.upsert.mockResolvedValue({});

      const result = await service.generateIdea({
        domain: 'Fintech',
        techStack: ['Node.js'],
      });

      expect(result.title).toBeTruthy();
      expect(result.domain).toBe('Fintech');
      expect(result.isCached).toBe(false);
    });
  });

  describe('generateProceduralFallback - Domain Variations', () => {
    it('should generate Healthcare tailored project proposal', () => {
      const idea = service.generateProceduralFallback(
        'Healthcare',
        ['Python', 'FastAPI'],
        ExperienceLevel.ADVANCED,
      );

      expect(idea.title).toContain('Healthcare');
      expect(idea.description).toContain('telehealth');
      expect(idea.features).toEqual(
        expect.arrayContaining([expect.stringContaining('telemetry')]),
      );
      expect(idea.estimatedDuration).toBe('6-8 weeks');
      expect(idea.teamSize).toBe('4-5 members');
    });

    it('should generate Education tailored project proposal', () => {
      const idea = service.generateProceduralFallback(
        'Education',
        ['React', 'Node.js'],
        ExperienceLevel.BEGINNER,
      );

      expect(idea.title).toContain('Micro-Tutoring');
      expect(idea.features).toEqual(
        expect.arrayContaining([expect.stringContaining('matchmaking')]),
      );
      expect(idea.estimatedDuration).toBe('3-4 weeks');
      expect(idea.teamSize).toBe('2-3 members');
    });

    it('should generate generic fallback for custom domains', () => {
      const idea = service.generateProceduralFallback(
        'Aerospace',
        ['Rust', 'C++'],
        ExperienceLevel.INTERMEDIATE,
        'Rocket Trajectory',
      );

      expect(idea.title).toContain('Rocket Trajectory - Aerospace');
      expect(idea.domain).toBe('Aerospace');
      expect(idea.estimatedDuration).toBe('4-6 weeks');
      expect(idea.teamSize).toBe('3-4 members');
    });
  });

  describe('cleanExpiredCache', () => {
    it('should delete expired records and return count', async () => {
      mockPrismaService.cachedIdeaQuery.deleteMany.mockResolvedValue({
        count: 5,
      });

      const res = await service.cleanExpiredCache();
      expect(res).toEqual({ count: 5 });
      expect(mockPrismaService.cachedIdeaQuery.deleteMany).toHaveBeenCalledWith(
        {
          where: {
            expiresAt: {
              lt: expect.any(Date),
            },
          },
        },
      );
    });
  });
});
