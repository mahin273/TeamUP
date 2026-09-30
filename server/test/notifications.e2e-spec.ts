import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { projectWithTeam, createTask } from './helpers/factories';
import { R } from './helpers/routes';

describe('Notifications (e2e)', () => {
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

  const list = (b: any) =>
    Array.isArray(b)
      ? b
      : Array.isArray(b?.data)
        ? b.data
        : (b?.data?.notifications ?? b?.items ?? []);

  it('NOTIF-01/05 assignment creates an in-app notification even with no push token', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const task = await createTask(app, project.id, owner);
    await http()
      .patch(R.task(task.id))
      .set(bearer(owner.token))
      .send({ assigneeId: members[0].id });
    const res = await http().get(R.notifications).set(bearer(members[0].token));
    expect(res.status).toBe(200);
    expect(list(res.body).length).toBeGreaterThan(0);
  });

  it('NOTIF-03 users only see their own notifications', async () => {
    const { owner, members, project } = await projectWithTeam(app, 2);
    const task = await createTask(app, project.id, owner);
    await http()
      .patch(R.task(task.id))
      .set(bearer(owner.token))
      .send({ assigneeId: members[0].id });
    const other = await http()
      .get(R.notifications)
      .set(bearer(members[1].token));
    expect(list(other.body)).toHaveLength(0);
  });

  it('NOTIF-04 marks a notification as read', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const task = await createTask(app, project.id, owner);
    await http()
      .patch(R.task(task.id))
      .set(bearer(owner.token))
      .send({ assigneeId: members[0].id });
    const n = await prisma.notification.findFirstOrThrow({
      where: { userId: members[0].id },
    });
    const res = await http()
      .patch(`${R.notifications}/${n.id}/read`)
      .set(bearer(members[0].token));
    expect([200, 204]).toContain(res.status);
    const after = await prisma.notification.findUniqueOrThrow({
      where: { id: n.id },
    });
    expect((after as any).isRead ?? (after as any).read).toBe(true);
  });

  it("NOTIF-07 cannot read another user's notification", async () => {
    const { owner, members, project } = await projectWithTeam(app, 2);
    const task = await createTask(app, project.id, owner);
    await http()
      .patch(R.task(task.id))
      .set(bearer(owner.token))
      .send({ assigneeId: members[0].id });
    const n = await prisma.notification.findFirstOrThrow({
      where: { userId: members[0].id },
    });
    const res = await http()
      .patch(`${R.notifications}/${n.id}/read`)
      .set(bearer(members[1].token));
    expect([403, 404]).toContain(res.status);
  });
});
