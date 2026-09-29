import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './setup/test-app';
import { resetDb, prisma } from './helpers/db';
import { registerUser, bearer } from './helpers/auth';
import { projectWithTeam } from './helpers/factories';
import { CFG } from './helpers/config';
import { R } from './helpers/routes';

const fx = (name: string) => path.join(__dirname, 'fixtures', name);

describe('Files (e2e)', () => {
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

  const upload = (
    projectId: string,
    token: string,
    file: string,
    filename?: string,
  ) =>
    http()
      .post(R.files(projectId))
      .set(bearer(token))
      .attach(CFG.upload.fieldName, fx(file), filename);

  it('FILE-01 a member uploads a PDF', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await upload(project.id, owner.token, 'sample.pdf');
    expect([200, 201]).toContain(res.status);
    expect(
      await prisma.fileAsset.count({ where: { projectId: project.id } }),
    ).toBe(1);
  });

  it('FILE-02 rejects a file above the size limit', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await upload(project.id, owner.token, 'big.bin');
    expect([400, 413]).toContain(res.status);
    expect(
      await prisma.fileAsset.count({ where: { projectId: project.id } }),
    ).toBe(0);
  });

  it('FILE-03 rejects an executable', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await upload(project.id, owner.token, 'evil.exe');
    expect([400, 415]).toContain(res.status);
  });

  it('FILE-04 [EXPECTED-BUG?] rejects an .exe disguised as .png', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await upload(project.id, owner.token, 'fake.png');
    expect([400, 415]).toContain(res.status);
  });

  it('FILE-05 sanitises path traversal in the filename', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await upload(
      project.id,
      owner.token,
      'sample.pdf',
      '../../evil.pdf',
    );
    if ([200, 201].includes(res.status)) {
      const row = await prisma.fileAsset.findFirst({
        where: { projectId: project.id },
      });
      expect(row!.fileUrl).not.toContain('..');
      const root = path.resolve(process.env.UPLOAD_DIR!);
      expect(path.resolve(row!.fileUrl).startsWith(root)).toBe(true);
    } else {
      expect(res.status).toBe(400);
    }
  });

  it('FILE-06 keeps both files when names collide', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    await upload(project.id, owner.token, 'sample.pdf', 'report.pdf');
    await upload(project.id, owner.token, 'sample.pdf', 'report.pdf');
    const rows = await prisma.fileAsset.findMany({
      where: { projectId: project.id },
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.fileUrl)).size).toBe(2);
  });

  it('FILE-07 rejects a request with no file', async () => {
    const { owner, project } = await projectWithTeam(app, 0);
    const res = await http()
      .post(R.files(project.id))
      .set(bearer(owner.token));
    expect(res.status).toBe(400);
  });

  it('FILE-08 a non-member cannot upload', async () => {
    const { project } = await projectWithTeam(app, 0);
    const stranger = await registerUser(app);
    const res = await upload(project.id, stranger.token, 'sample.pdf');
    expect(res.status).toBe(403);
  });

  describe('download (authenticated endpoint)', () => {
    const setup = async () => {
      const team = await projectWithTeam(app, 1);
      await upload(
        team.project.id,
        team.owner.token,
        'sample.pdf',
        'spec.pdf',
      );
      const file = await prisma.fileAsset.findFirstOrThrow({
        where: { projectId: team.project.id },
      });
      return { ...team, file };
    };

    it('FILE-09 a member downloads the exact bytes', async () => {
      const { members, project, file } = await setup();
      const res = await http()
        .get(R.download(project.id, file.id))
        .set(bearer(members[0].token))
        .buffer()
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(
        (res.body as Buffer).equals(fs.readFileSync(fx('sample.pdf'))),
      ).toBe(true);
    });

    it('FILE-10 anonymous download is 401', async () => {
      const { project, file } = await setup();
      const res = await http().get(R.download(project.id, file.id));
      expect(res.status).toBe(401);
    });

    it('FILE-11 a non-member download is 403', async () => {
      const { project, file } = await setup();
      const stranger = await registerUser(app);
      const res = await http()
        .get(R.download(project.id, file.id))
        .set(bearer(stranger.token));
      expect(res.status).toBe(403);
    });

    it("FILE-12 [EXPECTED-BUG?] cannot fetch project A's file through project B's id (IDOR)", async () => {
      const a = await setup();
      const b = await projectWithTeam(app, 0);
      const res = await http()
        .get(R.download(b.project.id, a.file.id))
        .set(bearer(b.owner.token));
      expect([403, 404]).toContain(res.status);
    });

    it('FILE-13 responses never leak the internal fileUrl path', async () => {
      const { owner, project } = await setup();
      const list = await http()
        .get(R.files(project.id))
        .set(bearer(owner.token));
      const row = await prisma.fileAsset.findFirstOrThrow({
        where: { projectId: project.id },
      });
      expect(JSON.stringify(list.body)).not.toContain(row.fileUrl);
    });

    it('FILE-14 the upload directory is not exposed as a static path', async () => {
      const { project } = await setup();
      const row = await prisma.fileAsset.findFirstOrThrow({
        where: { projectId: project.id },
      });
      const res = await http().get(`/uploads/${path.basename(row.fileUrl)}`);
      expect(res.status).toBe(404);
    });
  });
});
