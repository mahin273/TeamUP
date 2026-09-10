import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MatchingScreen } from '../screens/Matching/MatchingScreen';
import { ThemeProvider } from '../theme/ThemeContext';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('Skill-Based Matching (Phase 3 - Feature 2)', () => {
  const mockCandidates = [
    {
      id: 'user-1',
      userId: 'user-1',
      fullName: 'Alice Johnson',
      email: 'alice@university.edu',
      bio: 'Fullstack React Native & Node developer',
      department: 'Computer Science',
      experienceLevel: 'ADVANCED',
      matchScore: 0.95, // Raw float match score
      matchingSkills: ['React Native', 'TypeScript', 'Node.js'],
      githubUsername: 'alicejohnson',
      publicRepos: 12,
      contributionsThisYear: 320,
    },
    {
      id: 'user-2',
      userId: 'user-2',
      fullName: 'Bob Smith',
      email: 'bob@university.edu',
      bio: 'Frontend designer and UI enthusiast',
      department: 'Software Engineering',
      experienceLevel: 'INTERMEDIATE',
      matchScore: 0.72,
      matchingSkills: ['Figma', 'React Native'],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ranked candidate list with formatted match score percentage badges', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockCandidates);

    const { findByText, getByText, getAllByText } = render(
      <ThemeProvider>
        <MatchingScreen />
      </ThemeProvider>
    );

    // Verify recommendations API call was made for project-1
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/projects/project-1/recommendations');
    });

    // Check candidate names
    expect(await findByText('Alice Johnson')).toBeTruthy();
    expect(getByText('Bob Smith')).toBeTruthy();

    // Crucial check: Match score formatted as readable percentage badge, not raw float 0.95 or 0.72
    expect(getByText('95% Match')).toBeTruthy();
    expect(getByText('72% Match')).toBeTruthy();

    // Check matching skills
    expect(getAllByText('React Native').length).toBeGreaterThan(0);
    expect(getByText('TypeScript')).toBeTruthy();
  });

  it('handles optimistic invite action and transitions to Invited state', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockCandidates);
    (api.post as jest.Mock).mockResolvedValueOnce({ success: true });

    const { findByText, getAllByText } = render(
      <ThemeProvider>
        <MatchingScreen />
      </ThemeProvider>
    );

    await findByText('Alice Johnson');

    const inviteButtons = getAllByText('Invite to Team');
    expect(inviteButtons.length).toBeGreaterThan(0);

    // Trigger invite action for first candidate (Alice)
    fireEvent.press(inviteButtons[0]);

    // Check API payload sent to POST /projects/:id/invite
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/projects/project-1/invite', {
        userId: 'user-1',
        role: 'MEMBER',
      });
    });

    // Verify transition to Invited state badge
    expect(await findByText('Invited ✓')).toBeTruthy();
  });

  it('handles invitation failure and allows retry', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(mockCandidates);
    (api.post as jest.Mock).mockRejectedValueOnce({
      message: 'Candidate is already invited or unavailable.',
    });

    const { findByText, getAllByText, getByText } = render(
      <ThemeProvider>
        <MatchingScreen />
      </ThemeProvider>
    );

    await findByText('Alice Johnson');

    const inviteButtons = getAllByText('Invite to Team');
    fireEvent.press(inviteButtons[0]);

    // Check error handling
    expect(
      await findByText(/Candidate is already invited or unavailable/i)
    ).toBeTruthy();
    expect(getByText('Retry Invitation')).toBeTruthy();
  });

  it('renders empty state when no matching candidates are returned', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce([]);

    const { findByText } = render(
      <ThemeProvider>
        <MatchingScreen />
      </ThemeProvider>
    );

    expect(await findByText(/No Candidates Found/i)).toBeTruthy();
  });

  it('renders error state when recommendations endpoint fails', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce({
      message: 'Failed to fetch recommendations from server',
      code: 'SERVER_ERROR',
    });

    const { findByText } = render(
      <ThemeProvider>
        <MatchingScreen />
      </ThemeProvider>
    );

    expect(
      await findByText(/Failed to fetch recommendations from server/i)
    ).toBeTruthy();
  });
});
