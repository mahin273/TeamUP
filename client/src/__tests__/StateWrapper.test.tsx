import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { StateWrapper } from '../components/StateWrapper';
import { ThemeProvider } from '../theme/ThemeContext';

describe('StateWrapper Component', () => {
  it('renders children when state is populated', () => {
    const { getByText } = render(
      <ThemeProvider>
        <StateWrapper state="populated">
          <Text>Content Loaded</Text>
        </StateWrapper>
      </ThemeProvider>
    );

    expect(getByText('Content Loaded')).toBeTruthy();
  });

  it('renders empty title when state is empty', () => {
    const { getByText } = render(
      <ThemeProvider>
        <StateWrapper state="empty" emptyTitle="No Items Found" />
      </ThemeProvider>
    );

    expect(getByText('No Items Found')).toBeTruthy();
  });

  it('renders error message when state is error', () => {
    const { getByText } = render(
      <ThemeProvider>
        <StateWrapper state="error" errorMessage="Failed to load items" />
      </ThemeProvider>
    );

    expect(getByText('Failed to load items')).toBeTruthy();
  });
});
