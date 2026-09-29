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

Object.defineProperty(prisma, 'skillTag', { get: () => skillTagProxy });
Object.defineProperty(prisma, 'fileAsset', { get: () => (prisma as any).projectFile });
Object.defineProperty(prisma, 'evaluation', { get: () => (prisma as any).peerEvaluation });
Object.defineProperty(prisma, 'user', { get: () => userProxy });

// Truncate every table between tests
export async function resetDb() {
  const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`,
  );
  if (!tables.length) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}
