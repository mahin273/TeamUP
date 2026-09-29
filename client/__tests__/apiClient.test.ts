import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../src/api/client';
import * as tokens from '../src/storage/tokens';

describe('API client token refresh (FE-18)', () => {
  const mock = new MockAdapter(apiClient);
  afterEach(() => mock.reset());

  it('refreshes once on 401 and retries the original request', async () => {
    jest.spyOn(tokens, 'getRefreshToken').mockResolvedValue('r1');
    mock
      .onGet('/profiles/me')
      .replyOnce(401)
      .onGet('/profiles/me')
      .reply(200, { ok: true });
    mock
      .onPost('/auth/refresh')
      .reply(200, { accessToken: 'new', refreshToken: 'r2' });
    const res = await apiClient.get('/profiles/me');
    expect(res.status).toBe(200);
    expect(
      mock.history.post.filter((r) => r.url === '/auth/refresh'),
    ).toHaveLength(1);
  });

  it('logs out when the refresh itself fails', async () => {
    const logout = jest.spyOn(tokens, 'clearTokens').mockResolvedValue();
    mock.onGet('/profiles/me').reply(401);
    mock.onPost('/auth/refresh').reply(401);
    await expect(apiClient.get('/profiles/me')).rejects.toBeDefined();
    expect(logout).toHaveBeenCalled();
  });
});
