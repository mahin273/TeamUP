import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExperienceLevel, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateIdeaDto } from './dto/generate-idea.dto';
import { GeneratedIdea } from './interfaces/generated-idea.interface';
import { LlmClient } from './llm.client';

const DEFAULT_CACHE_TTL_HOURS = 24;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  choices?: Array<{
    message?: { content?: string };
  }>;
}

interface LlmParsedOutput {
  title?: string;
  description?: string;
  problem?: string;
  domain?: string;
  techStack?: string[];
  difficulty?: ExperienceLevel;
  estimatedDuration?: string;
  teamSize?: string;
  features?: string[];
  roadmap?: string[];
}

@Injectable()
export class AiIdeaService {
  private readonly logger = new Logger(AiIdeaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly llmClient: LlmClient,
  ) {}

  /**
   * Main entrypoint for generating an AI project idea with query caching
   */
  async generateIdea(dto: GenerateIdeaDto): Promise<GeneratedIdea> {
    if (
      dto.simulateFailure ||
      this.configService.get<string>('SIMULATE_LLM_FAILURE') === 'true'
    ) {
      throw new ServiceUnavailableException(
        'LLM Service Busy — AI generator is experiencing high demand. Please try again in a moment.',
      );
    }

    if (!dto.domain || !dto.domain.trim()) {
      throw new BadRequestException('domain is required');
    }

    const domain = dto.domain.trim();
    const rawTechs: string[] = [];
    if (dto.tech && typeof dto.tech === 'string') {
      rawTechs.push(...dto.tech.split(','));
    }
    if (Array.isArray(dto.techStack)) {
      rawTechs.push(...dto.techStack);
    }
    if (dto.techInterest && typeof dto.techInterest === 'string') {
      rawTechs.push(...dto.techInterest.split(','));
    }

    const techStack = [
      ...new Set(rawTechs.map((t) => t.trim()).filter(Boolean)),
    ];
    if (techStack.length === 0) {
      throw new BadRequestException('tech is required');
    }

    const difficulty = dto.difficulty || ExperienceLevel.INTERMEDIATE;

    const queryHash = this.computeHash(domain, techStack, difficulty);

    // 1. Check DB query cache
    const cached = await this.checkCache(queryHash);
    if (cached) {
      this.logger.log(`Cache hit for query hash: ${queryHash}`);
      return {
        ...cached,
        stack: (cached as any).stack || cached.techStack,
        isCached: true,
      };
    }

    this.logger.log(
      `Cache miss for query hash: ${queryHash}. Generating idea.`,
    );

    // 2. Generate idea via LLM or procedural generator
    const generated = await this.callLlm(
      dto.topic,
      domain,
      techStack,
      difficulty,
    );

    // 3. Store result in DB cache
    await this.saveToCache(queryHash, domain, techStack.join(', '), generated);

    return {
      ...generated,
      stack: (generated as any).stack || generated.techStack,
      isCached: false,
    };
  }

