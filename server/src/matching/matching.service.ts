import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExperienceLevel, MemberStatus } from '@prisma/client';
import { MatchingCandidate } from './interfaces/matching-candidate.interface';

const LEVEL_RANKS: Record<ExperienceLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

interface CachedStatsJson {
  publicRepos?: number;
  contributionsThisYear?: number;
  totalStars?: number;
  topLanguages?: string[];
}

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a ranked list of recommended teammate candidates for a project.
   * Uses the explainable 4-factor scoring formula from Design Doc §4.1:
   *   score = (skillOverlapCount / requiredSkillsCount) * 0.5
   *         + experienceLevelMatch * 0.2
   *         + avgPastEvaluationScore * 0.2
   *         + availabilityMatch * 0.1
   */
  async getRecommendations(
    projectId: string,
    requesterUserId?: string,
  ): Promise<MatchingCandidate[]> {
    // 1. Fetch project with required skills and current members
    let project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requiredSkills: {
          include: {
            skill: true,
          },
        },
        members: {
          select: {
            userId: true,
            status: true,
          },
        },
      },
    });

    if (!project) {
      const skillTerms = projectId
        .split(/[,+]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const matchedSkills = this.prisma.skill
        ? await this.prisma.skill.findMany({
            where: {
              OR: skillTerms.map((term) => ({
                name: { contains: term, mode: 'insensitive' },
              })),
            },
          })
        : [];

      if (matchedSkills.length > 0) {
        project = {
          id: projectId,
          creatorId: requesterUserId || '',
          requiredSkills: matchedSkills.map((s) => ({
            id: s.id,
            projectId,
            skillId: s.id,
            minimumExperience: ExperienceLevel.BEGINNER,
            skill: s,
          })),
          members: [],
        } as any;
      } else {
        throw new NotFoundException(
          `No project or skills matching '${projectId}' found`,
        );
      }
    }

    const targetProject = project!;

    if (
      requesterUserId &&
      targetProject.creatorId &&
      targetProject.creatorId !== requesterUserId
    ) {
      throw new ForbiddenException(
        'Only the project owner can view recommendations',
      );
    }

    // 2. Build exclusion list (project creator + accepted active team members + requester)
    const excludedUserIds = new Set<string>([
      targetProject.creatorId,
      ...targetProject.members
        .filter((m) => m.status === MemberStatus.ACCEPTED)
        .map((m) => m.userId),
    ]);

    if (requesterUserId) {
      excludedUserIds.add(requesterUserId);
    }

    // Track pending invites/applications for the "invited" flag
    const pendingInvitedUserIds = new Set<string>(
      targetProject.members
        .filter((m) => m.status === MemberStatus.PENDING)
        .map((m) => m.userId),
    );

    // 3. Fetch candidate student profiles
    const candidateProfiles = await this.prisma.profile.findMany({
      where: {
        userId: {
          notIn: Array.from(excludedUserIds).filter(Boolean),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            evaluationsReceived: {
              select: {
                score: true,
              },
            },
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });

    const requiredSkills = targetProject.requiredSkills;
    const requiredSkillIds = requiredSkills.map((rs) => rs.skillId);
    const requiredSkillsCount = requiredSkillIds.length;

    // 4. Compute multi-factor compatibility score for each candidate
    const candidates: MatchingCandidate[] = candidateProfiles.map(
      (candidate) => {
        // Map candidate's skills by skillId
        const candidateSkillsMap = new Map(
          candidate.skills.map((cs) => [cs.skillId, cs]),
        );

        // A. Skill Overlap (Weight: 50%)
        const matchingSkillEntities = requiredSkills.filter((rs) =>
          candidateSkillsMap.has(rs.skillId),
        );
        const matchingSkillNames = matchingSkillEntities.map(
          (rs) => rs.skill.name,
        );

        let skillOverlapRatio = 0.5; // Baseline if project has no required skills
        if (requiredSkillsCount > 0) {
          skillOverlapRatio =
            matchingSkillEntities.length / requiredSkillsCount;
        }

        // B. Experience Level Fit (Weight: 20%)
        let experienceFit = 0.5; // Neutral baseline
        if (matchingSkillEntities.length > 0) {
          let totalExpScore = 0;
          for (const req of matchingSkillEntities) {
            const candSkill = candidateSkillsMap.get(req.skillId);
            const candProficiency =
              candSkill?.proficiencyLevel ?? ExperienceLevel.BEGINNER;
            const reqMinExp = req.minimumExperience ?? ExperienceLevel.BEGINNER;

            const candRank = LEVEL_RANKS[candProficiency] ?? 1;
            const reqRank = LEVEL_RANKS[reqMinExp] ?? 1;

            if (candRank >= reqRank) {
              totalExpScore += 1.0;
            } else if (candRank === reqRank - 1) {
              totalExpScore += 0.6;
            } else {
              totalExpScore += 0.3;
            }
          }
          experienceFit = totalExpScore / matchingSkillEntities.length;
        } else if (candidate.experienceLevel) {
          // If no skills overlap, use candidate's overall profile level
          const overallRank = LEVEL_RANKS[candidate.experienceLevel] ?? 1;
          experienceFit = overallRank / 3.0;
        }

        // C. Peer Evaluation History (Weight: 20%)
        const evaluations = candidate.user?.evaluationsReceived ?? [];
        let peerRatingScore = 0.7; // Default Bayesian prior (3.5 / 5.0) for new students
        if (evaluations.length > 0) {
          const totalRating = evaluations.reduce((sum, e) => sum + e.score, 0);
          const avgRating = totalRating / evaluations.length;
          // Normalize rating (e.g. 5.0 scale -> 1.0)
          peerRatingScore = Math.min(Math.max(avgRating / 5.0, 0), 1.0);
        }

        // D. Availability Status (Weight: 10%)
        const availabilityScore = candidate.availability ? 1.0 : 0.0;

        // Final Linear Combination
        const rawScore =
          skillOverlapRatio * 0.5 +
          experienceFit * 0.2 +
          peerRatingScore * 0.2 +
          availabilityScore * 0.1;

        const matchScore = Math.min(
          Math.max(Math.round(rawScore * 100), 0),
          100,
        );

        // GitHub cached contribution stats
        const ghStats = candidate.githubStats as CachedStatsJson | null;

        return {
          id: candidate.id,
          userId: candidate.userId,
          fullName: candidate.fullName,
          email: candidate.user?.email,
          avatarUrl: candidate.avatarUrl ?? undefined,
          bio: candidate.bio ?? undefined,
          department: candidate.department ?? undefined,
          semester: candidate.semester ?? undefined,
          experienceLevel: candidate.experienceLevel,
          matchScore,
          matchingSkills: matchingSkillNames,
          skills: candidate.skills.map((s) => ({
            id: s.skillId,
            skillName: s.skill.name,
          })),
          githubUsername: candidate.githubUsername ?? undefined,
          contributionsThisYear: ghStats?.contributionsThisYear ?? 0,
          publicRepos: ghStats?.publicRepos ?? 0,
          invited: pendingInvitedUserIds.has(candidate.userId),
        };
      },
    );

    // 5. Sort candidates descending by matchScore (highest score first)
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    return candidates;
  }

  calculateScore(p: {
    overlapCount: number;
    requiredCount: number;
    experienceMatch: number;
    avgEvaluation: number;
    availabilityMatch: number;
  }): number {
    const skillPart =
      p.requiredCount === 0
        ? 0
        : Math.min(p.overlapCount / p.requiredCount, 1.0);
    const total =
      skillPart * 0.5 +
      p.experienceMatch * 0.2 +
      p.avgEvaluation * 0.2 +
      p.availabilityMatch * 0.1;
    return Math.min(Math.max(total, 0), 1.0);
  }
}
