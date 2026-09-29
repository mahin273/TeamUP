import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser } from './helpers/auth';

describe('Phase 0 smoke', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(resetDb);

  it('boots the app and can register + login a user', async () => {
    const user = await registerUser(app);
    expect(user.token).toBeTruthy();
    expect(user.id).toBeTruthy();
  });

  it('blocks real network calls', async () => {
    // if any code tries a real HTTP call to GitHub/LLM, nock makes the test fail loudly
    const nock = require('nock');
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
    await expect(fetch('https://api.github.com/users/x')).rejects.toBeDefined();
    nock.enableNetConnect();
  });
});
