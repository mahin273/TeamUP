import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { createProject } from './helpers/factories';
import { R } from './helpers/routes';

describe('Marketplace & search (e2e)', () => {
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

  const list = (body: any) => {
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.projects)) return body.projects;
    if (Array.isArray(body?.data)) return body.data;
    if (Array.isArray(body?.items)) return body.items;
    if (Array.isArray(body?.data?.projects)) return body.data.projects;
    if (Array.isArray(body?.data?.items)) return body.data.items;
    return [];
  };

  it('MKT-01 creates a project and makes the creator an accepted OWNER member', async () => {
    const owner = await registerUser(app);
    const project = await createProject(app, owner);
    const m = await prisma.projectMember.findFirst({
      where: { projectId: project.id, userId: owner.id },
    });
    expect(m?.roleInProject).toBe('OWNER');
    expect(m?.status).toBe('ACCEPTED');
  });

  it.each([
    ['missing title', { title: undefined }],
    ['negative team size', { teamSizeNeeded: -3 }],
    ['zero team size', { teamSizeNeeded: 0 }],
    ['requiredSkills not an array', { requiredSkills: 'React' }],
    ['requiredSkills with numbers', { requiredSkills: [1, 2] }],
  ])('MKT-02/03 rejects %s', async (_l, patch) => {
    const owner = await registerUser(app);
    const res = await http()
      .post(R.projects)
      .set(bearer(owner.token))
      .send({
        title: 'T',
        description: 'D',
        domain: 'Web',
        requiredSkills: ['React'],
        teamSizeNeeded: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        ...patch,
      });
    expect(res.status).toBe(400);
  });

  it('MKT-04 paginates and caps the limit', async () => {
    const owner = await registerUser(app);
    for (let i = 0; i < 12; i++)
      await createProject(app, owner, { title: `Proj ${i}` });
    const p1 = await http()
      .get(`${R.projects}?page=1&limit=5`)
      .set(bearer(owner.token));
    const p2 = await http()
      .get(`${R.projects}?page=2&limit=5`)
      .set(bearer(owner.token));
    expect(list(p1.body)).toHaveLength(5);
    expect(list(p2.body)).toHaveLength(5);
    const huge = await http()
      .get(`${R.projects}?limit=100000`)
      .set(bearer(owner.token));
    expect(list(huge.body).length).toBeLessThanOrEqual(100);
  });

  it('MKT-05/06 only the owner can update or delete', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const project = await createProject(app, owner);
    const ok = await http()
      .patch(R.project(project.id))
      .set(bearer(owner.token))
      .send({ title: 'New title' });
    const bad = await http()
      .patch(R.project(project.id))
      .set(bearer(other.token))
      .send({ title: 'Hacked' });
    const del = await http()
      .delete(R.project(project.id))
      .set(bearer(other.token));
    expect(ok.status).toBe(200);
    expect(bad.status).toBe(403);
    expect(del.status).toBe(403);
  });

  describe('search', () => {
    beforeEach(async () => {
      const o = await registerUser(app);
      await createProject(app, o, {
        title: 'AI Tutor',
        domain: 'AI',
        requiredSkills: ['Python'],
      });
      await createProject(app, o, {
        title: 'Health Tracker',
        domain: 'Healthcare',
        requiredSkills: ['React Native'],
      });
      await createProject(app, o, {
        title: 'Smart Home',
        domain: 'IoT',
        requiredSkills: ['Python', 'C++'],
      });
    });

    const search = async (qs: string) => {
      const u = await registerUser(app);
      return http()
        .get(`${R.search}?${qs}`)
        .set(bearer(u.token));
    };

    it('SRCH-07 route ordering: /search is not treated as :id', async () => {
      const res = await search('domain=AI');
      expect(res.status).toBe(200);
    });

    it('SRCH-01 filters by domain', async () => {
      const res = await search('domain=AI');
      expect(list(res.body).map((p: any) => p.domain)).toEqual(['AI']);
    });

    it('SRCH-04 keyword search is case-insensitive', async () => {
      const res = await search('q=health');
      expect(list(res.body).length).toBeGreaterThanOrEqual(1);
    });

    it('SRCH-05 returns 200 and an empty list when nothing matches', async () => {
      const res = await search('domain=Blockchain');
      expect(res.status).toBe(200);
      expect(list(res.body)).toHaveLength(0);
    });

    it.each(['%', '_', "'", '\\', "'; DROP TABLE \"Project\";--"])(
      'SRCH-06 handles special text %p',
      async (text) => {
        const res = await search(`q=${encodeURIComponent(text)}`);
        expect(res.status).toBeLessThan(500);
      },
    );
  });
});
