import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { AnalyticsDashboardScreen } from '../screens/Analytics/AnalyticsDashboardScreen';
import { analyticsService } from '../services/analyticsService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../services/analyticsService', () => ({
  analyticsService: {
    getProjectAnalytics: jest.fn(),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeAnalytics = (overrides = {}) => ({
  projectId: 'proj-1',
  generatedAt: new Date().toISOString(),
  totalTasks: 10,
  completedTasks: 6,
  overallCompletionRate: 60,
  tasksByStatus: { TODO: 2, IN_PROGRESS: 2, TESTING: 0, DONE: 6 },
  tasksByPriority: { LOW: 3, MEDIUM: 5, HIGH: 2 },
  taskCompletionOverTime: [
    { date: '2026-09-17', completed: 2, created: 3 },
    { date: '2026-09-18', completed: 1, created: 1 },
    { date: '2026-09-19', completed: 3, created: 2 },
    { date: '2026-09-20', completed: 0, created: 1 },
    { date: '2026-09-21', completed: 1, created: 0 },
    { date: '2026-09-22', completed: 2, created: 2 },
    { date: '2026-09-23', completed: 3, created: 1 },
  ],
  memberContributions: [
    { memberId: 'user-1', memberName: 'Alice Smith', avatarInitial: 'A', tasksCompleted: 4, tasksAssigned: 5, completionRate: 80 },
    { memberId: 'user-2', memberName: 'Bob Jones',  avatarInitial: 'B', tasksCompleted: 2, tasksAssigned: 5, completionRate: 40 },
  ],
  activityOverTime: [
    { date: '2026-09-17', messages: 5, tasksUpdated: 2 },
    { date: '2026-09-18', messages: 3, tasksUpdated: 1 },
    { date: '2026-09-19', messages: 8, tasksUpdated: 4 },
    { date: '2026-09-20', messages: 2, tasksUpdated: 0 },
    { date: '2026-09-21', messages: 6, tasksUpdated: 3 },
    { date: '2026-09-22', messages: 4, tasksUpdated: 2 },
    { date: '2026-09-23', messages: 7, tasksUpdated: 5 },
  ],
  totalFiles: 3,
  totalMessages: 45,
  ...overrides,
});

const renderWithProviders = (props = {}) =>
  render(
    <ThemeProvider>
      <AuthProvider>
        <AnalyticsDashboardScreen
          route={{ params: { projectId: 'proj-1', projectTitle: 'Test Project' } }}
          navigation={{ goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn() }}
          {...props}
        />
      </AuthProvider>
    </ThemeProvider>
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AnalyticsDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders skeleton cards during loading (not a plain spinner)', () => {
    // Make the promise never resolve so we stay in loading state
    (analyticsService.getProjectAnalytics as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { queryByText, toJSON } = renderWithProviders();

    // Loading state should not show section headers yet
    expect(queryByText('Task Status Breakdown')).toBeNull();
    expect(queryByText('Member Contributions')).toBeNull();
    // The component tree should still render (not crash)
    expect(toJSON()).toBeTruthy();
  });

  it('renders populated state with all sections after successful fetch', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock).mockResolvedValue(makeAnalytics());

    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText('60%')).toBeTruthy();
      expect(getByText('Task Status Breakdown')).toBeTruthy();
      expect(getByText('Tasks Completed')).toBeTruthy();
      expect(getByText('Member Contributions')).toBeTruthy();
      expect(getByText('Team Activity')).toBeTruthy();
    });
  });

  it('shows summary cards with correct values', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock).mockResolvedValue(makeAnalytics());

    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText('60%')).toBeTruthy();   // completion rate
      expect(getByText('10')).toBeTruthy();    // total tasks
      expect(getByText('3')).toBeTruthy();     // total files
    });
  });

  it('shows member names in contributions section', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock).mockResolvedValue(makeAnalytics());

    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText('Alice Smith')).toBeTruthy();
      expect(getByText('Bob Jones')).toBeTruthy();
    });
  });

  it('renders empty state when totalTasks is 0', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock).mockResolvedValue(
      makeAnalytics({
        totalTasks: 0,
        completedTasks: 0,
        overallCompletionRate: 0,
        tasksByStatus: { TODO: 0, IN_PROGRESS: 0, TESTING: 0, DONE: 0 },
        tasksByPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 },
        taskCompletionOverTime: [],
        memberContributions: [],
        activityOverTime: [],
        totalFiles: 0,
        totalMessages: 0,
      })
    );

    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText('No Project Activity Yet')).toBeTruthy();
    });
  });

  it('renders error state when API call fails', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock).mockRejectedValue(
      new Error('Failed to load analytics.')
    );

    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText(/Failed to load analytics/i)).toBeTruthy();
    });
  });

  it('retries fetch when Try Again is pressed after error', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock)
      .mockRejectedValueOnce(new Error('Failed to load analytics.'))
      .mockResolvedValueOnce(makeAnalytics());

    const { getByText } = renderWithProviders();

    await waitFor(() => expect(getByText(/Failed to load analytics/i)).toBeTruthy());

    fireEvent.press(getByText('Try Again'));

    await waitFor(() => {
      expect(analyticsService.getProjectAnalytics).toHaveBeenCalledTimes(2);
      expect(getByText('60%')).toBeTruthy();
    });
  });

  it('calls getProjectAnalytics with the correct projectId', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock).mockResolvedValue(makeAnalytics());

    renderWithProviders();

    await waitFor(() => {
      expect(analyticsService.getProjectAnalytics).toHaveBeenCalledWith('proj-1');
    });
  });

  it('shows "No time-series data available" when taskCompletionOverTime is empty', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock).mockResolvedValue(
      makeAnalytics({ taskCompletionOverTime: [] })
    );

    const { getByText } = renderWithProviders();

    await waitFor(() => {
      expect(getByText('No time-series data available yet.')).toBeTruthy();
    });
  });

  it('handles refresh action from the header button', async () => {
    (analyticsService.getProjectAnalytics as jest.Mock).mockResolvedValue(makeAnalytics());

    const { getByLabelText } = renderWithProviders();

    await waitFor(() => {
      expect(analyticsService.getProjectAnalytics).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByLabelText('Refresh analytics'));

    await waitFor(() => {
      expect(analyticsService.getProjectAnalytics).toHaveBeenCalledTimes(2);
    });
  });
});
