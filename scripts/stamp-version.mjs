// Writes public/version.json before every build. The running app polls it and offers a
// reload when a newer build is deployed (core/update/app-update.service.ts).
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../src/environments/environment.prod.ts', import.meta.url), 'utf8');
// LSMS_APP_VERSION is set by deploy/Dockerfile (the deployed image tag).
const version = process.env.LSMS_APP_VERSION || (env.match(/appVersion:\s*'([^']+)'/)?.[1] ?? '0.0.0');
const out = { version, buildTime: new Date().toISOString() };
fs.writeFileSync(new URL('../public/version.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`version.json → ${out.version} (${out.buildTime})`);
