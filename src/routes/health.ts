import { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';

function getVersion(): string {
  // When started via npm scripts, this is often available.
  if (process.env.npm_package_version) return process.env.npm_package_version;
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    return typeof pkg?.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

const version = getVersion();

export default async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return { ok: true, version, uptime: process.uptime() };
  });
}
