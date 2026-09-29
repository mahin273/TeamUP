import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { projectWithTeam } from './helpers/factories';
import { R } from './helpers/routes';

describe('Peer evaluations (e2e)', () => {
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

  const body = (evaluateeId: string, overrides: Record<string, any> = {}) => ({
    evaluateeId,
    contributionScore: 4,
    communicationScore: 5,
    teamworkScore: 4,
    comment: 'Great teammate!',
    ...overrides,
  });

  it('EVAL-01 a member evaluates a teammate', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const res = await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(members[0].id));
    expect([200, 201]).toContain(res.status);
    expect(
      await prisma.evaluation.count({ where: { projectId: project.id } }),
    ).toBe(1);
  });

  it.each([
    ['contributionScore', 0],
    ['contributionScore', 6],
    ['communicationScore', -1],
    ['teamworkScore', 2.5],
    ['teamworkScore', 'abc'],
  ])('EVAL-02 rejects %s = %p', async (field, value) => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const res = await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(members[0].id, { [field]: value }));
    expect(res.status).toBe(400);
  });

  it('EVAL-03 rejects a missing score', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const res = await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(members[0].id, { teamworkScore: undefined }));
    expect(res.status).toBe(400);
  });

  it('EVAL-04 [EXPECTED-BUG?] rejects self-evaluation', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(owner.id));
    expect([400, 403]).toContain(res.status);
  });

  it('EVAL-05 [EXPECTED-BUG?] one evaluator cannot rate the same person twice', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(members[0].id));
    await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(members[0].id, { contributionScore: 1 }));
    const n = await prisma.evaluation.count({
      where: {
        projectId: project.id,
        evaluatorId: owner.id,
        evaluateeId: members[0].id,
      },
    });
    expect(n).toBe(1);
  });

  it('EVAL-06 cannot evaluate someone outside the project', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const outsider = await registerUser(app);
    const res = await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(outsider.id));
    expect([400, 403, 404]).toContain(res.status);
  });

  it('EVAL-07 an outsider cannot evaluate', async () => {
    const { members, project } = await projectWithTeam(app, 1);
    const outsider = await registerUser(app);
    const res = await http()
      .post(R.evaluations(project.id))
      .set(bearer(outsider.token))
      .send(body(members[0].id));
    expect(res.status).toBe(403);
  });

  it('EVAL-08 [CHARACTERISATION] evaluation is allowed while the project is not completed', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    expect(
      (
        await prisma.project.findUniqueOrThrow({
          where: { id: project.id },
        })
      ).status,
    ).not.toBe('COMPLETED');
    const res = await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(members[0].id));
    expect([200, 201]).toContain(res.status);
  });

  it('EVAL-09 [CHARACTERISATION / PRIVACY FINDING] list exposes evaluator identity', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(members[0].id));
    const res = await http()
      .get(R.evaluations(project.id))
      .set(bearer(members[0].token));
    const text = JSON.stringify(res.body);
    // Documents current behaviour. Raise with the product owner: should email be exposed?
    expect(text).toContain(owner.id);
    expect(text).toContain(owner.email);
  });

  it('EVAL-10 stores an HTML comment as plain text', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    await http()
      .post(R.evaluations(project.id))
      .set(bearer(owner.token))
      .send(body(members[0].id, { comment: '<img src=x onerror=alert(1)>' }));
    const row = await prisma.evaluation.findFirstOrThrow({
      where: { projectId: project.id },
    });
    expect(row.comment).toBe('<img src=x onerror=alert(1)>'); // stored verbatim; RN must render as text (FE tests)
  });
});
