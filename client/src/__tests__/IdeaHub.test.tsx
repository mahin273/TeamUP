import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { IdeaHubScreen } from '../screens/IdeaHub/IdeaHubScreen';
import { ThemeProvider } from '../theme/ThemeContext';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('Idea Hub & AI Idea Generator (Phase 4 - Features 11 & 18)', () => {
  const mockGeneratedIdea = {
    id: 'gen-123',
    title: 'Fintech Automated Budget Assistant',
    description: 'An AI-powered expense splitting and budget forecasting app for student teams.',
    domain: 'Fintech',
    techStack: ['React Native', 'NestJS'],
    difficulty: 'INTERMEDIATE',
    estimatedDuration: '4 weeks',
    teamSize: '3 members',
    features: ['OCR receipt scanning', 'Automated bill division'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders generator form controls and tab switcher', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce([]);

    const { getByText, findByText } = render(
      <ThemeProvider>
        <IdeaHubScreen />
      </ThemeProvider>
    );

    expect(await findByText('Idea Hub & AI Generator')).toBeTruthy();
    expect(getByText('1. Select Target Domain')).toBeTruthy();
    expect(getByText('2. Target Tech Stack')).toBeTruthy();
    expect(getByText('3. Difficulty Level')).toBeTruthy();
  });

  it('submits idea generation request to POST /ideas/generate and displays result card', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce([]);
    (api.post as jest.Mock).mockResolvedValueOnce(mockGeneratedIdea);

    const { findByText, getByText } = render(
      <ThemeProvider>
        <IdeaHubScreen />
      </ThemeProvider>
    );

    const generateBtn = await findByText('Generate Project Idea with AI 🪄');
    fireEvent.press(generateBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ideas/generate', {
        domain: 'Fintech',
        techStack: ['React Native', 'NestJS'],
        difficulty: 'INTERMEDIATE',
      });
    });

    expect(await findByText('Fintech Automated Budget Assistant')).toBeTruthy();
    expect(getByText(/OCR receipt scanning/i)).toBeTruthy();
  });

  it('handles LLM failure gracefully showing fallback banner without crashing', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce([]);
    (api.post as jest.Mock).mockRejectedValueOnce({
      message: 'LLM Service Busy — AI generator is experiencing high demand. Please try again in a moment.',
    });

    const { findByText } = render(
      <ThemeProvider>
        <IdeaHubScreen />
      </ThemeProvider>
    );

    const generateBtn = await findByText('Generate Project Idea with AI 🪄');
    fireEvent.press(generateBtn);

    expect(
      await findByText(/LLM Service Busy — AI generator is experiencing high demand/i)
    ).toBeTruthy();

    // Verify backup idea card rendered so user is not stuck
    expect(await findByText(/Collaborative Hub \(Offline Template\)/i)).toBeTruthy();
  });

  it('switches to Idea Hub Feed tab and renders community ideas', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce([]);

    const { findByText, getByText } = render(
      <ThemeProvider>
        <IdeaHubScreen />
      </ThemeProvider>
    );

    const feedTab = await findByText('💡 Idea Hub Feed');
    fireEvent.press(feedTab);

    // Verify default feed ideas rendered
    expect(await findByText('EduSprint — Peer Micro-tutoring Platform')).toBeTruthy();
    expect(getByText('EcoPulse — AI Campus Energy Optimizer')).toBeTruthy();
  });
});
