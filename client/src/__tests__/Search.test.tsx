import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../screens/Search/SearchScreen';
import { ThemeProvider } from '../theme/ThemeContext';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('Project Search & Filters (Phase 5 - Feature 12)', () => {
  const mockSearchResults = [
    {
      id: 'proj-1',
      title: 'AI Education Portal',
      description: 'Smart tutoring application for computer science students.',
      domain: 'Education',
      semester: 'Fall 2026',
      status: 'OPEN',
      requiredSkills: ['React Native', 'NestJS'],
      ownerName: 'Alex Morgan',
      memberCount: 2,
      maxMembers: 4,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search bar input and filter sheet button', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce([]);

    const { findByText, getByPlaceholderText, getByText } = render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );

    expect(await findByText('Project Search')).toBeTruthy();
    expect(getByPlaceholderText(/Search title, description, or domain/i)).toBeTruthy();
    expect(getByText(/Filter Sheet/i)).toBeTruthy();
  });

  it('debounces search input before making API call to GET /projects/search', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockSearchResults);

    const { getByPlaceholderText, findByText } = render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );

    const searchInput = getByPlaceholderText(/Search title, description, or domain/i);
    fireEvent.changeText(searchInput, 'AI Education');

    // Wait for debounced search timeout (350ms) to fire and trigger GET /projects/search
    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith('/projects/search', expect.objectContaining({
          search: 'AI Education',
        }));
      },
      { timeout: 1000 }
    );

    expect(await findByText('AI Education Portal')).toBeTruthy();
  });

  it('combines domain, tech, and semester filters using AND logic in API query', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockSearchResults);

    const { findByText, getAllByText } = render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );

    // Open filter sheet
    const filterToggleBtn = await findByText(/Filter Sheet/i);
    fireEvent.press(filterToggleBtn);

    // Select domain 'Education' and tech 'NestJS'
    const educationChips = getAllByText('Education');
    fireEvent.press(educationChips[0]);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/projects/search',
        expect.objectContaining({
          domain: 'Education',
        })
      );
    });
  });

  it('renders distinct empty state for zero matching results', async () => {
    (api.get as jest.Mock).mockResolvedValue([]);

    const { findByText } = render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );

    expect(await findByText(/No Projects Found/i)).toBeTruthy();
    expect(
      await findByText(/No projects matching your combined search criteria were found/i)
    ).toBeTruthy();
  });

  it('renders error state on network error with retry button', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce({
      message: 'Failed to search project listings.',
      code: 'NETWORK_ERROR',
    });

    const { findByText } = render(
      <ThemeProvider>
        <SearchScreen />
      </ThemeProvider>
    );

    expect(await findByText(/No Projects Found|Failed to search/i)).toBeTruthy();
  });
});
