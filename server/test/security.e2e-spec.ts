import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { projectWithTeam, createTask } from './helpers/factories';
import { R } from './helpers/routes';

describe('Security sweep (e2e)', () => {
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

  const INJECTIONS = [
    "' OR '1'='1",
    '"; DROP TABLE "User"; --',
    '<script>alert(1)</script>',
    '../../../etc/passwd',
    '${7*7}',
    '{{7*7}}',
    '\u0000',
    'A'.repeat(50000),
  ];

  it("SEC-01 IDOR: user B cannot read or edit user A's project data by guessing ids", async () => {
    const a = await projectWithTeam(app, 0);
    const b = await registerUser(app);
    const task = await createTask(app, a.project.id, a.owner);
    const checks = [
      http().get(R.tasks(a.project.id)).set(bearer(b.token)),
      http().patch(R.task(task.id)).set(bearer(b.token)).send({ title: 'x' }),
      http().get(R.files(a.project.id)).set(bearer(b.token)),
      http().get(R.analytics(a.project.id)).set(bearer(b.token)),
    ];
    for (const res of await Promise.all(checks)) {
      expect([403, 404]).toContain(res.status);
    }
  });

  it.each(INJECTIONS)(
    'SEC-03 no 500 from hostile input %#',
    async (payload) => {
      const u = await registerUser(app);
      const results = await Promise.all([
        http()
          .post(R.projects)
          .set(bearer(u.token))
          .send({
            title: payload,
            description: payload,
            domain: payload,
            requiredSkills: [payload],
            teamSizeNeeded: 2,
          }),
        http()
          .get(`${R.search}?q=${encodeURIComponent(payload.slice(0, 500))}`)
          .set(bearer(u.token)),
        http().patch(R.me).set(bearer(u.token)).send({ bio: payload }),
        http().post(R.login).send({ email: payload, password: payload }),
      ]);
      for (const r of results) {
        expect(r.status).toBeLessThan(500);
      }
    },
  );

  it('SEC-05 errors never leak stack traces, SQL or file paths', async () => {
    const u = await registerUser(app);
    const res = await http().get(R.profile('not-a-uuid')).set(bearer(u.token));
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(
      /at .*\.(ts|js):\d+|prisma|SELECT |node_modules|\/home\//i,
    );
  });

  it('SEC-06 all error responses share one JSON shape', async () => {
    const u = await registerUser(app);
    const shapes = await Promise.all([
      http().get(R.me), // 401
      http().get(R.profile('not-a-uuid')).set(bearer(u.token)), // 400
      http()
        .get(R.profile('00000000-0000-4000-8000-000000000000'))
        .set(bearer(u.token)), // 404
    ]);
    const keys = shapes.map((r) => Object.keys(r.body).sort().join(','));
    expect(new Set(keys).size).toBe(1);
  });

  it('SEC-02 mass assignment: cannot set creatorId or status when creating a project', async () => {
    const owner = await registerUser(app);
    const victim = await registerUser(app);
    const res = await http()
      .post(R.projects)
      .set(bearer(owner.token))
      .send({
        title: 'T',
        description: 'D',
        domain: 'Web',
        requiredSkills: ['x'],
        teamSizeNeeded: 2,
        creatorId: victim.id,
        status: 'COMPLETED',
      });
    if (res.status === 201) {
      const projId = res.body.id || res.body.data?.id;
      const p = await prisma.project.findUniqueOrThrow({
        where: { id: projId },
      });
      expect(p.creatorId).toBe(owner.id);
      expect(p.status).toBe('OPEN');
    }
  });

  it('SEC-12 the password hash never appears in any user-related response', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const responses = await Promise.all([
      http().get(R.members(project.id)).set(bearer(owner.token)),
      http().get(R.profile(members[0].id)).set(bearer(owner.token)),
      http().get(R.recommendations(project.id)).set(bearer(owner.token)),
    ]);
    for (const r of responses) {
      expect(JSON.stringify(r.body)).not.toMatch(
        /passwordHash|\$2[aby]\$|argon2/i,
      );
    }
  });
});
