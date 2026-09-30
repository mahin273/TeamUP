import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { ProjectStatus, ExperienceLevel } from '@prisma/client';

describe('Multi-Criteria Search & Filter System (e2e)', () => {
  let app: INestApplication;

  const mockSkills = [
    { id: 'sk-1', name: 'React Native', category: 'Frontend' },
    { id: 'sk-2', name: 'NestJS', category: 'Backend' },
    { id: 'sk-3', name: 'Python', category: 'Data/AI' },
  ];

  const mockProjects = [
    {
      id: 'proj-1',
      title: 'University Study Buddy Finder',
      description: 'Platform connecting students for exams',
      domain: 'Education',
      semester: 'Fall 2026',
      status: ProjectStatus.OPEN,
      maxMembers: 4,
      createdAt: new Date('2026-09-01'),
      creator: {
        id: 'u-1',
        email: 'alice@uni.edu',
        profile: {
          fullName: 'Alice Wonder',
          avatarUrl: 'https://avatar.com/1.png',
        },
      },
      requiredSkills: [{ skill: mockSkills[0] }, { skill: mockSkills[1] }],
      members: [{ id: 'm-1' }, { id: 'm-2' }],
      _count: { members: 2 },
    },
    {
      id: 'proj-2',
      title: 'Fintech Micro-Investments',
      description: 'Automated fractional share micro-saving',
      domain: 'Fintech',
      semester: 'Spring 2026',
      status: ProjectStatus.IN_PROGRESS,
      maxMembers: 3,
      createdAt: new Date('2026-08-15'),
      creator: {
        id: 'u-2',
        email: 'bob@uni.edu',
        profile: null,
      },
      requiredSkills: [{ skill: mockSkills[1] }, { skill: mockSkills[2] }],
      members: [{ id: 'm-3' }],
      _count: { members: 1 },
    },
    {
      id: 'proj-3',
      title: 'AI Medical Diagnosis Assistant',
      description: 'Deep learning for chest X-ray screening',
      domain: 'Healthcare',
      semester: 'Fall 2026',
      status: ProjectStatus.OPEN,
      maxMembers: 5,
      createdAt: new Date('2026-09-10'),
      creator: {
        id: 'u-3',
        email: 'carol@uni.edu',
        profile: { fullName: 'Carol Danvers', avatarUrl: null },
      },
      requiredSkills: [{ skill: mockSkills[2] }],
      members: [],
      _count: { members: 0 },
    },
  ];

  const mockProfiles = [
    {
      id: 'prof-1',
      userId: 'u-1',
      fullName: 'Alice Wonder',
      bio: 'Mobile and Backend Enthusiast',
      department: 'Computer Science',
      semester: 'Fall 2026',
      availability: true,
      experienceLevel: ExperienceLevel.INTERMEDIATE,
      createdAt: new Date('2026-09-01'),
      user: { id: 'u-1', email: 'alice@uni.edu', role: 'STUDENT' },
      skills: [{ skill: mockSkills[0] }, { skill: mockSkills[1] }],
    },
    {
      id: 'prof-2',
      userId: 'u-2',
      fullName: 'Bob Smith',
      bio: 'Data Science researcher',
      department: 'Electrical Engineering',
      semester: 'Spring 2026',
      availability: false,
      experienceLevel: ExperienceLevel.ADVANCED,
      createdAt: new Date('2026-08-15'),
      user: { id: 'u-2', email: 'bob@uni.edu', role: 'STUDENT' },
      skills: [{ skill: mockSkills[2] }],
    },
  ];

  const mockPrismaService = {
    project: {
      findMany: jest.fn(({ where, skip = 0, take = 20 }: any) => {
        let results = [...mockProjects];

        if (where?.OR) {
          results = results.filter((p) =>
            where.OR.some((condition: any) => {
              if (condition.title) {
                return p.title
                  .toLowerCase()
                  .includes(condition.title.contains.toLowerCase());
              }
              if (condition.description) {
                return p.description
                  .toLowerCase()
                  .includes(condition.description.contains.toLowerCase());
              }
              if (condition.domain) {
                return p.domain
                  .toLowerCase()
                  .includes(condition.domain.contains.toLowerCase());
              }
              return false;
            }),
          );
        }

        if (where?.domain) {
          results = results.filter((p) =>
            p.domain
              .toLowerCase()
              .includes(where.domain.contains.toLowerCase()),
          );
        }

        if (where?.semester) {
          results = results.filter((p) =>
            p.semester
              .toLowerCase()
              .includes(where.semester.contains.toLowerCase()),
          );
        }

        if (where?.status) {
          results = results.filter((p) => p.status === where.status);
        }

        if (where?.requiredSkills?.some?.skill?.name?.contains) {
          const techQuery =
            where.requiredSkills.some.skill.name.contains.toLowerCase();
          results = results.filter((p) =>
            p.requiredSkills.some((rs) =>
              rs.skill.name.toLowerCase().includes(techQuery),
            ),
          );
        }

        return Promise.resolve(results.slice(skip, skip + take));
      }),
      count: jest.fn(() => Promise.resolve(mockProjects.length)),
    },
    profile: {
      count: jest.fn(({ where }: any) => {
        let results = [...mockProfiles];
        if (where?.department) {
          results = results.filter((p) =>
            p.department
              .toLowerCase()
              .includes(where.department.contains.toLowerCase()),
          );
        }
        if (where?.availability !== undefined) {
          results = results.filter(
            (p) => p.availability === where.availability,
          );
        }
        return Promise.resolve(results.length);
      }),
      findMany: jest.fn(({ where, skip = 0, take = 20 }: any) => {
        let results = [...mockProfiles];

        if (where?.department) {
          results = results.filter((p) =>
            p.department
              .toLowerCase()
              .includes(where.department.contains.toLowerCase()),
          );
        }

        if (where?.availability !== undefined) {
          results = results.filter(
            (p) => p.availability === where.availability,
          );
        }

        if (where?.skills?.some?.skill?.name?.contains) {
          const skillQuery =
            where.skills.some.skill.name.contains.toLowerCase();
          results = results.filter((p) =>
            p.skills.some((ps) =>
              ps.skill.name.toLowerCase().includes(skillQuery),
            ),
          );
        }

        return Promise.resolve(results.slice(skip, skip + take));
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

  describe('GET /api/v1/projects/search (Faceted Search for SearchScreen)', () => {
    it('should return all projects normalized as an array when no filters provided', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/search')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);

      const first = res.body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('ownerName', 'Alice Wonder');
      expect(first.requiredSkills).toEqual(['React Native', 'NestJS']);
      expect(first.memberCount).toBe(2);
    });

    it('should filter by search keyword across title, description, or domain', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/search?search=Buddy')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('proj-1');
      expect(res.body.data[0].title).toContain('Study Buddy');
    });

    it('should filter by domain, semester, and status concurrently', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/projects/search?domain=Education&semester=Fall%202026&status=OPEN',
        )
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('proj-1');
    });

    it('should filter by required technology stack', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/search?tech=Python')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map((p: any) => p.id)).toEqual(
        expect.arrayContaining(['proj-2', 'proj-3']),
      );
    });

    it('should correctly ignore "All" option parameters from mobile chips/pickers', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/projects/search?domain=All&semester=All&status=All&tech=All',
        )
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
    });

    it('should return empty array when no matches are found', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/search?search=NonExistentKeyword')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should fallback ownerName to username portion of email if profile is null', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/search?search=Fintech')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data[0].ownerName).toBe('bob');
    });
  });

  describe('GET /api/v1/profiles/search', () => {
    it('should return paginated profiles matching query', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/profiles/search?department=Computer%20Science&availability=true',
        )
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('profiles');
      expect(res.body.data).toHaveProperty('meta');
      expect(res.body.data.profiles).toHaveLength(1);
      expect(res.body.data.profiles[0].fullName).toBe('Alice Wonder');
    });

    it('should filter profiles by skill name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/profiles/search?skill=Python')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.profiles).toHaveLength(1);
      expect(res.body.data.profiles[0].fullName).toBe('Bob Smith');
    });
  });
});
