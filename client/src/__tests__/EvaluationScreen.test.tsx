import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { EvaluationScreen } from '../screens/Evaluation/EvaluationScreen';
import { evaluationService } from '../services/evaluationService';
import { workspaceService } from '../services/workspaceService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../services/evaluationService', () => ({
  evaluationService: {
    submitEvaluation: jest.fn(),
    getMyEvaluations: jest.fn(),
    getAllEvaluations: jest.fn(),
    updateEvaluation: jest.fn(),
  },
  validateEvaluationInput: jest.requireActual('../services/evaluationService').validateEvaluationInput,
  computeAverageScore: jest.requireActual('../services/evaluationService').computeAverageScore,
}));

jest.mock('../services/workspaceService', () => ({
  workspaceService: {
    getProjectMembers: jest.fn(),
    getWorkspaceOverview: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockMembers = [
  {
    id: 'member-1',
    projectId: 'proj-1',
    userId: 'user-2',
    role: 'MEMBER' as const,
    status: 'ACCEPTED' as const,
    joinedAt: new Date().toISOString(),
    user: {
      id: 'user-2',
      email: 'bob@example.com',
      profile: { fullName: 'Bob Jones' },
    },
  },
  {
    id: 'member-2',
    projectId: 'proj-1',
    userId: 'user-3',
    role: 'MEMBER' as const,
    status: 'ACCEPTED' as const,
    joinedAt: new Date().toISOString(),
    user: {
      id: 'user-3',
      email: 'carol@example.com',
      profile: { fullName: 'Carol White' },
    },
  },
];

const mockEvaluation = {
  id: 'eval-1',
  projectId: 'proj-1',
  evaluatorId: 'user-1',
  evaluateeId: 'user-2',
  technicalSkill: 4,
  communication: 3,
  teamwork: 5,
  reliability: 4,
  overallContribution: 4,
  comments: 'Great teammate!',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  evaluatee: {
    id: 'user-2',
    email: 'bob@example.com',
    profile: { fullName: 'Bob Jones' },
  },
};

const renderWithProviders = (props = {}) =>
  render(
    <ThemeProvider>
      <AuthProvider>
        <EvaluationScreen
          route={{ params: { projectId: 'proj-1', projectTitle: 'Test Project' } }}
          navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
          {...props}
        />
      </AuthProvider>
    </ThemeProvider>
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EvaluationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (workspaceService.getProjectMembers as jest.Mock).mockResolvedValue(mockMembers);
    (evaluationService.getMyEvaluations as jest.Mock).mockResolvedValue([]);
  });

  it('renders populated state with teammate chips after loading', async () => {
    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText('Bob Jones')).toBeTruthy();
      expect(getByText('Carol White')).toBeTruthy();
    });
  });

  it('renders empty state when no other members exist', async () => {
    (workspaceService.getProjectMembers as jest.Mock).mockResolvedValue([]);

    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText('No Teammates to Evaluate')).toBeTruthy();
    });
  });

  it('renders error state when data loading fails', async () => {
    (workspaceService.getProjectMembers as jest.Mock).mockRejectedValue(
      new Error('Server error')
    );

    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText(/Server error/i)).toBeTruthy();
    });
  });

  it('shows step 2 scoring section after selecting a teammate', async () => {
    const { getByText } = renderWithProviders();

    await waitFor(() => expect(getByText('Bob Jones')).toBeTruthy());

    fireEvent.press(getByText('Bob Jones'));

    await waitFor(() => {
      expect(getByText(/Rate Bob Jones/i)).toBeTruthy();
      expect(getByText('Technical Skill')).toBeTruthy();
      expect(getByText('Communication')).toBeTruthy();
      expect(getByText('Teamwork')).toBeTruthy();
      expect(getByText('Reliability')).toBeTruthy();
      expect(getByText('Overall Contribution')).toBeTruthy();
    });
  });

  it('submit button is disabled when not all scores are filled', async () => {
    const { getByText } = renderWithProviders();

    await waitFor(() => expect(getByText('Bob Jones')).toBeTruthy());
    fireEvent.press(getByText('Bob Jones'));

    await waitFor(() => expect(getByText('Submit Evaluation')).toBeTruthy());

    // Without filling scores the hint text should be shown
    expect(getByText('Score all 5 criteria to enable submission.')).toBeTruthy();
  });

  it('calls submitEvaluation with correct payload when all scores are set', async () => {
    (evaluationService.submitEvaluation as jest.Mock).mockResolvedValue({
      ...mockEvaluation,
    });

    const { getByText, getAllByText } = renderWithProviders();

    await waitFor(() => expect(getByText('Bob Jones')).toBeTruthy());
    fireEvent.press(getByText('Bob Jones'));

    await waitFor(() => expect(getByText('Technical Skill')).toBeTruthy());

    // Each criterion has 5 buttons labelled 1–5; pick score 4 for each
    // The score buttons render their number as text. There will be multiple "4" buttons.
    // We press each criteria's 4th score button (label "4").
    const fourButtons = getAllByText('4');
    // Should have at least 5 (one per criterion row)
    expect(fourButtons.length).toBeGreaterThanOrEqual(5);

    // Press first five "4" buttons — one per criterion
    for (let i = 0; i < 5; i++) {
      act(() => { fireEvent.press(fourButtons[i]); });
    }

    await waitFor(() => expect(getByText('Submit Evaluation')).toBeTruthy());
    fireEvent.press(getByText('Submit Evaluation'));

    await waitFor(() => {
      expect(evaluationService.submitEvaluation).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({
          evaluateeId: 'user-2',
          technicalSkill: 4,
          communication: 4,
          teamwork: 4,
          reliability: 4,
          overallContribution: 4,
        })
      );
    });
  });

  it('shows submitted evaluations in the Submitted tab', async () => {
    (evaluationService.getMyEvaluations as jest.Mock).mockResolvedValue([mockEvaluation]);

    const { getByText } = renderWithProviders();

    await waitFor(() => expect(getByText(/Submitted \(1\)/i)).toBeTruthy());

    fireEvent.press(getByText(/Submitted \(1\)/i));

    await waitFor(() => {
      expect(getByText('Bob Jones')).toBeTruthy();
      expect(getByText('Avg 4\/5')).toBeTruthy();
    });
  });

  it('shows already-evaluated warning when selecting a teammate with existing eval', async () => {
    (evaluationService.getMyEvaluations as jest.Mock).mockResolvedValue([mockEvaluation]);

    const { getByText } = renderWithProviders();

    await waitFor(() => expect(getByText('Bob Jones')).toBeTruthy());
    fireEvent.press(getByText('Bob Jones'));

    await waitFor(() => {
      expect(getByText(/already evaluated Bob Jones/i)).toBeTruthy();
    });
  });

  it('switches to Evaluate tab from Submitted empty state', async () => {
    (evaluationService.getMyEvaluations as jest.Mock).mockResolvedValue([]);

    const { getByText } = renderWithProviders();

    await waitFor(() => expect(getByText(/Submitted \(0\)/i)).toBeTruthy());
    fireEvent.press(getByText(/Submitted \(0\)/i));

    await waitFor(() => expect(getByText('No evaluations submitted yet')).toBeTruthy());

    fireEvent.press(getByText('Go to Form'));

    await waitFor(() => {
      // Back on the form tab — teammate chips should be visible
      expect(getByText('Bob Jones')).toBeTruthy();
    });
  });
});

