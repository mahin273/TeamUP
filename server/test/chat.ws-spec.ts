import { INestApplication } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser } from './helpers/auth';
import { projectWithTeam, addMember } from './helpers/factories';
import {
  connect,
  connected,
  onceEvent,
  noEvent,
  refused,
} from './helpers/socket';
import { CFG } from './helpers/config';
import * as jwt from 'jsonwebtoken';

describe('Chat gateway (Socket.IO)', () => {
  let app: INestApplication;
  const open: Socket[] = [];
  const track = (s: Socket) => {
    open.push(s);
    return s;
  };

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(resetDb);
  afterEach(() => {
    while (open.length) open.pop()!.disconnect();
  });

  it('CHAT-01 a member connects with a valid JWT', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const s = track(connect(app, project.id, owner.token));
    await expect(connected(s)).resolves.toBeUndefined();
  });

  it('CHAT-02 refuses a connection without a token', async () => {
    const { project } = await projectWithTeam(app, 0);
    const s = track(connect(app, project.id));
    expect(await refused(s)).toBe('refused');
  });

  it('CHAT-03 refuses an invalid and an expired token', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const bad = track(connect(app, project.id, 'garbage.token.here'));
    expect(await refused(bad)).toBe('refused');
    const expired = jwt.sign(
      { sub: owner.id },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: -10 },
    );
    const exp = track(connect(app, project.id, expired));
    expect(await refused(exp)).toBe('refused');
  });

  it('CHAT-04 refuses a valid user who is not a member', async () => {
    const { project } = await projectWithTeam(app, 0);
    const stranger = await registerUser(app);
    const s = track(connect(app, project.id, stranger.token));
    expect(await refused(s)).toBe('refused');
  });

  it.each(['PENDING', 'REJECTED'] as const)(
    'CHAT-13 [EXPECTED-BUG?] refuses a %s member',
    async (status) => {
      const { project } = await projectWithTeam(app, 0);
      const u = await registerUser(app);
      await addMember(project.id, u, status);
      const s = track(connect(app, project.id, u.token));
      expect(await refused(s)).toBe('refused');
    },
  );

  it('CHAT-05/06 delivers a message to another member and stores it', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const a = track(connect(app, project.id, owner.token));
    const b = track(connect(app, project.id, members[0].token));
    await Promise.all([connected(a), connected(b)]);

    const received = onceEvent(b, CFG.socket.receiveEvent);
    a.emit(CFG.socket.sendEvent, { content: 'hello team' });
    const msg = await received;

    expect(msg.content).toBe('hello team');
    expect(msg.senderId ?? msg.sender?.id).toBe(owner.id);
    const row = await prisma.message.findFirst({
      where: { projectId: project.id },
    });
    expect(row?.content).toBe('hello team');
    expect(row?.senderId).toBe(owner.id);
  });

  it('CHAT-07 room isolation: another project never receives the message', async () => {
    const one = await projectWithTeam(app, 0);
    const two = await projectWithTeam(app, 0);
    const a = track(connect(app, one.project.id, one.owner.token));
    const outsider = track(connect(app, two.project.id, two.owner.token));
    await Promise.all([connected(a), connected(outsider)]);

    const silent = noEvent(outsider, CFG.socket.receiveEvent);
    a.emit(CFG.socket.sendEvent, { content: 'secret for project one' });
    expect(await silent).toBe(true);
  });

  it('CHAT-08 late joiner receives the last 50 messages, oldest first', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const base = Date.now() - 100000;
    await prisma.message.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        projectId: project.id,
        senderId: owner.id,
        content: `m${i}`,
        sentAt: new Date(base + i * 1000),
      })),
    });
    const late = track(connect(app, project.id, members[0].token));
    const history = await onceEvent<any[]>(late, CFG.socket.historyEvent);
    const list = Array.isArray(history) ? history : (history as any).messages;
    expect(list).toHaveLength(50);
    expect(list[0].content).toBe('m10');
    expect(list[49].content).toBe('m59');
  });

  it.each([[''], ['   '], ['\n\t']])(
    'CHAT-09 rejects an empty message %p',
    async (content) => {
      const { owner, project } = await projectWithTeam(app, 0);
      const a = track(connect(app, project.id, owner.token));
      await connected(a);
      a.emit(CFG.socket.sendEvent, { content });
      await new Promise((r) => setTimeout(r, 400));
      expect(
        await prisma.message.count({ where: { projectId: project.id } }),
      ).toBe(0);
    },
  );

  it('CHAT-10 rejects a message over the length limit', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const a = track(connect(app, project.id, owner.token));
    await connected(a);
    a.emit(CFG.socket.sendEvent, {
      content: 'x'.repeat(CFG.limits.maxMessageLength + 1),
    });
    await new Promise((r) => setTimeout(r, 400));
    expect(
      await prisma.message.count({ where: { projectId: project.id } }),
    ).toBe(0);
  });

  it.each([[123], [{}], [null], [undefined], [['a']]])(
    'CHAT-11 survives a bad payload %p',
    async (payload) => {
      const { owner, project } = await projectWithTeam(app, 0);
      const a = track(connect(app, project.id, owner.token));
      await connected(a);
      a.emit(CFG.socket.sendEvent, payload as any);
      await new Promise((r) => setTimeout(r, 300));
      expect(a.connected).toBe(true);
      const b = track(connect(app, project.id, owner.token));
      await expect(connected(b)).resolves.toBeUndefined();
    },
  );

  it('CHAT-12 [EXPECTED-BUG?] ignores a spoofed senderId', async () => {
    const { owner, members, project } = await projectWithTeam(app, 1);
    const a = track(connect(app, project.id, members[0].token));
    await connected(a);
    a.emit(CFG.socket.sendEvent, {
      content: 'i am the owner',
      senderId: owner.id,
    });
    await new Promise((r) => setTimeout(r, 400));
    const row = await prisma.message.findFirst({
      where: { projectId: project.id },
    });
    expect(row?.senderId).toBe(members[0].id);
  });

  it('CHAT-14 stores emoji, unicode and HTML verbatim', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const a = track(connect(app, project.id, owner.token));
    await connected(a);
    const text = 'হ্যালো 😀 <script>alert(1)</script> مرحبا';
    a.emit(CFG.socket.sendEvent, { content: text });
    await new Promise((r) => setTimeout(r, 400));
    const row = await prisma.message.findFirst({
      where: { projectId: project.id },
    });
    expect(row?.content).toBe(text);
  });

  it('CHAT-15 no message is lost with 20 clients sending 5 each', async () => {
    const { owner, members, project } = await projectWithTeam(app, 19);
    const users = [owner, ...members];
    const sockets = users.map((u) => track(connect(app, project.id, u.token)));
    await Promise.all(sockets.map((s) => connected(s)));
    sockets.forEach((s, i) => {
      for (let k = 0; k < 5; k++)
        s.emit(CFG.socket.sendEvent, { content: `u${i}-m${k}` });
    });
    await new Promise((r) => setTimeout(r, 2500));
    expect(
      await prisma.message.count({ where: { projectId: project.id } }),
    ).toBe(100);
  });

  it('CHAT-16 a reconnecting client receives history again', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    await prisma.message.create({
      data: {
        projectId: project.id,
        senderId: owner.id,
        content: 'before',
      },
    });
    const first = track(connect(app, project.id, owner.token));
    await onceEvent(first, CFG.socket.historyEvent);
    first.disconnect();
    const second = track(connect(app, project.id, owner.token));
    const history = await onceEvent<any[]>(second, CFG.socket.historyEvent);
    const list = Array.isArray(history) ? history : (history as any).messages;
    expect(list.map((m: any) => m.content)).toContain('before');
  });
});
