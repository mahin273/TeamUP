import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { createProject } from './helpers/factories';
import { R } from './helpers/routes';

describe('Bookmarks (e2e)', () => {
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

  it('BKM-01 bookmarks a project', async () => {
    const owner = await registerUser(app);
    const fan = await registerUser(app);
    const project = await createProject(app, owner);
    const res = await http()
      .post(R.bookmarks)
      .set(bearer(fan.token))
      .send({ targetType: 'PROJECT', targetId: project.id });
    expect([200, 201]).toContain(res.status);
    expect(await prisma.bookmark.count({ where: { userId: fan.id } })).toBe(1);
  });

  it('BKM-03 rejects targetType USER (not supported by the backend)', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const res = await http()
      .post(R.bookmarks)
      .set(bearer(a.token))
      .send({ targetType: 'USER', targetId: b.id });
    expect(res.status).toBe(400);
  });

  it('BKM-04 rejects a made-up targetType', async () => {
    const a = await registerUser(app);
    const res = await http()
      .post(R.bookmarks)
      .set(bearer(a.token))
      .send({
        targetType: 'BANANA',
        targetId: '00000000-0000-4000-8000-000000000000',
      });
    expect(res.status).toBe(400);
  });

  it('BKM-05 does not create duplicates', async () => {
    const owner = await registerUser(app);
    const fan = await registerUser(app);
    const project = await createProject(app, owner);
    const body = { targetType: 'PROJECT', targetId: project.id };
    await http().post(R.bookmarks).set(bearer(fan.token)).send(body);
    await http().post(R.bookmarks).set(bearer(fan.token)).send(body);
    expect(await prisma.bookmark.count({ where: { userId: fan.id } })).toBe(1);
  });

  it('BKM-06 [EXPECTED-BUG?] rejects a non-existent target', async () => {
    const a = await registerUser(app);
    const res = await http()
      .post(R.bookmarks)
      .set(bearer(a.token))
      .send({
        targetType: 'PROJECT',
        targetId: '00000000-0000-4000-8000-000000000000',
      });
    expect([400, 404]).toContain(res.status);
  });

  it('BKM-07 lists only my own bookmarks', async () => {
    const owner = await registerUser(app);
    const a = await registerUser(app);
    const b = await registerUser(app);
    const project = await createProject(app, owner);
    await http()
      .post(R.bookmarks)
      .set(bearer(a.token))
      .send({ targetType: 'PROJECT', targetId: project.id });
    const res = await http().get(R.bookmarks).set(bearer(b.token));
    const list = Array.isArray(res.body) ? res.body : res.body.data ?? [];
    expect(list).toHaveLength(0);
  });

  it("BKM-09 cannot delete another user's bookmark", async () => {
    const owner = await registerUser(app);
    const a = await registerUser(app);
    const b = await registerUser(app);
    const project = await createProject(app, owner);
    await http()
      .post(R.bookmarks)
      .set(bearer(a.token))
      .send({ targetType: 'PROJECT', targetId: project.id });
    const bm = await prisma.bookmark.findFirst({ where: { userId: a.id } });
    const res = await http()
      .delete(`${R.bookmarks}/${bm!.id}`)
      .set(bearer(b.token));
    expect([403, 404]).toContain(res.status);
    expect(await prisma.bookmark.count({ where: { id: bm!.id } })).toBe(1);
  });

  it('BKM-10 listing does not crash when a bookmarked project was deleted', async () => {
    const owner = await registerUser(app);
    const fan = await registerUser(app);
    const project = await createProject(app, owner);
    await http()
      .post(R.bookmarks)
      .set(bearer(fan.token))
      .send({ targetType: 'PROJECT', targetId: project.id });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project
      .delete({ where: { id: project.id } })
      .catch(() => undefined);
    const res = await http().get(R.bookmarks).set(bearer(fan.token));
    expect(res.status).toBeLessThan(500);
  });
});
