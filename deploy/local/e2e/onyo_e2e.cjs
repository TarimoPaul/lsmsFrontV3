// Onyo la manunuzi (owner bo/cf, 02/11) on the PRODUCTION build: V3 Docker-local http://127.0.0.1:4300/v3/ in front of
// the backend Docker-local. Repurchase: a cost per piece past x3 (or below 1/3) of the last purchase shows
// "kreti au chupa?" on the line and a confirm before sending; "Rekebisha" sends nothing, "Bei ni sahihi" sends.
// NO WRITES: /repurchase/bulk is intercepted and aborted; only the throw-away copy's test password is set.
// Run: NODE_PATH=<npx playwright node_modules> node onyo_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const CEO = 'tarimo@gmail.com';
const PW = 'B1-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-c', q], { encoding: 'utf8' }).trim();

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  const purchasesBefore = sql('select count(*) from purchases');

  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  let bulk = 0;
  await page.route('**/api/v1/purchases/repurchase/bulk', (r) => { bulk++; return r.abort(); });

  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(CEO);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.goto(V3 + '/purchases/repurchase');
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  const closeAll = page.getByRole('button', { name: /^(Close all|Funga zote)$/ });
  await page.waitForTimeout(1500);
  if (await closeAll.count()) await closeAll.first().click();

  // first product that can be ordered and has a last cost
  const addBtn = page.locator('.list li.item').getByRole('button', { name: /^(Add|Ongeza)$/ }).first();
  await addBtn.waitFor({ timeout: 30000 });
  await addBtn.click();
  const line = page.locator('.cart .lines li').first();
  await line.waitFor({ timeout: 30000 });
  const name = (await line.locator('.nm strong').innerText()).trim();
  const price = line.locator('.l3 input').first();
  const original = Number((await price.inputValue()).replace(/[^\d.]/g, ''));
  ok('O0 mstari umeongezwa na bei ya mwisho', original > 0, `${name} ${original}`);
  const jump = line.locator('.warn.jump');
  ok('O1 bei ya kawaida: hakuna onyo', (await jump.count()) === 0);

  const setPrice = async (v) => { await price.fill(String(v)); await price.press('Tab'); await page.waitForTimeout(300); };
  await setPrice(Math.round(original * 10));
  ok('O2 bei x10: onyo "kreti au chupa?" kwenye mstari', (await jump.count()) === 1 && /kreti au chupa|crate or bottle/i.test(await jump.innerText()), await jump.count());

  const send = page.locator('button.send');
  const dlg = page.locator('lsms-confirm-dialog');
  await send.click();
  await dlg.waitFor({ timeout: 10000 }).catch(() => undefined);
  const dlgText = (await dlg.count()) ? await dlg.innerText() : '';
  ok('O3 kutuma: dialogi "Kreti au chupa?" inataja bidhaa na x', /Kreti au chupa|Crate or bottle/.test(dlgText) && dlgText.includes(name) && /×\d/.test(dlgText), JSON.stringify(dlgText.slice(0, 300)));
  await dlg.getByRole('button', { name: /^(Rekebisha|Fix it)$/ }).click();
  await dlg.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  ok('O4 Rekebisha: hakuna kilichotumwa, mstari bado upo', bulk === 0 && (await line.count()) === 1, `bulk ${bulk}`);

  await send.click();
  await dlg.waitFor({ timeout: 10000 });
  await dlg.getByRole('button', { name: /Bei ni sahihi|The price is right/ }).click();
  for (let i = 0; i < 20 && bulk === 0; i++) await page.waitForTimeout(250);
  ok('O5 Bei ni sahihi: agizo linatumwa (haikatai)', bulk === 1, `bulk ${bulk}`);

  await setPrice(original);
  ok('O6 bei imerudishwa: onyo limeondoka', (await jump.count()) === 0);
  await send.click();
  for (let i = 0; i < 20 && bulk === 1; i++) await page.waitForTimeout(250);
  ok('O7 bei ya kawaida: inatumwa bila dialogi', bulk === 2 && (await dlg.count()) === 0, `bulk ${bulk}, dialogi ${await dlg.count()}`);

  ok('O8 DB: hakuna manunuzi mapya (bulk ilizuiwa)', sql('select count(*) from purchases') === purchasesBefore);
  ok('Z hakuna JS error kwenye ukurasa', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); console.log(`JUMLA PASS ${P} FAIL ${F + 1}`); process.exit(2); });