  /**
   * Generates a deterministic SHA-256 hash for query normalization
   */
  computeHash(domain: string, techStack: string[], difficulty: string): string {
    const normDomain = domain.trim().toLowerCase();
    const normTechs = [...techStack]
      .map((t) => t.trim().toLowerCase())
      .sort()
      .join(',');
    const normDifficulty = (difficulty || 'INTERMEDIATE').trim().toUpperCase();
    const rawKey = `${normDomain}|${normTechs}|${normDifficulty}`;
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Checks if an unexpired query result exists in DB cache
   */
  async checkCache(queryHash: string): Promise<GeneratedIdea | null> {
    const cached = await this.prisma.cachedIdeaQuery.findUnique({
      where: { queryHash },
    });

    if (!cached) {
      return null;
    }

    if (cached.expiresAt > new Date()) {
      return cached.resultJson as unknown as GeneratedIdea;
    }

    // Prune expired entry asynchronously
    this.prisma.cachedIdeaQuery
      .delete({ where: { queryHash } })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to prune expired cache entry: ${msg}`);
      });

    return null;
  }

  /**
   * Persists generated idea in DB cache with a configurable TTL
   */
  async saveToCache(
    queryHash: string,
    domain: string,
    techInterest: string,
    result: GeneratedIdea,
  ): Promise<void> {
    const ttlHours =
      Number(this.configService.get<string>('LLM_CACHE_TTL_HOURS')) ||
      DEFAULT_CACHE_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.prisma.cachedIdeaQuery.upsert({
      where: { queryHash },
      create: {
        queryHash,
        domain,
        techInterest,
        resultJson: result as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
      update: {
        resultJson: result as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  }

  /**
   * Deletes all expired cache entries from the database
   */
  async cleanExpiredCache(): Promise<{ count: number }> {
    const result = await this.prisma.cachedIdeaQuery.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return { count: result.count };
  }

  /**
   * Calls an external LLM API requesting structured JSON output
   */
  private async callLlm(
    topic: string | undefined,
    domain: string,
    techStack: string[],
    difficulty: ExperienceLevel,
  ): Promise<GeneratedIdea> {
    const promptText = `You are a software architect and university project advisor.
Generate an innovative, feasible student capstone or hackathon project idea tailored to these requirements:
Domain: ${domain}
Tech Stack: ${techStack.join(', ')}
Difficulty Level: ${difficulty}
${topic ? `Focus Topic: ${topic}` : ''}

Respond ONLY with a valid JSON object matching this exact structure:
{
  "title": "string (concise and catchy project title)",
  "description": "string (2-3 sentences overview)",
  "problem": "string (1-2 sentences stating the problem being solved)",
  "domain": "${domain}",
  "techStack": ${JSON.stringify(techStack)},
  "difficulty": "${difficulty}",
  "estimatedDuration": "string (e.g. 4 weeks, 6 weeks)",
  "teamSize": "string (e.g. 3 members, 3-4 members)",
  "features": ["string (3-5 core MVP features)"],
  "roadmap": ["string (3-4 milestone development phases)"]
}`;

    try {
      let rawJson = '';
      if (this.llmClient) {
        rawJson = await this.llmClient.complete(promptText);
      }

      // Strip markdown code fences if present
      const cleaned = (rawJson || '')
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as LlmParsedOutput;

      if (
        !parsed ||
        !parsed.title ||
        !parsed.problem ||
        !parsed.features ||
        !parsed.roadmap
      ) {
        return this.generateProceduralFallback(
          domain,
          techStack,
          difficulty,
          topic,
        );
      }

      return {
        id: `gen-${crypto.randomUUID()}`,
        title: parsed.title,
        description:
          parsed.description ||
          `An automated platform solving key challenges in ${domain}.`,
        problem:
          parsed.problem ||
          `Students and professionals face inefficiencies in ${domain} workflows.`,
        domain: parsed.domain || domain,
        techStack:
          Array.isArray(parsed.techStack) && parsed.techStack.length > 0
            ? parsed.techStack
            : techStack,
        difficulty: (parsed.difficulty as ExperienceLevel) || difficulty,
        estimatedDuration:
          parsed.estimatedDuration ||
          this.getEstimatedDurationByDifficulty(difficulty),
        teamSize: parsed.teamSize || this.getTeamSizeByDifficulty(difficulty),
        features: Array.isArray(parsed.features)
          ? parsed.features
          : ['Core API & Data Layer', 'Responsive UI', 'Real-time Updates'],
        roadmap: Array.isArray(parsed.roadmap)
          ? parsed.roadmap
          : ['Phase 1: Setup', 'Phase 2: Core MVP', 'Phase 3: Launch'],
      };
    } catch (err: unknown) {
      this.logger.warn(
        `LLM failed, falling back to procedural generation: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.generateProceduralFallback(
        domain,
        techStack,
        difficulty,
        topic,
      );
    }
  }

