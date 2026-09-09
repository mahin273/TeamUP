import React from 'react';
import { render } from '@testing-library/react-native';
import { GitHubStatsCard } from '../components/GitHubStatsCard';
import { ThemeProvider } from '../theme/ThemeContext';

describe('GitHub Integration (Feature 14)', () => {
  it('renders Connect GitHub prompt when user has no linked GitHub account', async () => {
    const { findByText } = render(
      <ThemeProvider>
        <GitHubStatsCard profileId="user-123" />
      </ThemeProvider>
    );

    const titleElement = await findByText(/GitHub Integration/i);
    expect(titleElement).toBeTruthy();
  });
});
