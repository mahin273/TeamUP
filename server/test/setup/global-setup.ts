import { execSync } from 'child_process';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

export default async () => {
  process.env.NODE_ENV = 'test';
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
  fs.mkdirSync(process.env.UPLOAD_DIR ?? './tmp/test-uploads', {
    recursive: true,
  });
  // Fresh schema for the whole run
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env },
  });
};