// ─── Unit tests for service helpers ───────────────────────────────────────────

describe('evaluationService helpers', () => {
  const { validateEvaluationInput, computeAverageScore } = jest.requireActual(
    '../services/evaluationService'
  );

  describe('validateEvaluationInput', () => {
    const validInput = {
      evaluateeId: 'user-2',
      technicalSkill: 4,
      communication: 3,
      teamwork: 5,
      reliability: 4,
      overallContribution: 4,
    };

    it('returns null for a fully valid input', () => {
      expect(validateEvaluationInput(validInput)).toBeNull();
    });

    it('rejects a missing evaluateeId', () => {
      expect(validateEvaluationInput({ ...validInput, evaluateeId: '' })).toMatch(/required/i);
    });

    it('rejects a score of 0', () => {
      expect(validateEvaluationInput({ ...validInput, technicalSkill: 0 })).toBeTruthy();
    });

    it('rejects a score of 6', () => {
      expect(validateEvaluationInput({ ...validInput, communication: 6 })).toBeTruthy();
    });

    it('rejects a non-integer score', () => {
      expect(validateEvaluationInput({ ...validInput, teamwork: 3.5 })).toBeTruthy();
    });
  });

  describe('computeAverageScore', () => {
    it('computes correct average for 4/4/4/4/4', () => {
      expect(
        computeAverageScore({
          technicalSkill: 4,
          communication: 4,
          teamwork: 4,
          reliability: 4,
          overallContribution: 4,
        })
      ).toBe(4);
    });

    it('computes correct average for mixed scores', () => {
      expect(
        computeAverageScore({
          technicalSkill: 5,
          communication: 3,
          teamwork: 4,
          reliability: 4,
          overallContribution: 4,
        })
      ).toBe(4);
    });

    it('rounds to one decimal place', () => {
      expect(
        computeAverageScore({
          technicalSkill: 5,
          communication: 2,
          teamwork: 4,
          reliability: 3,
          overallContribution: 4,
        })
      ).toBe(3.6);
    });
  });
});
