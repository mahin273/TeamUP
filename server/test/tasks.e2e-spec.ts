import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import {
  createProject,
  createTask,
  projectWithTeam,
  addMember,
} from './helpers/factories';
import { R } from './helpers/routes';

describe('Kanban tasks (e2e)', () => {
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

  it('TASK-01 a member creates a task that starts as TODO', async () => {
    const { members, project } = await projectWithTeam(app, 1);
    const task = await createTask(app, project.id, members[0]);
    expect(task.status).toBe('TODO');
  });

  it.each([
    ['empty title', { title: '' }],
    ['bad priority', { priority: 'URGENT!!!' }],
    ['bad date', { dueDate: 'not-a-date' }],
  ])('TASK-02 rejects %s', async (_l, patch) => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await http()
      .post(R.tasks(project.id))
      .set(bearer(owner.token))
      .send({ title: 'x', priority: 'LOW', ...patch });
    expect(res.status).toBe(400);
  });

  it('TASK-03/05 non-members cannot create or read tasks', async () => {
    const { project } = await projectWithTeam(app, 0);
    const stranger = await registerUser(app);
    const c = await http()
      .post(R.tasks(project.id))
      .set(bearer(stranger.token))
      .send({ title: 'x', priority: 'LOW' });
    const r = await http()
      .get(R.tasks(project.id))
      .set(bearer(stranger.token));
    expect(c.status).toBe(403);
    expect(r.status).toBe(403);
  });

  it('TASK-04 a member can read the board', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    await createTask(app, project.id, owner);
    const res = await http()
      .get(R.tasks(project.id))
      .set(bearer(owner.token));
    expect(res.status).toBe(200);
  });

  describe('status changes [CHARACTERISATION: no transition rules]', () => {
    const statuses = ['TODO', 'IN_PROGRESS', 'TESTING', 'DONE'];
    const pairs = statuses.flatMap((from) =>
      statuses.filter((to) => to !== from).map((to) => [from, to]),
    );

    it.each(pairs)('TASK-06 %s -> %s is currently allowed', async (from, to) => {
      const { owner, project } = await projectWithTeam(app, 0);
      const task = await createTask(app, project.id, owner);
      await prisma.task.update({
        where: { id: task.id },
        data: { status: from as any },
      });
      const res = await http()
        .patch(R.task(task.id))
        .set(bearer(owner.token))
        .send({ status: to });
      expect(res.status).toBe(200);
      expect(
        (await prisma.task.findUnique({ where: { id: task.id } }))?.status,
      ).toBe(to);
    });

    it('TASK-07 a DONE task can be reopened', async () => {
      const { owner, project } = await projectWithTeam(app, 0);
      const task = await createTask(app, project.id, owner);
      await http()
        .patch(R.task(task.id))
        .set(bearer(owner.token))
        .send({ status: 'DONE' });
      const res = await http()
        .patch(R.task(task.id))
        .set(bearer(owner.token))
        .send({ status: 'TODO' });
      expect(res.status).toBe(200);
    });

    it('TASK-08 rejects an invalid status value', async () => {
      const { owner, project } = await projectWithTeam(app, 0);
      const task = await createTask(app, project.id, owner);
      const res = await http()
        .patch(R.task(task.id))
        .set(bearer(owner.token))
        .send({ status: 'ARCHIVED_FOREVER' });
      expect(res.status).toBe(400);
    });
  });

  it('TASK-09 assigning creates a notification for the assignee', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const task = await createTask(app, project.id, owner);
    const res = await http()
      .patch(R.task(task.id))
      .set(bearer(owner.token))
      .send({ assigneeId: members[0].id });
    expect(res.status).toBe(200);
    expect(
      await prisma.notification.count({ where: { userId: members[0].id } }),
    ).toBeGreaterThan(0);
  });

  it('TASK-10 [EXPECTED-BUG?] cannot assign a task to a non-member', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const outsider = await registerUser(app);
    const task = await createTask(app, project.id, owner);
    const res = await http()
      .patch(R.task(task.id))
      .set(bearer(owner.token))
      .send({ assigneeId: outsider.id });
    expect([400, 403, 404]).toContain(res.status);
  });

  it('TASK-11 a member of project A cannot edit a task of project B', async () => {
    const a = await projectWithTeam(app, 1);
    const b = await projectWithTeam(app, 0);
    const task = await createTask(app, b.project.id, b.owner);
    const res = await http()
      .patch(R.task(task.id))
      .set(bearer(a.members[0].token))
      .send({ title: 'pwned' });
    expect(res.status).toBe(403);
    expect(
      (await prisma.task.findUnique({ where: { id: task.id } }))?.title,
    ).not.toBe('pwned');
  });

  it('TASK-13 [EXPECTED-BUG?] a PENDING member cannot edit tasks', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const pending = await registerUser(app);
    await addMember(project.id, pending, 'PENDING');
    const task = await createTask(app, project.id, owner);
    const res = await http()
      .patch(R.task(task.id))
      .set(bearer(pending.token))
      .send({ title: 'sneaky' });
    expect(res.status).toBe(403);
  });
});
