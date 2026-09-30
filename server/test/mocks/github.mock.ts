import { NotFoundException } from '@nestjs/common';

export const githubMock = {
  mode: 'ok' as 'ok' | 'notfound' | 'ratelimit' | 'error' | 'timeout',
  async getStatsForProfile(profileIdOrUserId: string) {
    return this.getStats(profileIdOrUserId);
  },
  async getStatsForUsername(username: string) {
    return this.getStats(username);
  },
  async getStats(username: string) {
    switch (this.mode) {
      case 'notfound':
        throw new NotFoundException(`GitHub user '${username}' not found`);
      case 'ratelimit':
        return {
          username,
          connected: true,
          publicRepos: 0,
          followers: 0,
          contributionsThisYear: 0,
          totalStars: 0,
          topLanguages: [],
          cached: true,
          warning:
            'Live GitHub API rate-limited; showing cached profile stats.',
        };
      case 'error':
        return {
          username,
          connected: true,
          publicRepos: 0,
          followers: 0,
          contributionsThisYear: 0,
          totalStars: 0,
          topLanguages: [],
          cached: true,
          warning: 'GitHub API temporarily unavailable.',
        };
      case 'timeout':
        return {
          username,
          connected: true,
          publicRepos: 0,
          followers: 0,
          contributionsThisYear: 0,
          totalStars: 0,
          topLanguages: [],
          cached: true,
          warning: 'GitHub API timeout.',
        };
      default:
        return {
          username,
          connected: true,
          publicRepos: 5,
          followers: 10,
          contributionsThisYear: 120,
          totalStars: 3,
          topLanguages: ['TypeScript', 'JavaScript'],
          cached: false,
          repos: [{ name: 'demo', stars: 3 }],
        };
    }
  },
};
