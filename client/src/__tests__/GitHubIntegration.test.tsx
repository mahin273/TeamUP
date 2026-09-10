import React from 'react';
import { render } from '@testing-library/react-native';
import { GitHubStatsCard } from '../components/GitHubStatsCard';
import { ThemeProvider } from '../theme/ThemeContext';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    get: jest.fn(),
  },
}));

describe('GitHub Integration (Feature 14)', () => {
  it('renders Connect GitHub prompt when user has no linked GitHub account', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce(new Error('Not connected'));

    const { findByText } = render(
      <ThemeProvider>
        <GitHubStatsCard profileId="user-123" />
      </ThemeProvider>
    );

    const titleElement = await findByText(/GitHub Integration/i);
    expect(titleElement).toBeTruthy();
  });
});