  /**
   * Procedural fallback generator when LLM API key is not configured or in offline/test mode
   */
  generateProceduralFallback(
    domain: string,
    techStack: string[],
    difficulty: ExperienceLevel,
    topic?: string,
  ): GeneratedIdea {
    const duration = this.getEstimatedDurationByDifficulty(difficulty);
    const teamSize = this.getTeamSizeByDifficulty(difficulty);
    const techDisplay = techStack.join(', ');
    const lowerDomain = domain.toLowerCase();

    if (lowerDomain.includes('fintech') || lowerDomain.includes('finance')) {
      return {
        id: `gen-${crypto.randomUUID()}`,
        title: `${domain} Automated Budget Assistant`,
        description: `An AI-powered expense splitting and budget forecasting app for student teams built with ${techDisplay}.`,
        problem:
          'Student teams and roommates struggle to transparently track shared expenses and divide utility bills.',
        domain,
        techStack,
        difficulty,
        estimatedDuration: duration,
        teamSize,
        features: [
          'OCR receipt scanning',
          'Automated bill division',
          'Real-time debt reconciliation and settlement alerts',
          'Monthly budget forecasting and visual analytics',
        ],
        roadmap: [
          'Phase 1: Database schema, authentication, and core transaction models',
          'Phase 2: Receipt OCR ingestion pipeline and expense splitting logic',
          'Phase 3: Real-time settlement notifications and peer balance tracking',
          'Phase 4: Analytics dashboard, export features, and user testing',
        ],
      };
    }

    if (lowerDomain.includes('health') || lowerDomain.includes('medical')) {
      return {
        id: `gen-${crypto.randomUUID()}`,
        title: `${domain} Remote Patient Vitals & Triage System`,
        description: `A secure telehealth monitoring platform built with ${techDisplay} to collect telemetry and prioritize patient care.`,
        problem:
          'Clinics face bottlenecks in continuously tracking outpatient vitals and triaging acute medical symptoms.',
        domain,
        techStack,
        difficulty,
        estimatedDuration: duration,
        teamSize,
        features: [
          'Secure telemetry vital signs ingestion',
          'Automated risk-level patient triage scoring',
          'Encrypted provider-patient messaging and push alerts',
          'Historical trend visualization and anomaly detection',
        ],
        roadmap: [
          'Phase 1: HIPAA-compliant data schema and secure auth lifecycle',
          'Phase 2: Telemetry ingestion pipeline and clinical triage rules',
          'Phase 3: Real-time practitioner alert dispatch and chat channels',
          'Phase 4: Clinician portal, analytics charts, and end-to-end audit',
        ],
      };
    }

    if (lowerDomain.includes('edu') || lowerDomain.includes('learning')) {
      return {
        id: `gen-${crypto.randomUUID()}`,
        title: `${domain} Collaborative Micro-Tutoring Network`,
        description: `An on-demand peer mentoring and knowledge-sharing platform built with ${techDisplay}.`,
        problem:
          'Students struggle to find immediate help with coursework and programming bugs outside of limited instructor office hours.',
        domain,
        techStack,
        difficulty,
        estimatedDuration: duration,
        teamSize,
        features: [
          'Skill-based student-to-mentor matchmaking algorithm',
          'Interactive collaborative code editor and whiteboard',
          'Automated session scheduling and calendar integration',
          'Reputation scoring and peer evaluation system',
        ],
        roadmap: [
          'Phase 1: Profile skill tags and availability modeling',
          'Phase 2: Matching engine and meeting scheduler integration',
          'Phase 3: Real-time interactive session room and whiteboard',
          'Phase 4: Peer review system, karma scoring, and mobile polish',
        ],
      };
    }

    // General fallback for all other domains
    const titlePrefix = topic ? `${topic} - ` : '';
    return {
      id: `gen-${crypto.randomUUID()}`,
      title: `${titlePrefix}${domain} Smart Workflow Platform`,
      description: `An intelligent collaboration and management platform leveraging ${techDisplay} to automate team operations and provide real-time insights.`,
      problem: `Teams working in ${domain} lack an integrated, automated solution to streamline project coordination and reduce manual overhead.`,
      domain,
      techStack,
      difficulty,
      estimatedDuration: duration,
      teamSize,
      features: [
        `Automated ${domain} task orchestration and state tracking`,
        'Role-based collaboration workspace with audit logging',
        'Real-time updates and push notification alerts',
        'Comprehensive reporting dashboard with data visualization',
      ],
      roadmap: [
        'Phase 1: System requirements, schema design, and auth foundations',
        'Phase 2: Core domain business logic and workflow engine',
        'Phase 3: Integration with notification and reporting services',
        'Phase 4: End-to-end testing, performance optimization, and deployment',
      ],
    };
  }

  private getEstimatedDurationByDifficulty(
    difficulty: ExperienceLevel,
  ): string {
    switch (difficulty) {
      case ExperienceLevel.BEGINNER:
        return '3-4 weeks';
      case ExperienceLevel.ADVANCED:
        return '6-8 weeks';
      case ExperienceLevel.INTERMEDIATE:
      default:
        return '4-6 weeks';
    }
  }

  private getTeamSizeByDifficulty(difficulty: ExperienceLevel): string {
    switch (difficulty) {
      case ExperienceLevel.BEGINNER:
        return '2-3 members';
      case ExperienceLevel.ADVANCED:
        return '4-5 members';
      case ExperienceLevel.INTERMEDIATE:
      default:
        return '3-4 members';
    }
  }
}
