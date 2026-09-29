import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { addSkill } from './helpers/factories';
import { githubMock } from './mocks/github.mock';
import { R } from './helpers/routes';

describe('Profiles & GitHub (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetDb();
    githubMock.mode = 'ok';
  });

  it('PROF-01 returns my profile without sensitive fields', async () => {
    const u = await registerUser(app);
    const res = await http().get(R.me).set(bearer(u.token));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
  });

  it('PROF-02 updates bio, department and semester', async () => {
    const u = await registerUser(app);
    const res = await http()
      .patch(R.me)
      .set(bearer(u.token))
      .send({ bio: 'I love backend', department: 'EEE', semester: 6 });
    expect(res.status).toBe(200);
    const again = await http().get(R.me).set(bearer(u.token));
    expect(JSON.stringify(again.body)).toContain('I love backend');
  });

  it.each([[0], [9], [-1], ['abc']])(
    'PROF-03 rejects invalid semester %p',
    async (semester) => {
      const u = await registerUser(app);
      const res = await http()
        .patch(R.me)
        .set(bearer(u.token))
        .send({ semester });
      expect(res.status).toBe(400);
    },
  );

  it('PROF-04 rejects invalid experienceLevel', async () => {
    const u = await registerUser(app);
    const res = await http()
      .patch(R.me)
      .set(bearer(u.token))
      .send({ experienceLevel: 'GODLIKE' });
    expect(res.status).toBe(400);
  });

  it('PROF-05 [EXPECTED-BUG?] cannot change email, id or role through PATCH', async () => {
    const u = await registerUser(app);
    await http()
      .patch(R.me)
      .set(bearer(u.token))
      .send({ email: 'hacker@x.com', role: 'ADMIN', id: 'x' });
    const db = await prisma.user.findUnique({ where: { id: u.id } });
    expect(db!.email).toBe(u.email);
    expect(db!.role).toBe('STUDENT');
  });

  it('PROF-06 adds a skill', async () => {
    const u = await registerUser(app);
    const res = await addSkill(app, u, 'React', 'ADVANCED');
    expect([200, 201]).toContain(res.status);
    expect(await prisma.skillTag.count({ where: { userId: u.id } })).toBe(1);
  });

  it('PROF-07/08 does not create duplicate skills for case variants', async () => {
    const u = await registerUser(app);
    await addSkill(app, u, 'React');
    await addSkill(app, u, 'react');
    await addSkill(app, u, ' React ');
    expect(await prisma.skillTag.count({ where: { userId: u.id } })).toBe(1);
  });

  it('PROF-09 rejects an invalid proficiency', async () => {
    const u = await registerUser(app);
    const res = await addSkill(app, u, 'React', 'WIZARD');
    expect(res.status).toBe(400);
  });

  it("PROF-10 forbids editing another user's skills", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const res = await http()
      .post(R.skills(b.id))
      .set(bearer(a.token))
      .send({ skillName: 'Hack', proficiency: 'ADVANCED' });
    expect([403, 404]).toContain(res.status);
    expect(await prisma.skillTag.count({ where: { userId: b.id } })).toBe(0);
  });

  it("PROF-11 hides email and hash on another user's public profile", async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const res = await http().get(R.profile(b.id)).set(bearer(a.token));
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/passwordHash/i);
    expect(text).not.toContain(b.email);
  });

  it('PROF-12 returns 404 for an unknown user', async () => {
    const a = await registerUser(app);
    const res = await http()
      .get(R.profile('00000000-0000-4000-8000-000000000000'))
      .set(bearer(a.token));
    expect(res.status).toBe(404);
  });

  it('PROF-13 returns 400 (not 500) for a non-UUID id', async () => {
    const a = await registerUser(app);
    const res = await http().get(R.profile('not-a-uuid')).set(bearer(a.token));
    expect(res.status).toBe(400);
  });

  it('PROF-14 rejects a javascript: portfolio URL', async () => {
    const u = await registerUser(app);
    const res = await http()
      .patch(R.me)
      .set(bearer(u.token))
      .send({ portfolioUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('PROF-15 saves availability on the profile', async () => {
    const u = await registerUser(app);
    const res = await http()
      .patch(R.me)
      .set(bearer(u.token))
      .send({ availability: false });
    expect(res.status).toBe(200);
    const profile = await prisma.profile.findFirst({
      where: { userId: u.id },
    });
    expect(profile?.availability).toBe(false);
  });

  describe('GitHub', () => {
    it('GH-01 returns stats for a valid username', async () => {
      const u = await registerUser(app);
      await http()
        .patch(R.me)
        .set(bearer(u.token))
        .send({ githubUsername: 'octocat' });
      const res = await http().get(R.github(u.id)).set(bearer(u.token));
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain('demo');
    });

    it('GH-02 works when the user has no GitHub username', async () => {
      const u = await registerUser(app);
      const res = await http().get(R.github(u.id)).set(bearer(u.token));
      expect(res.status).toBeLessThan(500);
    });

    it.each(['notfound', 'ratelimit', 'error', 'timeout'] as const)(
      'GH-03/04/05 degrades gracefully when GitHub is %s',
      async (mode) => {
        const u = await registerUser(app);
        await http()
          .patch(R.me)
          .set(bearer(u.token))
          .send({ githubUsername: 'octocat' });
        githubMock.mode = mode;
        const gh = await http().get(R.github(u.id)).set(bearer(u.token));
        expect(gh.status).toBeLessThan(500);
        const profile = await http().get(R.profile(u.id)).set(bearer(u.token));
        expect(profile.status).toBe(200);
      },
    );
  });
});
