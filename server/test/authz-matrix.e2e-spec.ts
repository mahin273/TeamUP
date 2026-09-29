import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer, TestUser } from './helpers/auth';
import { projectWithTeam, addMember, createTask } from './helpers/factories';
import { R } from './helpers/routes';

type Actor =
  | 'owner'
  | 'member'
  | 'pending'
  | 'rejected'
  | 'stranger'
  | 'anonymous';
const ALLOW: Actor[] = ['owner', 'member'];
const DENY_403: Actor[] = ['pending', 'rejected', 'stranger'];

describe('Project authorization matrix (e2e)', () => {
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

  async function world() {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const pending = await registerUser(app);
    await addMember(project.id, pending, 'PENDING');
    const rejected = await registerUser(app);
    await addMember(project.id, rejected, 'REJECTED');
    const stranger = await registerUser(app);
    const task = await createTask(app, project.id, owner);
    const actors: Record<Actor, TestUser | null> = {
      owner,
      member: members[0],
      pending,
      rejected,
      stranger,
      anonymous: null,
    };
    return { project, task, actors };
  }

  // Add a row here whenever you add a new project-scoped GET endpoint.
  const readEndpoints: [string, (ctx: { projectId: string }) => string][] = [
    ['tasks', ({ projectId }) => R.tasks(projectId)],
    ['files', ({ projectId }) => R.files(projectId)],
    ['analytics', ({ projectId }) => R.analytics(projectId)],
    ['meetings', ({ projectId }) => R.meetings(projectId)],
    ['evaluations', ({ projectId }) => R.evaluations(projectId)],
    ['members', ({ projectId }) => R.members(projectId)],
  ];

  describe.each(readEndpoints)('GET %s', (_name, urlOf) => {
    it.each(ALLOW)('allows %s', async (who) => {
      const w = await world();
      const res = await http()
        .get(urlOf({ projectId: w.project.id }))
        .set(bearer(w.actors[who]!.token));
      expect(res.status).toBe(200);
    });

    it.each(DENY_403)('denies %s with 403', async (who) => {
      const w = await world();
      const res = await http()
        .get(urlOf({ projectId: w.project.id }))
        .set(bearer(w.actors[who]!.token));
      expect(res.status).toBe(403);
    });

    it('denies anonymous with 401', async () => {
      const w = await world();
      const res = await http().get(urlOf({ projectId: w.project.id }));
      expect(res.status).toBe(401);
    });
  });

  describe('write: create task', () => {
    it.each(ALLOW)('allows %s', async (who) => {
      const w = await world();
      const res = await http()
        .post(R.tasks(w.project.id))
        .set(bearer(w.actors[who]!.token))
        .send({ title: 't', priority: 'LOW' });
      expect(res.status).toBe(201);
    });
    it.each(DENY_403)('denies %s', async (who) => {
      const w = await world();
      const res = await http()
        .post(R.tasks(w.project.id))
        .set(bearer(w.actors[who]!.token))
        .send({ title: 't', priority: 'LOW' });
      expect(res.status).toBe(403);
    });
  });

  describe('write: update task', () => {
    it.each(DENY_403)('denies %s', async (who) => {
      const w = await world();
      const res = await http()
        .patch(R.task(w.task.id))
        .set(bearer(w.actors[who]!.token))
        .send({ title: 'nope' });
      expect(res.status).toBe(403);
    });
  });
});
