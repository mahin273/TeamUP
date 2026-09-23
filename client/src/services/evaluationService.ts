import { api } from '../api/client';

export interface EvaluationCriteria {
  technicalSkill: number;      // 1–5
  communication: number;       // 1–5
  teamwork: number;            // 1–5
  reliability: number;         // 1–5
  overallContribution: number; // 1–5
}

export interface SubmitEvaluationInput extends EvaluationCriteria {
  evaluateeId: string;
  comments?: string;
}

export interface Evaluation {
  id: string;
  projectId: string;
  evaluatorId: string;
  evaluateeId: string;
  technicalSkill: number;
  communication: number;
  teamwork: number;
  reliability: number;
  overallContribution: number;
  comments?: string;
  createdAt: string;
  updatedAt: string;
  evaluatee?: {
    id: string;
    email: string;
    profile?: {
      fullName: string;
      avatarUrl?: string;
    };
  };
  evaluator?: {
    id: string;
    email: string;
    profile?: {
      fullName: string;
      avatarUrl?: string;
    };
  };
}

/** Compute the average score across all criteria */
export function computeAverageScore(evaluation: Evaluation | EvaluationCriteria): number {
  const sum =
    evaluation.technicalSkill +
    evaluation.communication +
    evaluation.teamwork +
    evaluation.reliability +
    evaluation.overallContribution;
  return Math.round((sum / 5) * 10) / 10;
}

/** Validate score inputs — must be integers 1–5 */
export function validateEvaluationInput(input: Partial<SubmitEvaluationInput>): string | null {
  const scoreFields: (keyof EvaluationCriteria)[] = [
    'technicalSkill',
    'communication',
    'teamwork',
    'reliability',
    'overallContribution',
  ];
  for (const field of scoreFields) {
    const val = input[field];
    if (val === undefined || val === null) return `${field} is required.`;
    if (!Number.isInteger(val) || val < 1 || val > 5)
      return `${field} must be a whole number between 1 and 5.`;
  }
  if (!input.evaluateeId?.trim()) return 'Teammate to evaluate is required.';
  return null;
}

export const evaluationService = {
  /**
   * Submit a new peer evaluation for a teammate in a project.
   * POST /projects/:id/evaluations
   */
  submitEvaluation: async (
    projectId: string,
    input: SubmitEvaluationInput
  ): Promise<Evaluation> => {
    return api.post<Evaluation>(`/projects/${projectId}/evaluations`, input);
  },

  /**
   * Get all evaluations submitted BY the current user in a project.
   * GET /projects/:id/evaluations/mine
   */
  getMyEvaluations: async (projectId: string): Promise<Evaluation[]> => {
    return api.get<Evaluation[]>(`/projects/${projectId}/evaluations/mine`);
  },

  /**
   * Get all evaluations for a project (leader view — may be restricted by backend).
   * GET /projects/:id/evaluations
   */
  getAllEvaluations: async (projectId: string): Promise<Evaluation[]> => {
    return api.get<Evaluation[]>(`/projects/${projectId}/evaluations`);
  },

  /**
   * Update an existing evaluation (if backend allows edits).
   * PATCH /projects/:id/evaluations/:evaluationId
   */
  updateEvaluation: async (
    projectId: string,
    evaluationId: string,
    input: Partial<EvaluationCriteria & { comments?: string }>
  ): Promise<Evaluation> => {
    return api.patch<Evaluation>(`/projects/${projectId}/evaluations/${evaluationId}`, input);
  },
};
