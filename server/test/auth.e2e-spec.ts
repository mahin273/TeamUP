import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { R } from './helpers/routes';

describe('Auth (e2e)', () => {
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

  const validBody = () => ({
    name: 'Test User',
    fullName: 'Test User',
    email: 'test@example.com',
    password: 'Str0ng!Pass123',
  });

  describe('register', () => {
    it('AUTH-01 registers a user, hides the hash, defaults role to STUDENT', async () => {
      const res = await http().post(R.register).send(validBody());
      expect([200, 201]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
      const db = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });
      expect(db).toBeTruthy();
      expect(db!.role).toBe('STUDENT');
    });

    it('AUTH-23 stores a hash, not the plain password', async () => {
      await http().post(R.register).send(validBody());
      const db = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });
      expect(db!.passwordHash).not.toBe('Str0ng!Pass123');
      expect(db!.passwordHash.length).toBeGreaterThan(30);
    });

    it('AUTH-02 rejects a duplicate email', async () => {
      await http().post(R.register).send(validBody());
      const res = await http().post(R.register).send(validBody());
      expect([400, 409]).toContain(res.status);
    });

    it('AUTH-03 rejects duplicate email with different case', async () => {
      await http().post(R.register).send(validBody());
      const res = await http()
        .post(R.register)
        .send({ ...validBody(), email: 'TEST@Example.com' });
      expect([400, 409]).toContain(res.status);
    });

    it.each([
      ['invalid email', { email: 'not-an-email' }],
      ['empty password', { password: '' }],
      ['short password', { password: '123' }],
      ['missing email', { email: undefined }],
      ['missing password', { password: undefined }],
    ])('AUTH-04/05/06 rejects %s', async (_label, patch) => {
      const res = await http()
        .post(R.register)
        .send({ ...validBody(), ...patch });
      expect(res.status).toBe(400);
    });

    it('AUTH-07 [EXPECTED-BUG?] ignores role=ADMIN sent by the client', async () => {
      await http()
        .post(R.register)
        .send({ ...validBody(), role: 'ADMIN' });
      const db = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      });
      expect(db?.role).toBe('STUDENT');
    });

    it('AUTH-21 handles very long input without crashing', async () => {
      const res = await http()
        .post(R.register)
        .send({
          ...validBody(),
          name: 'x'.repeat(20000),
          fullName: 'x'.repeat(20000),
        });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('login', () => {
    it('AUTH-08 logs in with correct credentials', async () => {
      const u = await registerUser(app);
      expect(u.token).toBeTruthy();
      expect(u.refreshToken).toBeTruthy();
    });

    it('AUTH-09/10 gives the same error for wrong password and unknown email', async () => {
      const u = await registerUser(app);
      const wrongPw = await http()
        .post(R.login)
        .send({ email: u.email, password: 'WrongPass!1' });
      const noUser = await http()
        .post(R.login)
        .send({ email: 'ghost@nowhere.com', password: 'WrongPass!1' });
      expect(wrongPw.status).toBe(401);
      expect(noUser.status).toBe(401);
      const msg1 =
        wrongPw.body?.error?.message ??
        wrongPw.body?.message ??
        wrongPw.body?.error;
      const msg2 =
        noUser.body?.error?.message ??
        noUser.body?.message ??
        noUser.body?.error;
      expect(msg1).toEqual(msg2);
    });

    it('AUTH-19 never returns password or hash', async () => {
      const u = await registerUser(app);
      const res = await http()
        .post(R.login)
        .send({ email: u.email, password: u.password });
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(u.password);
      expect(text).not.toMatch(/passwordHash/i);
    });

    it('AUTH-20 survives SQL-injection style input', async () => {
      const res = await http()
        .post(R.login)
        .send({ email: "' OR 1=1 --", password: 'x' });
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('token protection', () => {
    it('AUTH-11 rejects a request with no token', async () => {
      const res = await http().get(R.me);
      expect(res.status).toBe(401);
    });

    it('AUTH-12 rejects a malformed token', async () => {
      const res = await http().get(R.me).set(bearer('abc.def.ghi'));
      expect(res.status).toBe(401);
    });

    it('AUTH-13 rejects a token signed with the wrong secret', async () => {
      const u = await registerUser(app);
      const forged = jwt.sign({ sub: u.id }, 'wrong-secret', {
        expiresIn: '15m',
      });
      const res = await http().get(R.me).set(bearer(forged));
      expect(res.status).toBe(401);
    });

    it('AUTH-14 rejects an expired token', async () => {
      const u = await registerUser(app);
      const expired = jwt.sign(
        { sub: u.id },
        process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET!,
        { expiresIn: -10 },
      );
      const res = await http().get(R.me).set(bearer(expired));
      expect(res.status).toBe(401);
    });

    it('SEC-11 rejects an unsigned (alg=none) token', async () => {
      const u = await registerUser(app);
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      ).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: u.id })).toString(
        'base64url',
      );
      const res = await http()
        .get(R.me)
        .set(bearer(`${header}.${payload}.`));
      expect(res.status).toBe(401);
    });
  });

  describe('refresh', () => {
    it('AUTH-15 issues new tokens for a valid refresh token', async () => {
      const u = await registerUser(app);
      const res = await http()
        .post(R.refresh)
        .send({ refreshToken: u.refreshToken });
      expect([200, 201]).toContain(res.status);
      const count = await prisma.refreshToken.count({
        where: { userId: u.id },
      });
      expect(count).toBeGreaterThan(0);
    });

    it('AUTH-16 [EXPECTED-BUG?] rejects reuse of a rotated refresh token', async () => {
      const u = await registerUser(app);
      const first = await http()
        .post(R.refresh)
        .send({ refreshToken: u.refreshToken });
      expect([200, 201]).toContain(first.status);
      const reuse = await http()
        .post(R.refresh)
        .send({ refreshToken: u.refreshToken });
      expect(reuse.status).toBe(401);
    });

    it('AUTH-17 rejects an expired refresh token', async () => {
      const u = await registerUser(app);
      const expired = jwt.sign({ sub: u.id }, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: -10,
      });
      const res = await http().post(R.refresh).send({ refreshToken: expired });
      expect(res.status).toBe(401);
    });

    it('AUTH-18 rejects a refresh token used as an access token', async () => {
      const u = await registerUser(app);
      const res = await http().get(R.me).set(bearer(u.refreshToken));
      expect(res.status).toBe(401);
    });
  });
});
