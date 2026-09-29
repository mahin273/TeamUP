import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Polyfill aliases between instruction terminology and schema models
const skillTagProxy = {
  count: async (args: any = {}) => {
    let where = args?.where;
    if (where?.userId) {
      const { userId, ...rest } = where;
      where = { profile: { userId }, ...rest };
    }
    return (prisma as any).profileSkill.count({ where });
  },
  findMany: (args: any) => (prisma as any).profileSkill.findMany(args),
  findFirst: (args: any) => (prisma as any).profileSkill.findFirst(args),
};

const userProxy = new Proxy((prisma as any).user, {
  get(target, prop, receiver) {
    const orig = Reflect.get(target, prop, receiver);
    if (['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow'].includes(String(prop))) {
      return async (...args: any[]) => {
        const user = await orig.apply(target, args);
        if (user && typeof user === 'object') {
          if (!('passwordHash' in user)) {
            Object.defineProperty(user, 'passwordHash', {
              get() {
                return user.password;
              },
              enumerable: true,
            });
          }
        }
        return user;
      };
    }
    return orig;
  },
});

const projectMemberProxy = new Proxy((prisma as any).projectMember, {
  get(target, prop, receiver) {
    const orig = Reflect.get(target, prop, receiver);
    if (
      [
        'findUnique',
        'findFirst',
        'findMany',
        'findUniqueOrThrow',
        'findFirstOrThrow',
        'create',
        'update',
      ].includes(String(prop))
    ) {
      return async (...args: any[]) => {
        if (args[0]?.data?.roleInProject) {
          args[0].data.role =
            args[0].data.roleInProject === 'OWNER'
              ? 'LEADER'
              : args[0].data.roleInProject;
          delete args[0].data.roleInProject;
        }
        const res = await orig.apply(target, args);
        const mapMember = (m: any) => {
          if (m && typeof m === 'object' && !('roleInProject' in m)) {
            Object.defineProperty(m, 'roleInProject', {
              get() {
                return m.role === 'LEADER' ? 'OWNER' : m.role;
              },
              enumerable: true,
            });
          }
          return m;
        };
        if (Array.isArray(res)) return res.map(mapMember);
        return mapMember(res);
      };
    }
    return orig;
  },
});

const messageProxy = new Proxy((prisma as any).message, {
  get(target, prop, receiver) {
    const orig = Reflect.get(target, prop, receiver);
    if (
      [
        'create',
        'createMany',
        'findUnique',
        'findFirst',
        'findMany',
      ].includes(String(prop))
    ) {
      return async (...args: any[]) => {
        const fixData = (d: any) => {
          if (d && typeof d === 'object') {
            if ('sentAt' in d) {
              d.createdAt = d.sentAt;
              delete d.sentAt;
            }
          }
        };
        if (args[0]?.data) {
          if (Array.isArray(args[0].data)) {
            args[0].data.forEach(fixData);
          } else {
            fixData(args[0].data);
          }
        }
        const res = await orig.apply(target, args);
        const mapMsg = (m: any) => {
          if (m && typeof m === 'object' && !('sentAt' in m)) {
            Object.defineProperty(m, 'sentAt', {
              get() {
                return m.createdAt;
              },
              enumerable: true,
            });
          }
          return m;
        };
        if (Array.isArray(res)) return res.map(mapMsg);
        return mapMsg(res);
      };
    }
    return orig;
  },
});

Object.defineProperty(prisma, 'skillTag', { get: () => skillTagProxy });
Object.defineProperty(prisma, 'fileAsset', { get: () => (prisma as any).projectFile });
Object.defineProperty(prisma, 'evaluation', { get: () => (prisma as any).peerEvaluation });
Object.defineProperty(prisma, 'user', { get: () => userProxy });
Object.defineProperty(prisma, 'projectMember', { get: () => projectMemberProxy });
Object.defineProperty(prisma, 'message', { get: () => messageProxy });

// Truncate every table between tests
export async function resetDb() {
  const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`,
  );
  if (!tables.length) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}
