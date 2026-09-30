import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../setup/test-app';
import { resetDb, prisma } from '../helpers/db';
import { registerUser, bearer } from '../helpers/auth';
import { addSkill, createProject } from '../helpers/factories';
import { connect, connected, onceEvent } from '../helpers/socket';
import { CFG } from '../helpers/config';
import { R } from '../helpers/routes';

describe('FLOW-01 full project lifecycle', () => {
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

  it('register -> match -> invite -> accept -> tasks -> chat -> meeting -> evaluate -> analytics', async () => {
    // 1. three students with skills
    const leader = await registerUser(app, { name: 'Leader' });
    const dev = await registerUser(app, { name: 'Dev' });
    const designer = await registerUser(app, { name: 'Designer' });
    await addSkill(app, dev, 'React', 'ADVANCED');
    await addSkill(app, designer, 'Figma', 'INTERMEDIATE');

    // 2. leader creates a project
    const project = await createProject(app, leader, {
      requiredSkills: ['React', 'Figma'],
      teamSizeNeeded: 3,
    });

    // 3. recommendations include both candidates
    const recs = await http()
      .get(R.recommendations(project.id))
      .set(bearer(leader.token));
    const recIds = JSON.stringify(recs.body);
    expect(recIds).toContain(dev.id);
    expect(recIds).toContain(designer.id);

    // 4. invites are PENDING and the invitees are locked out of the workspace
    for (const u of [dev, designer]) {
      await http()
        .post(R.invite(project.id))
        .set(bearer(leader.token))
        .send(CFG.inviteBody(u.id));
    }
    const locked = await http().get(R.tasks(project.id)).set(bearer(dev.token));
    expect(locked.status).toBe(403);

    // 5. leader accepts both
    const rows = await prisma.projectMember.findMany({
      where: { projectId: project.id, status: 'PENDING' },
    });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      const res = await http()
        .patch(R.member(project.id, r.id))
        .set(bearer(leader.token))
        .send(CFG.memberStatusBody('ACCEPTED'));
      expect(res.status).toBe(200);
    }

    // 6. now the workspace is open
    const open = await http().get(R.tasks(project.id)).set(bearer(dev.token));
    expect(open.status).toBe(200);

    // 7. task assigned and moved through the board
    const t = await http()
      .post(R.tasks(project.id))
      .set(bearer(leader.token))
      .send({ title: 'Build login', priority: 'HIGH', assigneeId: dev.id });
    expect(t.status).toBe(201);
    const taskId = t.body.id || t.body.data?.id;

    for (const status of ['IN_PROGRESS', 'TESTING', 'DONE']) {
      const res = await http()
        .patch(R.task(taskId))
        .set(bearer(dev.token))
        .send({ status });
      expect(res.status).toBe(200);
    }
    expect(
      await prisma.notification.count({ where: { userId: dev.id } }),
    ).toBeGreaterThan(0);

    // 8. live chat between two members
    const s1 = connect(app, project.id, leader.token);
    const s2 = connect(app, project.id, dev.token);
    await Promise.all([connected(s1), connected(s2)]);
    const got = onceEvent(s2, CFG.socket.receiveEvent);
    s1.emit(CFG.socket.sendEvent, { content: 'ship it' });
    expect((await got).content).toBe('ship it');
    s1.disconnect();
    s2.disconnect();

    // 9. meeting scheduled by vote
    const start = new Date(Date.now() + 2 * 86400000).toISOString();
    const end = new Date(Date.now() + 2 * 86400000 + 3600000).toISOString();
    const m = await http()
      .post(R.meetings(project.id))
      .set(bearer(leader.token))
      .send(
        CFG.meeting.body('Demo prep', [{ startTime: start, endTime: end }]),
      );
    expect(m.status).toBe(201);
    const meetingId = m.body.id || m.body.data?.id;

    for (const u of [leader, dev, designer]) {
      await http()
        .post(R.vote(meetingId))
        .set(bearer(u.token))
        .send(CFG.meeting.voteBody(start));
    }

    // 10. project completed, evaluations submitted
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'COMPLETED' },
    });
    const ev = await http()
      .post(R.evaluations(project.id))
      .set(bearer(leader.token))
      .send({
        evaluateeId: dev.id,
        contributionScore: 5,
        communicationScore: 4,
        teamworkScore: 5,
        comment: 'great',
      });
    expect([200, 201]).toContain(ev.status);

    // 11. analytics reflect the finished task
    const an = await http()
      .get(R.analytics(project.id))
      .set(bearer(leader.token));
    expect(an.status).toBe(200);
  });

  it('FLOW-02 a rejected member loses (or never gets) workspace access', async () => {
    const leader = await registerUser(app);
    const u = await registerUser(app);
    const project = await createProject(app, leader);
    await http()
      .post(R.invite(project.id))
      .set(bearer(leader.token))
      .send(CFG.inviteBody(u.id));
    const row = await prisma.projectMember.findFirstOrThrow({
      where: { projectId: project.id, userId: u.id },
    });
    await http()
      .patch(R.member(project.id, row.id))
      .set(bearer(leader.token))
      .send(CFG.memberStatusBody('ACCEPTED'));
    expect(
      (await http().get(R.tasks(project.id)).set(bearer(u.token))).status,
    ).toBe(200);
    await http()
      .patch(R.member(project.id, row.id))
      .set(bearer(leader.token))
      .send(CFG.memberStatusBody('REJECTED'));
    expect(
      (await http().get(R.tasks(project.id)).set(bearer(u.token))).status,
    ).toBe(403);
  });

  it('FLOW-06 deleting a project cascades cleanly and leaves no orphan records', async () => {
    const leader = await registerUser(app);
    const dev = await registerUser(app);
    const project = await createProject(app, leader);
    await http()
      .post(R.invite(project.id))
      .set(bearer(leader.token))
      .send(CFG.inviteBody(dev.id));
    const row = await prisma.projectMember.findFirstOrThrow({
      where: { projectId: project.id, userId: dev.id },
    });
    await http()
      .patch(R.member(project.id, row.id))
      .set(bearer(leader.token))
      .send(CFG.memberStatusBody('ACCEPTED'));

    await http()
      .post(R.tasks(project.id))
      .set(bearer(leader.token))
      .send({ title: 'Task to be deleted', priority: 'LOW' });

    const del = await http()
      .delete(R.project(project.id))
      .set(bearer(leader.token));
    expect([200, 204]).toContain(del.status);

    expect(
      await prisma.projectMember.count({ where: { projectId: project.id } }),
    ).toBe(0);
    expect(await prisma.task.count({ where: { projectId: project.id } })).toBe(
      0,
    );

    const getAfterDel = await http()
      .get(R.project(project.id))
      .set(bearer(leader.token));
    expect(getAfterDel.status).toBe(404);
  });
});
