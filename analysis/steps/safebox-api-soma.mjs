// READ-ONLY probe of the Safe box API on STAGING (tunnel localhost:8081, backend 2.2.69), as root.
// GET requests only (plus the login). The password comes from the ROOT_PASS env var and is never written out.
const API = 'http://localhost:8081';
const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'root@system.com', password: process.env.ROOT_PASS }) });
if (!res.ok) { console.log('LOGIN_IMESHINDWA', res.status, (await res.text()).slice(0, 200)); process.exit(1); }
const login = await res.json();
const H = { Authorization: `Bearer ${login.data.tokenInfo.token}` };
console.log('LOGIN_SAWA');
const get = async (u) => { const r = await fetch(API + u, { headers: H }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 300); } return { status: r.status, body: j?.data ?? j }; };
for (const u of ['/api/v1/safe-box/my-outstanding', '/api/v1/safe-box/outstanding', '/api/v1/safe-box/pending', '/api/v1/safe-box/my-pending', '/api/v1/safe-box/eligible-recipients', '/api/v1/reconciliation/pending-approval']) {
  const r = await get(u);
  console.log(`\n=== ${r.status} GET ${u}`);
  console.log(JSON.stringify(r.body, null, 1).slice(0, 4000));
}
