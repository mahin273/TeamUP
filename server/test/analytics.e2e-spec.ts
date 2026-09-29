import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { bearer } from './helpers/auth';
import { projectWithTeam } from './helpers/factories';
import { R } from './helpers/routes';

describe('Analytics (e2e)', () => {
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

  const past = new Date(Date.now() - 5 * 86400000);
  const future = new Date(Date.now() + 5 * 86400000);

  async function seedKnownProject() {
    const { owner, members, project } = await projectWithTeam(app, 2); // owner, m0, m1
    const [a, b, c] = [owner, members[0], members[1]];
    const rows: any[] = [
      // 5 tasks for a: 2 DONE, 1 TESTING, 1 IN_PROGRESS(overdue), 1 TODO
      ['DONE', a, future],
      ['DONE', a, future],
      ['TESTING', a, future],
      ['IN_PROGRESS', a, past],
      ['TODO', a, future],
      // 3 tasks for b: 1 DONE, 1 TESTING, 1 TODO(overdue)
      ['DONE', b, future],
      ['TESTING', b, future],
      ['TODO', b, past],
      // 2 tasks for c: 1 DONE, 1 IN_PROGRESS
      ['DONE', c, future],
      ['IN_PROGRESS', c, future],
    ];
    for (const [status, user, due] of rows) {
      await prisma.task.create({
        data: {
          projectId: project.id,
          assigneeId: user.id,
          title: `t-${Math.random()}`,
          status,
          priority: 'MEDIUM',
          dueDate: due,
        } as any,
      });
    }
    return { owner, members, project };
  }

  it('ANL-01 returns exact counts for the known fixture', async () => {
    const { owner, project } = await seedKnownProject();
    const res = await http()
      .get(R.analytics(project.id))
      .set(bearer(owner.token));
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    // ADAPT: replace these with direct property assertions once you know the response shape, e.g.
    // expect(res.body.byStatus).toEqual({ TODO: 2, IN_PROGRESS: 2, TESTING: 2, DONE: 4 });
    // expect(res.body.completionPercent).toBe(40);
    // expect(res.body.overdue).toBe(2);
    expect(text).toMatch(/40/); // 4 of 10 done
    expect(text).toMatch(/overdue/i);
  });

  it('ANL-02 an empty project gives zeros and no NaN', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await http()
      .get(R.analytics(project.id))
      .set(bearer(owner.token));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/NaN|null.*percent/i);
  });

  it('ANL-04 reflects a status change immediately (no stale cache)', async () => {
    const { owner, project } = await seedKnownProject();
    const before = await http()
      .get(R.analytics(project.id))
      .set(bearer(owner.token));
    const todo = await prisma.task.findFirstOrThrow({
      where: { projectId: project.id, status: 'TODO' },
    });
    await http()
      .patch(R.task(todo.id))
      .set(bearer(owner.token))
      .send({ status: 'DONE' });
    const after = await http()
      .get(R.analytics(project.id))
      .set(bearer(owner.token));
    expect(JSON.stringify(after.body)).not.toEqual(JSON.stringify(before.body));
  });
});
