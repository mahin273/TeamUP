import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import * as bcrypt from 'bcrypt';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const mockUsers: any[] = [];
  const mockTokens: any[] = [];

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) {
          return Promise.resolve(mockUsers.find((u) => u.email === where.email) || null);
        }
        if (where.id) {
          return Promise.resolve(mockUsers.find((u) => u.id === where.id) || null);
        }
        return Promise.resolve(null);
      }),
      create: jest.fn(({ data }: { data: any }) => {
        const newUser = { id: `user-${mockUsers.length + 1}`, role: 'STUDENT', ...data };
        mockUsers.push(newUser);
        return Promise.resolve(newUser);
      }),
    },
    refreshToken: {
      create: jest.fn(({ data }: { data: any }) => {
        const token = { id: `token-${mockTokens.length + 1}`, ...data };
        mockTokens.push(token);
        return Promise.resolve(token);
      }),
      findFirst: jest.fn(({ where }: { where: { userId: string; tokenHash: string } }) => {
        return Promise.resolve(
          mockTokens.find(
            (t) => t.userId === where.userId && t.tokenHash === where.tokenHash,
          ) || null,
        );
      }),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        const idx = mockTokens.findIndex((t) => t.id === where.id);
        if (idx !== -1) mockTokens.splice(idx, 1);
        return Promise.resolve({});
      }),
      deleteMany: jest.fn(({ where }: { where: { userId: string } }) => {
        return Promise.resolve({ count: 1 });
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let accessToken: string;
  let refreshToken: string;

  it('POST /api/v1/auth/register (Success)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'student@example.com',
        password: 'password123',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('tokens');
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe('student@example.com');
    expect(res.body.data.user.role).toBe('STUDENT');

    accessToken = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('POST /api/v1/auth/register (Validation Error - short password)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid@example.com',
        password: '123',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/login (Success)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'student@example.com',
        password: 'password123',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    accessToken = res.body.data.tokens.accessToken;
  });

  it('POST /api/v1/auth/login (Unauthorized on bad password)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'student@example.com',
        password: 'wrongpassword',
      })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/auth/me (Protected Route with Bearer Token)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('student@example.com');
  });

  it('GET /api/v1/auth/me (Unauthorized without Bearer Token)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/auth/refresh (Token Rotation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');
  });

  it('POST /api/v1/auth/logout (Success)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Logged out successfully');
  });
});
