// (ge) A dedicated E2E SELLER: a copy of the manager (same roles and branch, new uid / email) with no sales and no recos of
// its own. Tests that approve a reco or need "a day with nothing on it" use this seller, so they never lock the real
// manager's day (an APPROVED reco forbids changing that day's sales - A6) and work on any dump (29/10 or the latest B2 one).
// (gq) One rule for every test: its data is made from the state of the DB, nothing is pinned to one dump -
//   ensureSeller(from, pw, tag)   a seller per test / scenario (e2e.muuzaji.<tag>@local.test): its days never clash with another test
//   lastCountDay()                the day of the latest stock count, READ from the copy (CountingGuardService refuses a sale dated before it)
//   freeDays(uid, n, {notBefore}) the seller's free days (no sale, no reco) from that day up to today, past days first
//   at(day)                       a sale time on that day that is never in the future
//   ensureLimitedUser(from, pw, perms)  a temporary role with exactly these permissions + its only user (permission checks)
//   loginOrFail(api, email, pw)   an empty token is an error, never a fallback to another user's token
// Throw-away local copy only. Idempotent: the second call returns the same seller.
const { execFileSync } = require('child_process');

const SELLER = 'e2e.muuzaji@local.test';
const LIMITED = 'e2e.kikomo@local.test';
const LIMITED_ROLE = 'E2E_KIKOMO';
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const bcrypt = (password) => execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", password], { encoding: 'utf8' }).trim();
const sellerEmail = (tag) => (tag ? `e2e.muuzaji.${tag}@local.test` : SELLER);

/** Copies the user row of `fromEmail` under a new uid / email (once); `links` = the link tables copied with it. */
function copyUser(email, fromEmail, first, last, links) {
  let uid = sql(`select coalesce((select uid from users where email = '${email}'), '')`);
  if (uid) return uid;
  if (sql(`select count(*) from users where email = '${fromEmail}'`) !== '1') throw new Error(`mtumiaji wa kunakili hayupo: ${fromEmail}`);
  uid = sql('select gen_random_uuid()::text');
  sql(`insert into users select (jsonb_populate_record(null::users, to_jsonb(u) || jsonb_build_object(
         'uid', '${uid}', 'id', nextval(pg_get_serial_sequence('users', 'id')), 'email', '${email}', 'first_name', '${first}', 'last_name', '${last}',
         'phone_number', null, 'created_at', now(), 'last_login_at', null))).* from users u where u.email = '${fromEmail}'`);
  for (const t of links) {
    const cols = sql(`select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = '${t}' and column_name not in ('id')`);
    const sel = cols.split(',').map((c) => (c === 'user_uid' ? `'${uid}'` : c === 'uid' ? 'gen_random_uuid()::text' : c)).join(',');
    sql(`insert into ${t} (${cols}) select ${sel} from ${t} where user_uid = (select uid from users where email = '${fromEmail}') on conflict do nothing`);
  }
  return uid;
}

/** Creates (once) an E2E seller as a copy of `fromEmail`, sets `password`, returns its uid. `tag` = a seller of its own for one test / scenario. */
function ensureSeller(fromEmail, password, tag = '') {
  const uid = copyUser(sellerEmail(tag), fromEmail, 'E2E', 'Muuzaji', ['user_roles', 'user_branches']);
  sql(`update users set password = '${bcrypt(password)}', status = 'ACTIVE', is_locked = false, is_deleted = false where uid = '${uid}'`);
  return uid;
}

/** The day of the latest stock count on this copy (null when there is none): a sale dated before it is refused. */
function lastCountDay() {
  return sql("select coalesce((select max(started_at)::date::text from counting_session where status <> 'FORCE_CLOSED'), '')") || null;
}

