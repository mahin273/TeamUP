import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { R } from './routes';
import { CFG } from './config';
import { prisma } from './db';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  refreshToken: string;
}

export function pickToken(body: any, which: 'access' | 'refresh'): string {
  const key = CFG.tokenFields[which];
  return (
    body?.data?.[key] ??
    body?.[key] ??
    body?.data?.tokens?.[key] ??
    body?.tokens?.[key] ??
    body?.data?.[which === 'access' ? 'access_token' : 'refresh_token'] ??
    body?.[which === 'access' ? 'access_token' : 'refresh_token'] ??
    ''
  );
}

export async function registerUser(
  app: INestApplication,
  overrides: Record<string, any> = {},
): Promise<TestUser> {
  const password = overrides.password ?? 'Str0ng!Pass123';
  const email = (overrides.email ?? faker.internet.email()).toLowerCase();
  const fullName = overrides.fullName ?? overrides.name ?? faker.person.fullName();
  const body = {
    fullName,
    email,
    password,
    ...overrides,
  };

  const reg = await request(app.getHttpServer()).post(R.register).send(body);
  if (![200, 201].includes(reg.status)) {
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  }

  const login = await request(app.getHttpServer()).post(R.login).send({ email, password });
  if (login.status !== 200 && login.status !== 201) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  const dbUser = await prisma.user.findUnique({ where: { email } });
  const latestToken = await prisma.refreshToken.findFirst({
    where: { userId: dbUser!.id },
    orderBy: { createdAt: 'desc' },
  });
  if (latestToken) {
    await prisma.refreshToken.deleteMany({
      where: { userId: dbUser!.id, id: { not: latestToken.id } },
    });
  }

  return {
    id: dbUser!.id,
    email,
    password,
    token: pickToken(login.body, 'access'),
    refreshToken: pickToken(login.body, 'refresh'),
  };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function makeAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
}
