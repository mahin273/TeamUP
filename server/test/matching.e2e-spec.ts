import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { addSkill, createProject, addMember } from './helpers/factories';
import { CFG } from './helpers/config';
import { R } from './helpers/routes';

describe('Matching & invites (e2e)', () => {
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

  const ids = (body: any): string[] => {
    const list = Array.isArray(body)
      ? body
      : (body.data ?? body.candidates ?? []);
    return list.map((c: any) => c.userId ?? c.id ?? c.user?.id);
  };

  describe('recommendations', () => {
    it('MATCH-01/02/04 ranks by skill overlap and availability', async () => {
      const owner = await registerUser(app);
      const project = await createProject(app, owner, {
        requiredSkills: ['React', 'NestJS', 'Postgres'],
      });

      const strong = await registerUser(app);
      await addSkill(app, strong, 'React');
      await addSkill(app, strong, 'NestJS');
      await addSkill(app, strong, 'Postgres');

      const medium = await registerUser(app);
      await addSkill(app, medium, 'React');

      const weak = await registerUser(app); // no skills

      const strongBusy = await registerUser(app);
      await addSkill(app, strongBusy, 'React');
      await addSkill(app, strongBusy, 'NestJS');
      await addSkill(app, strongBusy, 'Postgres');
      await prisma.profile.updateMany({
        where: { userId: strongBusy.id },
        data: { availability: false },
      });

      const res = await http()
        .get(R.recommendations(project.id))
        .set(bearer(owner.token));
      expect(res.status).toBe(200);
      const order = ids(res.body);

      expect(order.indexOf(strong.id)).toBeLessThan(order.indexOf(medium.id));
      expect(order.indexOf(medium.id)).toBeLessThan(order.indexOf(weak.id));
      // identical skills, but unavailable => must rank below the available one
      expect(order.indexOf(strong.id)).toBeLessThan(
        order.indexOf(strongBusy.id),
      );
    });

    it('MATCH-03 excludes the owner and current members', async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);
      const outsider = await registerUser(app);
      const project = await createProject(app, owner);
      await addMember(project.id, member);
      const res = await http()
        .get(R.recommendations(project.id))
        .set(bearer(owner.token));
      const order = ids(res.body);
      expect(order).not.toContain(owner.id);
      expect(order).not.toContain(member.id);
      expect(order).toContain(outsider.id);
    });

    it('MATCH-05 forbids a non-owner', async () => {
      const owner = await registerUser(app);
      const other = await registerUser(app);
      const project = await createProject(app, owner);
      const res = await http()
        .get(R.recommendations(project.id))
        .set(bearer(other.token));
      expect(res.status).toBe(403);
    });

    it('MATCH-06 returns 404 for an unknown project', async () => {
      const u = await registerUser(app);
      const res = await http()
        .get(R.recommendations('00000000-0000-4000-8000-000000000000'))
        .set(bearer(u.token));
      expect(res.status).toBe(404);
    });

    it('MATCH-07 returns an empty list when nobody else exists', async () => {
      const owner = await registerUser(app);
      const project = await createProject(app, owner);
      const res = await http()
        .get(R.recommendations(project.id))
        .set(bearer(owner.token));
      expect(res.status).toBe(200);
      expect(ids(res.body)).toEqual([]);
    });
  });

  describe('invites and member status', () => {
    it('MATCH-08 invite creates a PENDING member and a notification', async () => {
      const owner = await registerUser(app);
      const invitee = await registerUser(app);
      const project = await createProject(app, owner);

      const res = await http()
        .post(R.invite(project.id))
        .set(bearer(owner.token))
        .send(CFG.inviteBody(invitee.id));
      expect([200, 201]).toContain(res.status);

      const row = await prisma.projectMember.findFirst({
        where: { projectId: project.id, userId: invitee.id },
      });
      expect(row?.status).toBe('PENDING');
      expect(
        await prisma.notification.count({ where: { userId: invitee.id } }),
      ).toBeGreaterThan(0);
    });

    it('MATCH-09 duplicate invite does not create a second row', async () => {
      const owner = await registerUser(app);
      const invitee = await registerUser(app);
      const project = await createProject(app, owner);
      await http()
        .post(R.invite(project.id))
        .set(bearer(owner.token))
        .send(CFG.inviteBody(invitee.id));
      await http()
        .post(R.invite(project.id))
        .set(bearer(owner.token))
        .send(CFG.inviteBody(invitee.id));
      const n = await prisma.projectMember.count({
        where: { projectId: project.id, userId: invitee.id },
      });
      expect(n).toBe(1);
    });

    it('MATCH-10 cannot invite an existing member', async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);
      const project = await createProject(app, owner);
      await addMember(project.id, member);
      const res = await http()
        .post(R.invite(project.id))
        .set(bearer(owner.token))
        .send(CFG.inviteBody(member.id));
      expect([400, 409]).toContain(res.status);
    });

    it('MATCH-11 cannot invite yourself', async () => {
      const owner = await registerUser(app);
      const project = await createProject(app, owner);
      const res = await http()
        .post(R.invite(project.id))
        .set(bearer(owner.token))
        .send(CFG.inviteBody(owner.id));
      expect(res.status).toBe(400);
    });

    it('MATCH-12 a non-owner cannot invite', async () => {
      const owner = await registerUser(app);
      const other = await registerUser(app);
      const target = await registerUser(app);
      const project = await createProject(app, owner);
      const res = await http()
        .post(R.invite(project.id))
        .set(bearer(other.token))
        .send(CFG.inviteBody(target.id));
      expect(res.status).toBe(403);
    });

    it('MATCH-13/14 leader can ACCEPT and REJECT members', async () => {
      const owner = await registerUser(app);
      const a = await registerUser(app);
      const b = await registerUser(app);
      const project = await createProject(app, owner);
      const rowA = await addMember(project.id, a, 'PENDING');
      const rowB = await addMember(project.id, b, 'PENDING');

      const r1 = await http()
        .patch(R.member(project.id, rowA.id))
        .set(bearer(owner.token))
        .send(CFG.memberStatusBody('ACCEPTED'));
      const r2 = await http()
        .patch(R.member(project.id, rowB.id))
        .set(bearer(owner.token))
        .send(CFG.memberStatusBody('REJECTED'));
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(
        (await prisma.projectMember.findUnique({ where: { id: rowA.id } }))
          ?.status,
      ).toBe('ACCEPTED');
      expect(
        (await prisma.projectMember.findUnique({ where: { id: rowB.id } }))
          ?.status,
      ).toBe('REJECTED');
    });

    it('MATCH-15 a non-leader cannot change member status', async () => {
      const owner = await registerUser(app);
      const member = await registerUser(app);
      const pending = await registerUser(app);
      const project = await createProject(app, owner);
      await addMember(project.id, member);
      const row = await addMember(project.id, pending, 'PENDING');
      const res = await http()
        .patch(R.member(project.id, row.id))
        .set(bearer(member.token))
        .send(CFG.memberStatusBody('ACCEPTED'));
      expect(res.status).toBe(403);
    });

    it('MATCH-16 rejects an invalid status value', async () => {
      const owner = await registerUser(app);
      const a = await registerUser(app);
      const project = await createProject(app, owner);
      const row = await addMember(project.id, a, 'PENDING');
      const res = await http()
        .patch(R.member(project.id, row.id))
        .set(bearer(owner.token))
        .send({ status: 'MAYBE' });
      expect(res.status).toBe(400);
    });

    it('MATCH-17 [CHARACTERISATION] the invitee cannot accept their own invite (functional gap)', async () => {
      const owner = await registerUser(app);
      const invitee = await registerUser(app);
      const project = await createProject(app, owner);
      const row = await addMember(project.id, invitee, 'PENDING');
      const res = await http()
        .patch(R.member(project.id, row.id))
        .set(bearer(invitee.token))
        .send(CFG.memberStatusBody('ACCEPTED'));
      expect(res.status).toBe(403);
    });

    it('MATCH-18 rejects invites when the team is already full', async () => {
      const owner = await registerUser(app);
      const project = await createProject(app, owner, { teamSizeNeeded: 2 });
      const m1 = await registerUser(app);
      await addMember(project.id, m1); // owner + m1 = 2
      const extra = await registerUser(app);
      const res = await http()
        .post(R.invite(project.id))
        .set(bearer(owner.token))
        .send(CFG.inviteBody(extra.id));
      expect([400, 409]).toContain(res.status);
    });
  });

  describe('workspace access by member status (P0 security)', () => {
    it.each(['PENDING', 'REJECTED'] as const)(
      'MATCH-19/20 [EXPECTED-BUG?] %s member cannot read tasks or files',
      async (status) => {
        const owner = await registerUser(app);
        const user = await registerUser(app);
        const project = await createProject(app, owner);
        await addMember(project.id, user, status);

        const tasks = await http()
          .get(R.tasks(project.id))
          .set(bearer(user.token));
        const files = await http()
          .get(R.files(project.id))
          .set(bearer(user.token));
        expect(tasks.status).toBe(403);
        expect(files.status).toBe(403);
      },
    );
  });
});
