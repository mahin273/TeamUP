import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { JwtService } from '@nestjs/jwt';
import { ExperienceLevel } from '@prisma/client';

describe('Profiles & Skills (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockUsers: any[] = [
    { id: 'user-1', email: 'mahin@uni.edu', role: 'STUDENT' },
    { id: 'user-2', email: 'partner@uni.edu', role: 'STUDENT' },
  ];
  const mockProfiles: any[] = [];
  const mockSkills: any[] = [];
  const mockProfileSkills: any[] = [];

  let tokenUser1: string;

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
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(({ where }: { where: { userId?: string; id?: string } }) => {
        if (where.userId) {
          const p = mockProfiles.find((p) => p.userId === where.userId);
          if (!p) return Promise.resolve(null);
          const userSkills = mockProfileSkills
            .filter((ps) => ps.profileId === p.id)
            .map((ps) => ({
              ...ps,
              skill: mockSkills.find((s) => s.id === ps.skillId),
            }));
          return Promise.resolve({ ...p, skills: userSkills });
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn(({ where }: any) => {
        const target = where.OR?.[0]?.id || where.id;
        const p = mockProfiles.find((p) => p.id === target || p.userId === target);
        if (!p) return Promise.resolve(null);
        const user = mockUsers.find((u) => u.id === p.userId);
        const userSkills = mockProfileSkills
          .filter((ps) => ps.profileId === p.id)
          .map((ps) => ({
            ...ps,
            skill: mockSkills.find((s) => s.id === ps.skillId),
          }));
        return Promise.resolve({ ...p, user, skills: userSkills });
      }),
      create: jest.fn(({ data }: any) => {
        const p = { id: `prof-${mockProfiles.length + 1}`, ...data };
        mockProfiles.push(p);
        return Promise.resolve(p);
      }),
      upsert: jest.fn(({ where, create, update }: any) => {
        let p = mockProfiles.find((item) => item.userId === where.userId);
        if (p) {
          Object.assign(p, update);
        } else {
          p = { id: `prof-${mockProfiles.length + 1}`, ...create };
          mockProfiles.push(p);
        }
        const userSkills = mockProfileSkills
          .filter((ps) => ps.profileId === p.id)
          .map((ps) => ({
            ...ps,
            skill: mockSkills.find((s) => s.id === ps.skillId),
          }));
        return Promise.resolve({ ...p, skills: userSkills });
      }),
    },
    skill: {
      findMany: jest.fn(({ where }: any = {}) => {
        let list = [...mockSkills];
        if (where?.category?.equals) {
          list = list.filter(
            (s) => s.category?.toLowerCase() === where.category.equals.toLowerCase(),
          );
        }
        if (where?.name?.contains) {
          list = list.filter((s) =>
            s.name.toLowerCase().includes(where.name.contains.toLowerCase()),
          );
        }
        return Promise.resolve(list);
      }),
      findUnique: jest.fn(({ where }: any) => {
        if (where.id) {
          return Promise.resolve(mockSkills.find((s) => s.id === where.id) || null);
        }
        if (where.name) {
          return Promise.resolve(mockSkills.find((s) => s.name === where.name) || null);
        }
        return Promise.resolve(null);
      }),
      create: jest.fn(({ data }: any) => {
        const skill = { id: `skill-${mockSkills.length + 1}`, ...data };
        mockSkills.push(skill);
        return Promise.resolve(skill);
      }),
    },
    profileSkill: {
      findUnique: jest.fn(({ where }: any) => {
        const target = where.profileId_skillId;
        return Promise.resolve(
          mockProfileSkills.find(
            (ps) => ps.profileId === target.profileId && ps.skillId === target.skillId,
          ) || null,
        );
      }),
      upsert: jest.fn(({ where, create, update }: any) => {
        const target = where.profileId_skillId;
        let ps = mockProfileSkills.find(
          (item) => item.profileId === target.profileId && item.skillId === target.skillId,
        );
        if (ps) {
          Object.assign(ps, update);
        } else {
          ps = { id: `ps-${mockProfileSkills.length + 1}`, ...create };
          mockProfileSkills.push(ps);
        }
        const skill = mockSkills.find((s) => s.id === ps.skillId);
        return Promise.resolve({ ...ps, skill });
      }),
      delete: jest.fn(({ where }: any) => {
        const target = where.profileId_skillId;
        const idx = mockProfileSkills.findIndex(
          (ps) => ps.profileId === target.profileId && ps.skillId === target.skillId,
        );
        if (idx !== -1) mockProfileSkills.splice(idx, 1);
        return Promise.resolve({});
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

    jwtService = moduleFixture.get<JwtService>(JwtService);
    tokenUser1 = await jwtService.signAsync(
      { sub: 'user-1', email: 'mahin@uni.edu', role: 'STUDENT' },
      { secret: process.env.JWT_SECRET || 'test_jwt_secret' },
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Skills Endpoints', () => {
    it('GET /api/v1/skills should return empty list initially', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/skills').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('POST /api/v1/skills should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .send({ name: 'TypeScript', category: 'Language' })
        .expect(401);
    });

    it('POST /api/v1/skills should create a new skill', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({ name: 'TypeScript', category: 'Language' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('TypeScript');
      expect(res.body.data.category).toBe('Language');
    });

    it('POST /api/v1/skills should reject duplicate skill names', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({ name: 'TypeScript' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Profiles Endpoints', () => {
    it('GET /api/v1/profiles/me should return 401 when token is missing', async () => {
      await request(app.getHttpServer()).get('/api/v1/profiles/me').expect(401);
    });

    it('GET /api/v1/profiles/me should return 404 before profile is created', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('PATCH /api/v1/profiles/me should create/upsert profile on first call', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          fullName: 'Mahin Rahman',
          bio: 'Backend enthusiast',
          department: 'CSE',
          experienceLevel: ExperienceLevel.ADVANCED,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe('Mahin Rahman');
      expect(res.body.data.department).toBe('CSE');
      expect(res.body.data.experienceLevel).toBe(ExperienceLevel.ADVANCED);
    });

    it('GET /api/v1/profiles/me should now return the created profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe('Mahin Rahman');
      expect(res.body.data.userId).toBe('user-1');
    });

    it('POST /api/v1/profiles/me/skills should associate skill with experience level', async () => {
      const skillId = mockSkills[0].id;
      const res = await request(app.getHttpServer())
        .post('/api/v1/profiles/me/skills')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          skillId,
          yearsOfExperience: 2.5,
          proficiencyLevel: ExperienceLevel.ADVANCED,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.yearsOfExperience).toBe(2.5);
      expect(res.body.data.proficiencyLevel).toBe(ExperienceLevel.ADVANCED);
      expect(res.body.data.skill.name).toBe('TypeScript');
    });

    it('GET /api/v1/profiles/:id should return public profile with skills', async () => {
      const profileId = mockProfiles[0].id;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/profiles/${profileId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe('Mahin Rahman');
      expect(res.body.data.skills.length).toBe(1);
      expect(res.body.data.skills[0].skill.name).toBe('TypeScript');
    });

    it('DELETE /api/v1/profiles/me/skills/:skillId should remove association', async () => {
      const skillId = mockSkills[0].id;
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/profiles/me/skills/${skillId}`)
        .set('Authorization', `Bearer ${tokenUser1}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('removed successfully');
    });
  });
});
