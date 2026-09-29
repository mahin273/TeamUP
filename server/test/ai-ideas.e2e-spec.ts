import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GithubService } from '../src/github/github.service';
import { githubMock } from './mocks/github.mock';
import { LlmClient } from '../src/ideas/llm.client';
import { llmMock } from './mocks/llm.mock';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { R } from './helpers/routes';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('AI Idea Generator (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GithubService)
      .useValue(githubMock)
      .overrideProvider(LlmClient)
      .useValue(llmMock)
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetDb();
    llmMock.reset();
  });

  const gen = (token: string, body: any) =>
    http().post(R.ideasGenerate).set(bearer(token)).send(body);

  it('AI-01 returns a structured idea', async () => {
    const u = await registerUser(app);
    const res = await gen(u.token, { domain: 'AI', tech: 'Python' });
    expect([200, 201]).toContain(res.status);
    const text = JSON.stringify(res.body);
    for (const key of ['title', 'problem', 'features', 'stack', 'roadmap'])
      expect(text).toContain(key);
  });

  it('AI-02 second identical request is served from cache (LLM called once)', async () => {
    const u = await registerUser(app);
    await gen(u.token, { domain: 'AI', tech: 'Python' });
    await gen(u.token, { domain: 'AI', tech: 'Python' });
    expect(llmMock.calls).toBe(1);
  });

  it('AI-03 cache key is normalised for case and spaces', async () => {
    const u = await registerUser(app);
    await gen(u.token, { domain: 'AI', tech: 'Python' });
    await gen(u.token, { domain: ' ai ', tech: 'python' });
    expect(llmMock.calls).toBe(1);
  });

  it.each(['error', 'badjson', 'missing'] as const)(
    'AI-05/06/08 does not crash when the LLM is %s',
    async (mode) => {
      llmMock.mode = mode;
      const u = await registerUser(app);
      const res = await gen(u.token, { domain: 'AI', tech: 'Rust' });
      expect(res.status).toBeLessThan(500);
      expect(JSON.stringify(res.body)).not.toMatch(/stack trace|at Object\./i);
    },
  );

  it('AI-07 handles JSON wrapped in markdown fences', async () => {
    llmMock.mode = 'fenced';
    const u = await registerUser(app);
    const res = await gen(u.token, { domain: 'AI', tech: 'Go' });
    expect(res.status).toBeLessThan(500);
  });

  it.each([
    [{}],
    [{ domain: 'AI' }],
    [{ tech: 'Go' }],
    [{ domain: '', tech: '' }],
  ])('AI-09 rejects %j', async (body) => {
    const u = await registerUser(app);
    const res = await gen(u.token, body);
    expect(res.status).toBe(400);
  });

  it('AI-10 requires authentication', async () => {
    const res = await http()
      .post(R.ideasGenerate)
      .send({ domain: 'AI', tech: 'Go' });
    expect(res.status).toBe(401);
  });

  it('AI-11 never leaks the LLM key', async () => {
    const u = await registerUser(app);
    const res = await gen(u.token, { domain: 'AI', tech: 'Go' });
    if (process.env.LLM_API_KEY) {
      expect(JSON.stringify(res.body)).not.toContain(process.env.LLM_API_KEY);
    }
  });
});
