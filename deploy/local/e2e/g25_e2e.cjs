// G2-G5 (+dz) toleo 2 (owner 10/11 dy/dz) on the PRODUCTION build of feature/t2-gharama (http://127.0.0.1:4300/v3/)
// + backend Docker-local of the same branch (V140). Writes on the throw-away local copy only; everything it makes is
// stopped / rejected / cancelled / soft-deleted at the end.
//   G3  UI "Gharama mpya" like an existing budget -> warning with the look-alike, button "Hifadhi hata hivyo", 2nd click saves
//   G4  UI after saving the list shows the saved row; an approved row dated next month shows "Imepangwa", not "iko GL"
//   G2  UI "Bajeti za kila mwezi" -> Simamisha shows this month (28,000; not in the books until the 00:10 job),
//       "Haijalipwa" + reason -> row deleted, no live journal
//   G5  UI annual mode -> PENDING; CEO approves own entry: reason < 10 disabled, with reason -> 1160 +1.2M -100k, 12 months,
//       badge "Imejiidhinisha"; cancel -> every journal net 0
//   dz  API: CEO no reason / junk -> refused; Executive CEO / MANAGER own entry -> refused; Executive CEO reads /self-approved
// Run: NODE_PATH=<npx playwright node_modules> node g25_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const EXEC = 'jess@elikom.co.tz';
const MGR = 'macheda@gmail.com';
const PW = 'G25-Jaribio-Local-2026';
const TAG = 'E2E-G25';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
/** Dr - Cr per account of the live (not deleted) journals of one reference, "code:amount" sorted; zero accounts left out. */
const journal = (ref) => sql(`select coalesce(string_agg(account_code || ':' || round(s), ',' order by account_code), '') from (select l.account_code, sum(l.debit_amount - l.credit_amount) s
    from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid where not coalesce(j.is_deleted,false) and j.reference_uid = '${ref}' group by 1 having round(sum(l.debit_amount - l.credit_amount)) <> 0) x`);