/** Up to `n` days with no sale and no reco of this seller, from the latest stock count (and `notBefore`) up to today; past days first, newest first. */
function freeDays(uid, n, { notBefore = null } = {}) {
  const lc = lastCountDay();
  const from = `greatest(current_date - 45${lc ? `, date '${lc}'` : ''}${notBefore ? `, date '${notBefore}'` : ''})`;
  const out = sql(`select coalesce(string_agg(d::text, ',' order by leo, d desc), '') from (
      select g::date d, (g::date = current_date)::int leo from generate_series(${from}::timestamp, current_date::timestamp, interval '1 day') g
      where not exists (select 1 from sales s where s.user_uid = '${uid}' and s.sale_date::date = g::date)
        and not exists (select 1 from daily_reconciliation r where r.user_uid = '${uid}' and r.reconciliation_date = g::date)
      order by 2, 1 desc limit ${n}) x`);
  return out ? out.split(',') : [];
}

const today = () => sql('select current_date::text');
/** A sale time on `day`: 11:00 on a past day, a minute ago today (never in the future). */
function at(day) {
  if (day !== today()) return `${day}T11:00:00`;
  const d = new Date(Date.now() - 60000); const p = (x) => String(x).padStart(2, '0');
  return `${day}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * A temporary role (E2E_KIKOMO) holding EXACTLY `permissions` and one user whose only role it is. Returns { email, uid, role }.
 * The real roles of the copy are not touched (the printer role is deleted on prod since 11/11 - a test must not lean on it).
 */
function ensureLimitedUser(fromEmail, password, permissions) {
  let role = sql(`select coalesce((select uid from roles where name = '${LIMITED_ROLE}'), '')`);
  if (!role) {
    role = sql('select gen_random_uuid()::text');
    sql(`insert into roles select (jsonb_populate_record(null::roles, to_jsonb(r) || jsonb_build_object('uid', '${role}', 'id', nextval(pg_get_serial_sequence('roles', 'id')),
           'name', '${LIMITED_ROLE}', 'description', 'E2E: role ya muda ya majaribio ya ruhusa', 'created_at', now(), 'is_deleted', false, 'is_active', true,
           'deleted_at', null, 'deleted_by', null))).* from roles r where not r.is_deleted order by r.id limit 1`);
  }
  sql(`update roles set is_deleted = false, is_active = true where uid = '${role}'`);
  sql(`delete from role_permissions where role_uid = '${role}'`);
  for (const p of permissions) {
    if (sql(`select count(*) from permissions where name = '${p}'`) !== '1') throw new Error(`ruhusa haipo: ${p}`);
    sql(`insert into role_permissions (role_uid, permission_uid) select '${role}', uid from permissions where name = '${p}'`);
  }
  const uid = copyUser(LIMITED, fromEmail, 'E2E', 'Kikomo', ['user_branches']);
  sql(`delete from user_roles where user_uid = '${uid}'`);
  sql(`insert into user_roles (user_uid, role_uid) values ('${uid}', '${role}')`);
  sql(`update users set password = '${bcrypt(password)}', status = 'ACTIVE', is_locked = false, is_deleted = false where uid = '${uid}'`);
  return { email: LIMITED, uid, role };
}

/** The permissions this user really holds through live roles, sorted (for an assertion that the limited user is limited). */
function permissionsOf(email) {
  return sql(`select coalesce(string_agg(distinct p.name, ',' order by p.name), '') from users u join user_roles ur on ur.user_uid = u.uid join roles r on r.uid = ur.role_uid and not r.is_deleted
      join role_permissions rp on rp.role_uid = r.uid join permissions p on p.uid = rp.permission_uid where u.email = '${email}'`);
}

/** Logs in through the API; no token = an Error naming the user (a test must never go on with another user's token). */
async function loginOrFail(API, email, password) {
  const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz' }, body: JSON.stringify({ email, password }) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  const token = j?.data?.tokenInfo?.token;
  if (!token) throw new Error(`LOGIN IMESHINDWA ${email}: HTTP ${r.status} ${String(j?.message || '').slice(0, 160)}`);
  return token;
}

module.exports = { SELLER, sellerEmail, ensureSeller, lastCountDay, freeDays, today, at, ensureLimitedUser, permissionsOf, loginOrFail };
