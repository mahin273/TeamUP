import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { UserProfileScreen } from '../screens/Profile/UserProfileScreen';
import { ThemeProvider } from '../theme/ThemeContext';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, status?: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

describe('UserProfileScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const mockRoute = {
    params: {
      userId: 'user-alice-123',
      userName: 'Alice Johnson',
      projectId: 'project-1',
      invited: false,
    },
  };

  const mockProfileData = {
    id: 'prof-alice-123',
    userId: 'user-alice-123',
    fullName: 'Alice Johnson',
    email: 'alice@university.edu',
    department: 'Computer Science',
    semester: 'Fall 2026',
    experienceLevel: 'ADVANCED',
    availability: true,
    bio: 'Fullstack React Native developer interested in building distributed applications.',
    githubUsername: 'alicejohnson',
    portfolioUrl: 'https://alice.dev',
    user: {
      id: 'user-alice-123',
      email: 'alice@university.edu',
      role: 'STUDENT',
    },
    skills: [
      { id: 'sk-1', skillName: 'React Native', level: 'ADVANCED' },
      { id: 'sk-2', skillName: 'TypeScript', level: 'INTERMEDIATE' },
      { id: 'sk-3', skillName: 'Node.js', level: 'ADVANCED' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user details, badges, bio, and technical skills', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/profiles/user-alice-123/github')) {
        return Promise.resolve({
          username: 'alicejohnson',
          publicRepos: 18,
          contributionsThisYear: 320,
          topLanguages: ['TypeScript', 'JavaScript'],
          connected: true,
        });
      }
      if (url.includes('/profiles/user-alice-123')) {
        return Promise.resolve(mockProfileData);
      }
      return Promise.resolve({});
    });

    const { findByText } = render(
      <ThemeProvider>
        <UserProfileScreen route={mockRoute} navigation={mockNavigation} />
      </ThemeProvider>
    );

    expect(await findByText('Alice Johnson')).toBeTruthy();
    expect(await findByText('alice@university.edu')).toBeTruthy();
    expect(await findByText('Computer Science')).toBeTruthy();
    expect(await findByText('Fall 2026')).toBeTruthy();
    expect(await findByText('ADVANCED')).toBeTruthy();
    expect(await findByText('Available for Teams')).toBeTruthy();
    expect(
      await findByText(
        'Fullstack React Native developer interested in building distributed applications.'
      )
    ).toBeTruthy();
    expect(await findByText('React Native (ADVANCED)')).toBeTruthy();
    expect(await findByText('TypeScript (INTERMEDIATE)')).toBeTruthy();
  });

  it('calls navigation.goBack when Back button is pressed', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockProfileData);

    const { getByLabelText } = render(
      <ThemeProvider>
        <UserProfileScreen route={mockRoute} navigation={mockNavigation} />
      </ThemeProvider>
    );

    const backBtn = getByLabelText('Go back');
    fireEvent.press(backBtn);

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('handles project invite action successfully', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockProfileData);
    (api.post as jest.Mock).mockResolvedValue({ success: true });

    const { findByText } = render(
      <ThemeProvider>
        <UserProfileScreen route={mockRoute} navigation={mockNavigation} />
      </ThemeProvider>
    );

    const inviteBtn = await findByText('Invite to Project');
    expect(inviteBtn).toBeTruthy();

    fireEvent.press(inviteBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/projects/project-1/invite', {
        targetUserId: 'user-alice-123',
      });
    });

    expect(await findByText('Invitation Sent')).toBeTruthy();
  });

  it('renders already invited state when route specifies invited=true', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockProfileData);

    const invitedRoute = {
      params: {
        ...mockRoute.params,
        invited: true,
      },
    };

    const { findByText } = render(
      <ThemeProvider>
        <UserProfileScreen route={invitedRoute} navigation={mockNavigation} />
      </ThemeProvider>
    );

    expect(await findByText('Invitation Sent')).toBeTruthy();
  });

  it('renders error state when profile fetching fails and allows retry', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce(
      new Error('Network error loading profile')
    );

    const { findByText } = render(
      <ThemeProvider>
        <UserProfileScreen route={mockRoute} navigation={mockNavigation} />
      </ThemeProvider>
    );

    expect(
      await findByText('Network error loading profile')
    ).toBeTruthy();

    (api.get as jest.Mock).mockResolvedValueOnce(mockProfileData);
    const retryBtn = await findByText('Try Again');
    fireEvent.press(retryBtn);

    expect(await findByText('Alice Johnson')).toBeTruthy();
  });
});
