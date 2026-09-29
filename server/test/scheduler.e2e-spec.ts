import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { projectWithTeam } from './helpers/factories';
import { CFG } from './helpers/config';
import { R } from './helpers/routes';

const day = (n: number, hour = 10) => {
  const d = new Date(Date.now() + n * 86400000);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};
const slot = (n: number, hour = 10) => ({
  startTime: day(n, hour).toISOString(),
  endTime: day(n, hour + 1).toISOString(),
});

describe('Scheduler & calendar (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(resetDb);

  const propose = (projectId: string, token: string, slots: any[]) =>
    http()
      .post(R.meetings(projectId))
      .set(bearer(token))
      .send(CFG.meeting.body('Sprint sync', slots));
  const vote = (meetingId: string, token: string, s: { startTime: string }) =>
    http()
      .post(R.vote(meetingId))
      .set(bearer(token))
      .send(CFG.meeting.voteBody(s.startTime));

  it('SCH-01 proposes a meeting with 3 slots', async () => {
    const { owner, project } = await projectWithTeam(app, 1);
    const res = await propose(project.id, owner.token, [
      slot(2),
      slot(3),
      slot(4),
    ]);
    expect(res.status).toBe(201);
    expect(
      await prisma.meeting.count({ where: { projectId: project.id } }),
    ).toBe(1);
  });

  it.each([
    ['no slots', []],
    [
      'too many slots',
      [slot(1), slot(2), slot(3), slot(4), slot(5), slot(6), slot(7)],
    ],
    ['slot in the past', [slot(-3)]],
    [
      'end before start',
      [
        {
          startTime: day(2, 12).toISOString(),
          endTime: day(2, 10).toISOString(),
        },
      ],
    ],
    ['invalid date', [{ startTime: 'nope', endTime: 'nada' }]],
  ])('SCH-02/03/04 rejects %s', async (_l, slots) => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await propose(project.id, owner.token, slots as any);
    expect(res.status).toBe(400);
  });

  it('SCH-05 a non-member cannot propose', async () => {
    const { project } = await projectWithTeam(app, 0);
    const stranger = await registerUser(app);
    const res = await propose(project.id, stranger.token, [slot(2), slot(3)]);
    expect(res.status).toBe(403);
  });

  describe('voting', () => {
    const setup = async () => {
      const team = await projectWithTeam(app, 2); // owner + 2 members = 3 voters
      const slots = [slot(2), slot(3), slot(4)];
      const m = await propose(team.project.id, team.owner.token, slots);
      return {
        ...team,
        slots,
        meetingId: (m.body?.id || m.body?.data?.id) as string,
      };
    };

    it('SCH-06 a member votes and a MeetingVote row is created', async () => {
      const { members, slots, meetingId } = await setup();
      const res = await vote(meetingId, members[0].token, slots[1]);
      expect([200, 201]).toContain(res.status);
      expect(await prisma.meetingVote.count({ where: { meetingId } })).toBe(1);
    });

    it('SCH-07 rejects a vote for a slot that was not proposed', async () => {
      const { members, meetingId } = await setup();
      const res = await vote(meetingId, members[0].token, slot(30));
      expect(res.status).toBe(400);
    });

    it('SCH-08 [EXPECTED-BUG?] the same user voting twice counts once', async () => {
      const { members, slots, meetingId } = await setup();
      await vote(meetingId, members[0].token, slots[0]);
      await vote(meetingId, members[0].token, slots[0]);
      const rows = await prisma.meetingVote.findMany({
        where: { meetingId, userId: members[0].id },
      });
      expect(rows.length).toBeLessThanOrEqual(1);
    });

    it('SCH-09 a non-member cannot vote', async () => {
      const { slots, meetingId } = await setup();
      const stranger = await registerUser(app);
      const res = await vote(meetingId, stranger.token, slots[0]);
      expect(res.status).toBe(403);
    });

    it('SCH-10 the slot with the most votes wins', async () => {
      const { owner, members, slots, meetingId } = await setup();
      await vote(meetingId, owner.token, slots[2]);
      await vote(meetingId, members[0].token, slots[2]);
      await vote(meetingId, members[1].token, slots[0]);
      const m = await prisma.meeting.findUniqueOrThrow({
        where: { id: meetingId },
      });
      expect(new Date(m.confirmedSlot as any).toISOString()).toBe(
        slots[2].startTime,
      );
    });

    it('SCH-11 a tie is broken by the earliest startTime', async () => {
      const { owner, members, slots, meetingId } = await setup();
      await vote(meetingId, owner.token, slots[2]); // later slot
      await vote(meetingId, members[0].token, slots[0]); // earlier slot
      await vote(meetingId, members[1].token, slots[1]); // 1-1-1 three-way tie
      const m = await prisma.meeting.findUniqueOrThrow({
        where: { id: meetingId },
      });
      expect(new Date(m.confirmedSlot as any).toISOString()).toBe(
        slots[0].startTime,
      );
    });

    it('SCH-13 confirmation notifies every member', async () => {
      const { owner, members, slots, meetingId } = await setup();
      await vote(meetingId, owner.token, slots[0]);
      await vote(meetingId, members[0].token, slots[0]);
      await vote(meetingId, members[1].token, slots[0]);
      for (const u of [owner, ...members]) {
        expect(
          await prisma.notification.count({ where: { userId: u.id } }),
        ).toBeGreaterThan(0);
      }
    });

    it('SCH-14 [EXPECTED-BUG?] rejects a vote after the meeting is confirmed', async () => {
      const { owner, members, slots, meetingId } = await setup();
      await vote(meetingId, owner.token, slots[0]);
      await vote(meetingId, members[0].token, slots[0]);
      await vote(meetingId, members[1].token, slots[0]); // everyone voted, meeting confirmed
      const late = await vote(meetingId, members[1].token, slots[1]);
      expect([400, 403, 409]).toContain(late.status);
    });
  });

  describe('calendar', () => {
    it("CAL-01 shows only my own projects' deadlines", async () => {
      const mine = await projectWithTeam(app, 0);
      const other = await projectWithTeam(app, 0);
      const res = await http().get(R.calendar).set(bearer(mine.owner.token));
      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(other.project.id);
    });

    it('CAL-02 keeps a stable UTC instant regardless of client time zone', async () => {
      const { owner, project } = await projectWithTeam(app, 0);
      const s = {
        startTime: '2030-06-15T18:00:00.000Z',
        endTime: '2030-06-15T19:00:00.000Z',
      };
      await propose(project.id, owner.token, [s]);
      const row = await prisma.meeting.findFirstOrThrow({
        where: { projectId: project.id },
      });
      expect(JSON.stringify(row.proposedSlots)).toContain(
        '2030-06-15T18:00:00.000Z',
      );
    });
  });
});