const now = new Date();
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const nextMonth1 = (() => { const d = new Date(now.getFullYear(), now.getMonth() + 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01 00:00:00`; })();
const login = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;

async function cleanup(tok) {
  for (const u of sql(`select uid from annual_prepayment where description like '%${TAG}%' and status = 'APPROVED'`).split('\n').filter(Boolean))
    await api('PATCH', `/api/v1/capital-expenditure/annual-prepaid/${u}/cancel?reason=${encodeURIComponent('E2E G25 usafi wa mwisho')}`, tok);
  sql(`update annual_prepayment set status = 'REJECTED', close_reason = 'E2E G25 usafi' where description like '%${TAG}%' and status = 'PENDING'`);
  for (const u of sql(`select uid from capital_expenditure where description like '%${TAG}%' and is_recurring and recurring_active and not is_deleted`).split('\n').filter(Boolean))
    await api('PATCH', `/api/v1/capital-expenditure/recurring-monthly/${u}/stop`, tok);
  // rows of this test that are still live: reverse their journals by cancelling, then soft-delete
  for (const u of sql(`select uid from capital_expenditure where description like '%${TAG}%' and not is_deleted and not is_recurring and status = 'APPROVED'`).split('\n').filter(Boolean))
    await api('PATCH', `/api/v1/capital-expenditure/${u}/status?newStatus=CANCELLED&reason=${encodeURIComponent('E2E G25 usafi wa mwisho')}`, tok);
  sql(`update capital_expenditure set is_deleted = true, deleted_at = now(), deleted_by = 'E2E-G25' where description like '%${TAG}%' and not is_deleted`);
}

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${EXEC}','${MGR}')`);
  const tok = await login(CEO);
  await cleanup(tok);
  ok('S1 nakala: V140 (1160, annual_prepayment) + kipindi cha mwezi huu kiko wazi',
    sql("select count(*) from gl_account where account_code='1160'") === '1' && sql("select count(*) from information_schema.tables where table_name='annual_prepayment'") === '1'
      && sql(`select count(*) from gl_period where period_year = ${ym.slice(0, 4)} and period_month = ${+ym.slice(5)} and status = 'CLOSED'`) === '0', ym);

  // a running monthly budget to compare with / stop (created through the same API V3 uses)
  const [y, m] = ym.split('-').map(Number);
  const b = await api('POST', '/api/v1/capital-expenditure', tok, { capitalType: 'OPERATIONAL_CAPITAL', expenditureType: 'MONTHLY_EXPENSE', expenditureFrequency: 'MONTHLY', amount: 28000, monthlyAllocationAmount: 28000,
    description: `Azam TV ${TAG}`, recurring: true, recurringType: 'MONTHLY_BUDGET', allocatedYear: y, allocatedMonth: m, recurringEndDate: null, paymentMethod: 'CASH', affectsDailyProfit: true });
  const tplUid = b.j?.data?.uid;
  const childUid = sql(`select c.uid from capital_expenditure c join capital_expenditure t on t.uid = c.parent_capital_expenditure_uid where t.uid = '${tplUid}' and c.allocated_year = ${y} and c.allocated_month = ${m} and not c.is_deleted`);
  ok('S2 bajeti ya majaribio (28,000) + mtoto wa mwezi huu', !!tplUid && !!childUid, JSON.stringify(b.j).slice(0, 200));
  // a budget started mid-month: its month is journaled by the 00:10 postDue job, not at creation
  ok('S3 mtoto wa mwezi huu bado hajaingia GL (job ya 00:10 itamwandika)', journal(childUid) === '', journal(childUid));

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(CEO);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  const closeBanners = async () => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };
  const openExpenses = async () => { await page.goto(V3 + '/capital?tab=expenses'); await page.waitForTimeout(2000); await closeBanners(); };

  // ── G3: duplicate warning ──
  await openExpenses();
  await page.getByRole('button', { name: /^(New expense|Gharama mpya)$/ }).first().click();
  let dlg = page.locator('app-expense-dialog');
  await dlg.waitFor({ timeout: 15000 });
  await dlg.locator('label', { hasText: /Description|Maelezo/ }).locator('input').fill(`Malipo Azam ${TAG}`);
  await dlg.locator('label', { hasText: /^(Amount|Kiasi)/ }).locator('input').first().fill('28000');
  const saveBtn = page.locator('app-expense-dialog button').filter({ hasText: /Save for approval|Hifadhi isubiri idhini|Save anyway|Hifadhi hata hivyo/ }).first();
  const before = sql(`select count(*) from capital_expenditure where description = 'Malipo Azam ${TAG}'`);
  await saveBtn.click();
  await page.waitForTimeout(2000);
  const warnTxt = (await dlg.locator('.dup').count()) ? await dlg.locator('.dup').innerText() : '';
  ok('G3a onyo linaonekana na linataja bajeti iliyopo', /Azam TV E2E-G25/.test(warnTxt), warnTxt.slice(0, 200));
  ok('G3b hakuna kilichohifadhiwa kwa click ya kwanza', sql(`select count(*) from capital_expenditure where description = 'Malipo Azam ${TAG}'`) === before);
  ok('G3c kitufe kimekuwa "Hifadhi hata hivyo"', /Save anyway|Hifadhi hata hivyo/.test(await saveBtn.innerText()), await saveBtn.innerText());
  await saveBtn.click();
  await dlg.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const dupUid = sql(`select uid from capital_expenditure where description = 'Malipo Azam ${TAG}' and not is_deleted`);
  ok('G3d click ya pili inahifadhi (PENDING)', !!dupUid && sql(`select status from capital_expenditure where uid='${dupUid}'`) === 'PENDING');
  ok('G4a baada ya kuhifadhi orodha inatafuta jina lililohifadhiwa', (await page.locator('app-expenses-tab table tbody tr').filter({ hasText: `Malipo Azam ${TAG}` }).count()) > 0);

  // ── G4: "Imepangwa" for an approved row dated next month (shaped on the throw-away copy) ──
  sql(`update capital_expenditure set status='APPROVED', is_approved=true, approved_by='E2E', transaction_date='${nextMonth1}' where uid='${dupUid}'`);
  await openExpenses();
  await page.locator('app-expenses-tab lsms-search-bar input').fill(`Malipo Azam ${TAG}`);
  await page.waitForTimeout(1200);
  const rowTxt = await page.locator('app-expenses-tab table tbody tr').filter({ hasText: `Malipo Azam ${TAG}` }).first().innerText().catch(() => '');
  ok('G4b row ya mwezi ujao = "Imepangwa", si "iko GL"', /Imepangwa|Planned/.test(rowTxt) && !/iko GL|in the books ·/.test(rowTxt.replace(/not in the books yet/, '')), rowTxt.replace(/\s+/g, ' ').slice(0, 200));

  // ── G2: stop asks about this month ──
  await openExpenses();
  await page.getByRole('button', { name: /^(Monthly budgets|Bajeti za kila mwezi)$/ }).click();
  const rb = page.locator('app-recurring-budgets-dialog');
  await rb.waitFor({ timeout: 15000 });
  const bRow = rb.locator('.row').filter({ hasText: `Azam TV ${TAG}` }).first();
  await bRow.getByRole('button', { name: /^(Stop|Simamisha)$/ }).click();
  await page.waitForTimeout(1500);
  const curTxt = (await bRow.locator('.cur').count()) ? await bRow.locator('.cur').innerText() : '';
  ok('G2a Simamisha inaonyesha gharama ya mwezi huu 28,000 + "bado haijaingia vitabuni" (sawa na DB)', /28,000/.test(curTxt) && /not in the books yet|bado haijaingia vitabuni/.test(curTxt), curTxt.replace(/\s+/g, ' '));
  await bRow.locator('.cur input[type="checkbox"]').check();
  await page.waitForTimeout(500);
  const stopIt = bRow.getByRole('button', { name: /^(Stop it|Isimamishe)$/ });
  ok('G2b bila sababu kitufe kimezimwa', await stopIt.isDisabled());
  await bRow.locator('input.why').fill('Haijalipwa - jaribio la E2E G2');
  await stopIt.click();
  await page.waitForTimeout(2500);
  ok('G2c bajeti imesimamishwa', sql(`select recurring_active from capital_expenditure where uid='${tplUid}'`) === 'f');
  ok('G2d gharama ya mwezi huu imefutwa', sql(`select is_deleted from capital_expenditure where uid='${childUid}'`) === 't');
  ok('G2e hakuna journal hai ya mwezi huu (jumla 0)', journal(childUid) === '', journal(childUid));
  await rb.getByRole('contentinfo').getByRole('button', { name: /^(Close|Funga)$/ }).click();

  // ── G5: annual expense paid up front ──
  await openExpenses();
  await page.getByRole('button', { name: /^(New expense|Gharama mpya)$/ }).first().click();
  dlg = page.locator('app-expense-dialog');
  await dlg.waitFor({ timeout: 15000 });
  await dlg.getByRole('radio', { name: /Paid for the year up front|Imelipwa kwa mwaka, mapema/ }).click();
  await dlg.locator('label', { hasText: /Description|Maelezo/ }).locator('input').fill(`Leseni ya biashara ${TAG}`);
  await dlg.locator('label', { hasText: /whole period|kipindi chote/ }).locator('input').fill('1200000');
  await page.waitForTimeout(500);
  const splitTxt = await dlg.locator('p.gl').last().innerText();
  ok('G5a muhtasari: 100,000 kwa mwezi', /100,000/.test(splitTxt), splitTxt);
  await page.locator('app-expense-dialog button').filter({ hasText: /Save for approval|Hifadhi isubiri idhini/ }).first().click();
  await dlg.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  const preUid = sql(`select uid from annual_prepayment where description = 'Leseni ya biashara ${TAG}' and status = 'PENDING'`);
  ok('G5b imehifadhiwa PENDING, hakuna GL bado', !!preUid && journal(preUid) === '');

  await page.getByRole('button', { name: /^(Annual expenses|Gharama za mwaka)$/ }).click();
  const ad = page.locator('app-annual-prepaid-dialog');
  await ad.waitFor({ timeout: 15000 });
  const aRow = ad.locator('.row').filter({ hasText: `Leseni ya biashara ${TAG}` }).first();
  await aRow.getByRole('button', { name: /^(Approve|Idhinisha)$/ }).click();
  const reasonIn = aRow.locator('.inline input');
  await reasonIn.waitFor({ timeout: 5000 }).catch(() => {});
  ok('G5c CEO kuidhinisha aliyoiingiza mwenyewe: inaomba sababu', await reasonIn.count() === 1);
  await reasonIn.fill('haraka');
  await page.waitForTimeout(400);
  const apBtn = aRow.locator('.inline').getByRole('button', { name: /^(Approve|Idhinisha)$/ });
  ok('G5d sababu < 10: kitufe kimezimwa', await apBtn.isDisabled());
  await reasonIn.fill('Mimi pekee ndiye mwenye FINANCE_WRITE (E2E)');
  await apBtn.click();
  await page.waitForTimeout(3000);
  const st = sql(`select status || '|' || self_approved || '|' || coalesce(approval_reason,'') from annual_prepayment where uid='${preUid}'`);
  ok('G5e APPROVED + self_approved + sababu imehifadhiwa', st === 'APPROVED|true|Mimi pekee ndiye mwenye FINANCE_WRITE (E2E)', st);
  ok('G5f journal ya malipo: 1000 -1,200,000 / 1160 +1,200,000', journal(preUid) === '1000:-1200000,1160:1200000', journal(preUid));
  const months = sql(`select count(*) from capital_expenditure where prepayment_uid='${preUid}' and not is_deleted`);
  const curM = sql(`select uid from capital_expenditure where prepayment_uid='${preUid}' and allocated_year=${y} and allocated_month=${m}`);
  ok('G5g miezi 12; mwezi huu: Dr gharama 100,000 / Cr 1160', months === '12' && /1160:-100000/.test(journal(curM)), `${months} ${journal(curM)}`);
  ok('G5h miezi ijayo haijaandikwa bado', sql(`select count(*) from capital_expenditure c where c.prepayment_uid='${preUid}' and exists (select 1 from journal_entry j where j.reference_uid=c.uid)`) === '1');
  const aTxt = await aRow.innerText();
  ok('G5i beji "Imejiidhinisha" + sababu inaonekana', /Imejiidhinisha|Self-approved/.test(aTxt) && /FINANCE_WRITE/.test(aTxt), aTxt.replace(/\s+/g, ' ').slice(0, 250));

  // ── dz API ──
  const execTok = await login(EXEC);
  const sa = await api('GET', '/api/v1/capital-expenditure/annual-prepaid/self-approved', execTok);
  ok('DZ1 Executive CEO anasoma orodha ya zilizojiidhinisha', sa.status === 200 && (sa.j.data || []).some((r) => r.uid === preUid && r.approvalReason && r.createdBy && r.approvedBy && r.paymentMethod), JSON.stringify(sa.j).slice(0, 200));
  const body = (d) => ({ description: d, capitalType: 'LEGAL_EXPENSE', totalAmount: 120000, startYear: y, startMonth: m, months: 12, paymentDate: today, paymentMethod: 'CASH' });
  const e1 = await api('POST', '/api/v1/capital-expenditure/annual-prepaid', execTok, body(`Bima Executive ${TAG}`));
  const e1uid = e1.j?.data?.uid;
  const e1self = await api('PATCH', `/api/v1/capital-expenditure/annual-prepaid/${e1uid}/approve?reason=${encodeURIComponent('Ninaidhinisha yangu mwenyewe sasa')}`, execTok);
  ok('DZ2 Executive CEO kujiidhinisha (hata kwa sababu) -> kataa', !!e1uid && /mwenyewe/.test(e1self.j?.message || '') && sql(`select status from annual_prepayment where uid='${e1uid}'`) === 'PENDING', e1self.j?.message);
  const e1ceo = await api('PATCH', `/api/v1/capital-expenditure/annual-prepaid/${e1uid}/approve`, tok);
  ok('DZ3 CEO kuidhinisha ya Executive CEO (mtu wa pili) -> SAWA, si kujiidhinisha', sql(`select status || '|' || self_approved from annual_prepayment where uid='${e1uid}'`) === 'APPROVED|false', e1ceo.j?.message);
  const c1 = await api('POST', '/api/v1/capital-expenditure/annual-prepaid', tok, body(`Kodi ya mwaka CEO ${TAG}`));
  const c1uid = c1.j?.data?.uid;
  const c1no = await api('PATCH', `/api/v1/capital-expenditure/annual-prepaid/${c1uid}/approve`, tok);
  const c1junk = await api('PATCH', `/api/v1/capital-expenditure/annual-prepaid/${c1uid}/approve?reason=${encodeURIComponent('aaaaaaaaaaaa')}`, tok);
  ok('DZ4 CEO bila sababu / sababu takataka -> kataa', /sababu inahitajika/.test(c1no.j?.message || '') && c1junk.j?.status !== 'Success' && sql(`select status from annual_prepayment where uid='${c1uid}'`) === 'PENDING', `${c1no.j?.message} | ${c1junk.j?.message}`);
  const mgrName = sql(`select first_name || ' ' || last_name from users where email='${MGR}'`);
  const mUid = 'e2e-g25-' + Date.now().toString(36);
  sql(`insert into annual_prepayment (uid, reference_number, description, capital_type, total_amount, start_year, start_month, months, payment_date, payment_method, status, created_by)
       values ('${mUid}', 'PRE-E2E', 'Manager ${TAG}', 'LEGAL_EXPENSE', 60000, ${y}, ${m}, 12, current_date, 'CASH', 'PENDING', '${mgrName}')`);
  const mgrTok = await login(MGR);
  const mSelf = await api('PATCH', `/api/v1/capital-expenditure/annual-prepaid/${mUid}/approve?reason=${encodeURIComponent('Ninaidhinisha yangu mwenyewe sasa')}`, mgrTok);
  ok('DZ5 MANAGER kujiidhinisha -> kataa', /mwenyewe/.test(mSelf.j?.message || '') && sql(`select status from annual_prepayment where uid='${mUid}'`) === 'PENDING', `${mSelf.status} ${mSelf.j?.message}`);

  // ── G5 cancel from the UI ──
  await page.goto(V3 + '/capital?tab=expenses');
  await page.waitForTimeout(1500);
  await closeBanners();
  await page.getByRole('button', { name: /^(Annual expenses|Gharama za mwaka)$/ }).click();
  await ad.waitFor({ timeout: 15000 });
  const aRow2 = ad.locator('.row').filter({ hasText: `Leseni ya biashara ${TAG}` }).first();
  await aRow2.getByRole('button', { name: /^(Cancel|Batilisha)$/ }).click();
  await aRow2.locator('.inline input').fill('Jaribio la E2E limekwisha');
  await aRow2.getByRole('button', { name: /^(Cancel it|Ibatilishe)$/ }).click();
  await page.waitForTimeout(3000);
  const left = sql(`select count(*) from capital_expenditure c where c.prepayment_uid='${preUid}' and not c.is_deleted`);
  ok('G5j kubatilisha: hali CANCELLED, miezi imefutwa, journal zote jumla 0',
    sql(`select status from annual_prepayment where uid='${preUid}'`) === 'CANCELLED' && left === '0' && journal(preUid) === '' && journal(curM) === '', `${left} ${journal(preUid)} ${journal(curM)}`);
  ok('G5k hakuna kosa la JavaScript', errors.length === 0, errors.join(' | ').slice(0, 300));

  await browser.close();
  await cleanup(tok);
  ok('Z1 usafi: hakuna row hai ya E2E-G25 iliyobaki, TB 0',
    sql(`select count(*) from capital_expenditure where description like '%${TAG}%' and not is_deleted`) === '0'
      && sql("select round(sum(l.debit_amount - l.credit_amount)) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where not coalesce(j.is_deleted,false)").replace('-', '') === '0');
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
