import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { R } from './routes';
import { CFG } from './config';
import { bearer, TestUser, registerUser } from './auth';
import { prisma } from './db';

export async function addSkill(
  app: INestApplication,
  user: TestUser,
  skillName: string,
  proficiency = 'INTERMEDIATE',
) {
  return request(app.getHttpServer())
    .post(R.skills(user.id))
    .set(bearer(user.token))
    .send(CFG.skillBody(skillName, proficiency));
}

export async function createProject(
  app: INestApplication,
  owner: TestUser,
  overrides: Record<string, any> = {},
) {
  let reqSkills = overrides.requiredSkills ?? ['React', 'NestJS'];
  if (Array.isArray(reqSkills) && reqSkills.length > 0 && typeof reqSkills[0] === 'string') {
    reqSkills = reqSkills.map((s: string) => ({ skillName: s }));
  }

  const payload: any = {
    title: overrides.title ?? faker.lorem.words(3),
    description:
      overrides.description ??
      faker.lorem.sentence() + ' detailed description for project test',
    domain: overrides.domain ?? 'Web',
    semester: overrides.semester ?? 'Fall 2026',
    maxMembers: overrides.teamSizeNeeded ?? overrides.maxMembers ?? 4,
    requiredSkills: reqSkills,
    ...overrides,
  };

  if (overrides.requiredSkills) {
    payload.requiredSkills = reqSkills;
  }
  if (overrides.teamSizeNeeded) {
    payload.maxMembers = overrides.teamSizeNeeded;
  }

  const res = await request(app.getHttpServer())
    .post(R.projects)
    .set(bearer(owner.token))
    .send(payload);

  if (res.status !== 201) {
    throw new Error(`createProject failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body?.data ?? res.body) as { id: string; [k: string]: any };
}

// Fast path: add an ACCEPTED member straight through the DB
export async function addMember(
  projectId: string,
  user: TestUser,
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' = 'ACCEPTED',
) {
  return prisma.projectMember.create({
    data: { projectId, userId: user.id, role: 'MEMBER', status } as any,
  });
}

export async function createTask(
  app: INestApplication,
  projectId: string,
  actor: TestUser,
  overrides: Record<string, any> = {},
) {
  const res = await request(app.getHttpServer())
    .post(R.tasks(projectId))
    .set(bearer(actor.token))
    .send({ title: faker.lorem.words(3), priority: 'MEDIUM', ...overrides });

  if (res.status !== 201) {
    throw new Error(`createTask failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body?.data ?? res.body) as { id: string; status: string; [k: string]: any };
}

// A project with an owner and N accepted members
export async function projectWithTeam(app: INestApplication, memberCount = 2) {
  const owner = await registerUser(app);
  const project = await createProject(app, owner);
  const members: TestUser[] = [];
  for (let i = 0; i < memberCount; i++) {
    const m = await registerUser(app);
    await addMember(project.id, m);
    members.push(m);
  }
  return { owner, members, project };
}
