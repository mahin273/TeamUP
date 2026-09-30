import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { JwtService } from '@nestjs/jwt';
import {
  EventType,
  MemberStatus,
  ProjectRole,
  TaskStatus,
  Priority,
  MeetingStatus,
} from '@prisma/client';

describe('Calendar Events & Deadlines Aggregator (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let leaderToken: string;
  let memberToken: string;
  let outsiderToken: string;

  const mockUsers = [
    { id: 'user-leader', email: 'leader@uni.edu', role: 'STUDENT' },
    { id: 'user-member', email: 'member@uni.edu', role: 'STUDENT' },
    { id: 'user-outsider', email: 'outsider@uni.edu', role: 'STUDENT' },
  ];

  const mockProject = {
    id: '11111111-1111-4111-8111-111111111111',
    creatorId: 'user-leader',
    title: 'Autonomous Robotics Platform',
    members: [
      {
        id: 'pm-1',
        projectId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-leader',
        role: ProjectRole.LEADER,
        status: MemberStatus.ACCEPTED,
      },
      {
        id: 'pm-2',
        projectId: '11111111-1111-4111-8111-111111111111',
        userId: 'user-member',
        role: ProjectRole.MEMBER,
        status: MemberStatus.ACCEPTED,
      },
    ],
  };

  const mockEvents: any[] = [
    {
      id: 'evt-cal-1',
      projectId: '11111111-1111-4111-8111-111111111111',
      title: 'Milestone 1 Demo',
      description: 'Prototype evaluation with advisors',
      eventType: EventType.MILESTONE,
      startDate: new Date('2026-10-15T10:00:00.000Z'),
      endDate: new Date('2026-10-15T12:00:00.000Z'),
      createdAt: new Date('2026-09-15T10:00:00Z'),
      project: mockProject,
    },
  ];

  const mockTasks: any[] = [
    {
      id: 'task-cal-1',
      projectId: '11111111-1111-4111-8111-111111111111',
      title: 'Implement Kalman Filter',
      description: 'Sensor fusion for IMU data',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      assigneeId: 'user-member',
      dueDate: new Date('2026-10-10T23:59:00.000Z'),
      project: mockProject,
    },
  ];

  const mockMeetings: any[] = [
    {
      id: 'meet-cal-1',
      projectId: '11111111-1111-4111-8111-111111111111',
      title: 'Sprint Planning',
      description: 'Weekly team sprint sync',
      status: MeetingStatus.CONFIRMED,
      selectedSlot: {
        id: 'slot-1',
        startTime: new Date('2026-10-05T14:00:00.000Z'),
        endTime: new Date('2026-10-05T15:00:00.000Z'),
      },
      project: mockProject,
    },
  ];

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(
        ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id)
            return Promise.resolve(
              mockUsers.find((u) => u.id === where.id) || null,
            );
          if (where.email)
            return Promise.resolve(
              mockUsers.find((u) => u.email === where.email) || null,
            );
          return Promise.resolve(null);
        },
      ),
    },
    project: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        if (where.id === mockProject.id) return Promise.resolve(mockProject);
        return Promise.resolve(null);
      }),
      findMany: jest.fn(({ where }: any) => {
        if (where?.creatorId === 'user-leader')
          return Promise.resolve([mockProject]);
        return Promise.resolve([]);
      }),
    },
    projectMember: {
      findMany: jest.fn(({ where }: any) => {
        if (where?.userId === 'user-leader')
          return Promise.resolve([{ projectId: mockProject.id }]);
        if (where?.userId === 'user-member')
          return Promise.resolve([{ projectId: mockProject.id }]);
        return Promise.resolve([]);
      }),
    },
    calendarEvent: {
      create: jest.fn(({ data }: any) => {
        const created = {
          id: `evt-new-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          project: mockProject,
        };
        mockEvents.push(created);
        return Promise.resolve(created);
      }),
      findMany: jest.fn(({ where }: any) => {
        let list = mockEvents;
        if (where?.projectId) {
          if (typeof where.projectId === 'string') {
            list = list.filter((e) => e.projectId === where.projectId);
          } else if (where.projectId.in) {
            list = list.filter((e) => where.projectId.in.includes(e.projectId));
          }
        }
        return Promise.resolve(list);
      }),
      findUnique: jest.fn(({ where }: any) => {
        const found = mockEvents.find((e) => e.id === where.id);
        if (!found) return Promise.resolve(null);
        return Promise.resolve({ ...found, project: mockProject });
      }),
      delete: jest.fn(({ where }: any) => {
        const idx = mockEvents.findIndex((e) => e.id === where.id);
        let removed = null;
        if (idx !== -1) removed = mockEvents.splice(idx, 1)[0];
        return Promise.resolve(removed);
      }),
    },
    task: {
      findMany: jest.fn(() => Promise.resolve(mockTasks)),
    },
    meeting: {
      findMany: jest.fn(() => Promise.resolve(mockMeetings)),
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
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    const jwtSecret =
      process.env.JWT_SECRET || 'super_secret_jwt_access_key_teamup_2026';

    leaderToken = await jwtService.signAsync(
      { sub: 'user-leader', email: 'leader@uni.edu', role: 'STUDENT' },
      { secret: jwtSecret },
    );
    memberToken = await jwtService.signAsync(
      { sub: 'user-member', email: 'member@uni.edu', role: 'STUDENT' },
      { secret: jwtSecret },
    );
    outsiderToken = await jwtService.signAsync(
      { sub: 'user-outsider', email: 'outsider@uni.edu', role: 'STUDENT' },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/projects/:projectId/calendar/events', () => {
    const validPayload = {
      title: 'Final Code Freeze',
      description: 'All branches merged into main',
      eventType: EventType.DEADLINE,
      startDate: '2026-10-30T18:00:00.000Z',
      endDate: '2026-10-30T20:00:00.000Z',
    };

    it('should return 401 if unauthenticated', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${mockProject.id}/calendar/events`)
        .send(validPayload)
        .expect(401);
    });

    it('should return 403 if caller is not a project member', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${mockProject.id}/calendar/events`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send(validPayload)
        .expect(403);
    });

    it('should return 400 if startDate >= endDate', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${mockProject.id}/calendar/events`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          ...validPayload,
          startDate: '2026-10-30T22:00:00.000Z',
          endDate: '2026-10-30T18:00:00.000Z',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 201 and create calendar event', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${mockProject.id}/calendar/events`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send(validPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(validPayload.title);
      expect(res.body.data.eventType).toBe(EventType.DEADLINE);
    });
  });

  describe('GET /api/v1/projects/:projectId/calendar/events', () => {
    it('should return 200 with list of events for project member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${mockProject.id}/calendar/events`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return 403 for outsider', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${mockProject.id}/calendar/events`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/calendar/events/:id', () => {
    it('should return 200 with event details', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calendar/events/evt-cal-1')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('evt-cal-1');
      expect(res.body.data.title).toBe('Milestone 1 Demo');
    });

    it('should return 404 for nonexistent event ID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/calendar/events/evt-ghost-99')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/calendar/feed', () => {
    it('should aggregate events, tasks, and meetings in ascending chronological order', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calendar/feed')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      // Verify that items are sorted ascending by startDate
      const dates = res.body.data.map((item: any) =>
        new Date(item.startDate).getTime(),
      );
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    it('should filter feed by projectId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/calendar/feed?projectId=${mockProject.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return 403 if querying a project user is not a member of', async () => {
      await request(app.getHttpServer())
        .get(
          '/api/v1/calendar/feed?projectId=00000000-0000-4000-8000-000000000099',
        )
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('DELETE /api/v1/calendar/events/:id', () => {
    it('should return 403 if regular member tries to delete event', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/calendar/events/evt-cal-1')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should allow project leader to delete event', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/calendar/events/evt-cal-1')
        .set('Authorization', `Bearer ${leaderToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
    });
  });
});
