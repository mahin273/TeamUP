import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { JwtService } from '@nestjs/jwt';
import {
  MeetingStatus,
  MemberStatus,
  ProjectRole,
  EventType,
} from '@prisma/client';

describe('Meeting Scheduler & Slot Voting Subsystem (e2e)', () => {
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
    id: 'proj-e2e-1',
    creatorId: 'user-leader',
    title: 'Autonomous Robotics Platform',
    description: 'Hardware and software integration',
    members: [
      {
        id: 'pm-1',
        projectId: 'proj-e2e-1',
        userId: 'user-leader',
        role: ProjectRole.LEADER,
        status: MemberStatus.ACCEPTED,
      },
      {
        id: 'pm-2',
        projectId: 'proj-e2e-1',
        userId: 'user-member',
        role: ProjectRole.MEMBER,
        status: MemberStatus.ACCEPTED,
      },
    ],
  };

  const slot1 = {
    id: '11111111-1111-4111-8111-111111111111',
    meetingId: 'meet-e2e-1',
    startTime: new Date('2026-10-01T10:00:00.000Z'),
    endTime: new Date('2026-10-01T11:00:00.000Z'),
    votes: [] as any[],
  };

  const slot2 = {
    id: '22222222-2222-4222-8222-222222222222',
    meetingId: 'meet-e2e-1',
    startTime: new Date('2026-10-01T14:00:00.000Z'),
    endTime: new Date('2026-10-01T15:00:00.000Z'),
    votes: [] as any[],
  };

  const mockMeetings: any[] = [
    {
      id: 'meet-e2e-1',
      projectId: 'proj-e2e-1',
      title: 'Weekly Standup',
      description: 'Progress discussion',
      status: MeetingStatus.VOTING,
      selectedSlotId: null,
      project: mockProject,
      slots: [slot1, slot2],
      createdAt: new Date('2026-09-15T10:00:00Z'),
    },
  ];

  let mockVotes: Array<{ id: string; slotId: string; userId: string }> = [];
  const mockCalendarEvents: any[] = [];

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
    },
    projectMember: {
      findMany: jest.fn(({ where }: any) => {
        if (where?.projectId === mockProject.id) {
          let list = mockProject.members;
          if (where.status) {
            list = list.filter((m) => m.status === where.status);
          }
          if (where.userId?.not) {
            list = list.filter((m) => m.userId !== where.userId.not);
          }
          return Promise.resolve(list);
        }
        return Promise.resolve([]);
      }),
      findFirst: jest.fn(({ where }: any) => {
        const found = mockProject.members.find(
          (m) =>
            m.projectId === where.projectId &&
            m.userId === where.userId &&
            (!where.role || m.role === where.role) &&
            (!where.status || m.status === where.status),
        );
        return Promise.resolve(found || null);
      }),
    },
    meeting: {
      create: jest.fn(({ data }: any) => {
        const newMeeting = {
          id: `meet-new-${Date.now()}`,
          projectId: data.projectId,
          title: data.title,
          description: data.description || null,
          status: data.status,
          selectedSlotId: null,
          slots: (data.slots?.create || []).map((s: any, idx: number) => ({
            id: `a0000000-0000-0000-0000-00000000001${idx}`,
            meetingId: `meet-new-${Date.now()}`,
            startTime: s.startTime,
            endTime: s.endTime,
            votes: [],
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
          project: mockProject,
        };
        mockMeetings.push(newMeeting);
        return Promise.resolve(newMeeting);
      }),
      findMany: jest.fn(({ where }: any) => {
        const list = mockMeetings.filter(
          (m) => m.projectId === where.projectId,
        );
        return Promise.resolve(list);
      }),
      findUnique: jest.fn(({ where }: any) => {
        const found = mockMeetings.find((m) => m.id === where.id);
        if (!found) return Promise.resolve(null);
        return Promise.resolve({
          ...found,
          project: mockProject,
          slots: found.slots.map((s: any) => ({
            ...s,
            votes: mockVotes
              .filter((v) => v.slotId === s.id)
              .map((v) => ({
                id: v.id,
                slotId: v.slotId,
                userId: v.userId,
                user: {
                  id: v.userId,
                  email: `${v.userId}@uni.edu`,
                  profile: { fullName: v.userId, avatarUrl: null },
                },
              })),
          })),
        });
      }),
      update: jest.fn(({ where, data }: any) => {
        const meeting = mockMeetings.find((m) => m.id === where.id);
        if (meeting) {
          if (data.status) meeting.status = data.status;
          if (data.selectedSlotId !== undefined)
            meeting.selectedSlotId = data.selectedSlotId;
        }
        return Promise.resolve(meeting);
      }),
    },
    meetingVote: {
      deleteMany: jest.fn(({ where }: any) => {
        const initialLen = mockVotes.length;
        mockVotes = mockVotes.filter(
          (v) =>
            !(v.userId === where.userId && where.slotId.in.includes(v.slotId)),
        );
        return Promise.resolve({ count: initialLen - mockVotes.length });
      }),
      createMany: jest.fn(({ data }: any) => {
        for (const item of data) {
          mockVotes.push({
            id: `vote-${Date.now()}-${Math.random()}`,
            slotId: item.slotId,
            userId: item.userId,
          });
        }
        return Promise.resolve({ count: data.length });
      }),
      findMany: jest.fn(({ where }: any) => {
        const meeting = mockMeetings.find((m) => m.id === where.slot.meetingId);
        if (!meeting) return Promise.resolve([]);
        const meetingSlotIds = meeting.slots.map((s: any) => s.id);
        const meetingVotes = mockVotes.filter((v) =>
          meetingSlotIds.includes(v.slotId),
        );
        const distinctUserIds = Array.from(
          new Set(meetingVotes.map((v) => v.userId)),
        );
        return Promise.resolve(distinctUserIds.map((userId) => ({ userId })));
      }),
    },
    calendarEvent: {
      create: jest.fn(({ data }: any) => {
        const ev = { id: `cal-${Date.now()}`, ...data, createdAt: new Date() };
        mockCalendarEvents.push(ev);
        return Promise.resolve(ev);
      }),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notif-e2e' }),
    },
    pushToken: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
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
      {
        sub: 'user-leader',
        email: 'leader@uni.edu',
        role: 'STUDENT',
      },
      { secret: jwtSecret },
    );
    memberToken = await jwtService.signAsync(
      {
        sub: 'user-member',
        email: 'member@uni.edu',
        role: 'STUDENT',
      },
      { secret: jwtSecret },
    );
    outsiderToken = await jwtService.signAsync(
      {
        sub: 'user-outsider',
        email: 'outsider@uni.edu',
        role: 'STUDENT',
      },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/projects/:projectId/meetings', () => {
    const future1 = new Date(Date.now() + 86400000).toISOString();
    const future2 = new Date(Date.now() + 90000000).toISOString();
    const future3 = new Date(Date.now() + 172800000).toISOString();
    const future4 = new Date(Date.now() + 176400000).toISOString();

    it('should return 401 if unauthenticated', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${mockProject.id}/meetings`)
        .send({
          title: 'Design Review',
          slots: [
            { startTime: future1, endTime: future2 },
            { startTime: future3, endTime: future4 },
          ],
        })
        .expect(401);
    });

    it('should return 403 if caller is not an accepted project member', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${mockProject.id}/meetings`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          title: 'Design Review',
          slots: [
            { startTime: future1, endTime: future2 },
            { startTime: future3, endTime: future4 },
          ],
        })
        .expect(403);
    });

    it('should return 400 if no slots are provided', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${mockProject.id}/meetings`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          title: 'No Slot Meeting',
          slots: [],
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 201 and create meeting with candidate slots', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${mockProject.id}/meetings`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          title: 'Architecture Review',
          description: 'Review system design doc',
          slots: [
            { startTime: future1, endTime: future2 },
            { startTime: future3, endTime: future4 },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Architecture Review');
      expect(res.body.data.status).toBe(MeetingStatus.VOTING);
      expect(res.body.data.slots.length).toBe(2);
    });
  });

  describe('GET /api/v1/projects/:projectId/meetings', () => {
    it('should return 200 with list of meetings for project member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${mockProject.id}/meetings`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return 403 for outsider', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${mockProject.id}/meetings`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/meetings/:id', () => {
    it('should return 200 with meeting details', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/meetings/meet-e2e-1')
        .set('Authorization', `Bearer ${leaderToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('meet-e2e-1');
      expect(res.body.data.slots.length).toBe(2);
    });

    it('should return 404 for nonexistent meeting', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/meetings/meet-ghost-99')
        .set('Authorization', `Bearer ${leaderToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/meetings/:id/vote & Auto-Consensus', () => {
    it('should record votes for a member without finalizing when more votes pending', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/meetings/meet-e2e-1/vote')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ slotIds: [slot1.id] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(MeetingStatus.VOTING);
    });

    it('should return 400 when submitting an invalid slot UUID', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/meetings/meet-e2e-1/vote')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ slotIds: ['00000000-0000-0000-0000-000000000099'] })
        .expect(400);
    });

    it('should trigger auto-consensus to CONFIRMED when second member votes', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/meetings/meet-e2e-1/vote')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ slotIds: [slot1.id] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(MeetingStatus.CONFIRMED);
      expect(res.body.data.selectedSlotId).toBe(slot1.id);
      expect(mockCalendarEvents.length).toBeGreaterThan(0);
      expect(mockCalendarEvents[0].eventType).toBe(EventType.MEETING);
    });

    it('should return 400 if trying to vote after meeting is CONFIRMED', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/meetings/meet-e2e-1/vote')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ slotIds: [slot1.id] })
        .expect(400);
    });
  });

  describe('POST /api/v1/meetings/:id/cancel', () => {
    it('should cancel meeting when called by leader', async () => {
      const cancelMeeting = {
        id: 'meet-to-cancel',
        projectId: mockProject.id,
        title: 'Meeting To Cancel',
        status: MeetingStatus.VOTING,
        slots: [slot1, slot2],
        project: mockProject,
      };
      mockMeetings.push(cancelMeeting);

      const res = await request(app.getHttpServer())
        .post('/api/v1/meetings/meet-to-cancel/cancel')
        .set('Authorization', `Bearer ${leaderToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(MeetingStatus.CANCELLED);
    });

    it('should return 403 when non-leader tries to cancel meeting', async () => {
      const cancelMeeting2 = {
        id: 'meet-to-cancel-2',
        projectId: mockProject.id,
        title: 'Meeting To Cancel 2',
        status: MeetingStatus.VOTING,
        slots: [slot1, slot2],
        project: mockProject,
      };
      mockMeetings.push(cancelMeeting2);

      await request(app.getHttpServer())
        .post('/api/v1/meetings/meet-to-cancel-2/cancel')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });
});
