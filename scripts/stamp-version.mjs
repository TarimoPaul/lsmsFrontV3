// Writes public/version.json before every build. The running app polls it and offers a
// reload when a newer build is deployed (core/update/app-update.service.ts).
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../src/environments/environment.prod.ts', import.meta.url), 'utf8');
// LSMS_APP_VERSION is set by deploy/Dockerfile (the deployed image tag). Without it (a build on the PC): the version
// file of the repo (.frontend-v3-version), so a local build never shows the placeholder of the environment file.
let fileVersion = '';
try { fileVersion = fs.readFileSync(new URL('../.frontend-v3-version', import.meta.url), 'utf8').trim(); } catch { /* no version file */ }
const version = process.env.LSMS_APP_VERSION || fileVersion || (env.match(/appVersion:\s*'([^']+)'/)?.[1] ?? '0.0.0');
const out = { version, buildTime: new Date().toISOString() };
fs.writeFileSync(new URL('../public/version.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`version.json → ${out.version} (${out.buildTime})`);
