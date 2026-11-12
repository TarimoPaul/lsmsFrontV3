// (ge) A dedicated E2E SELLER: a copy of the manager (same roles and branch, new uid / email) with no sales and no recos of
// its own. Tests that approve a reco or need "a day with nothing on it" use this seller, so they never lock the real
// manager's day (an APPROVED reco forbids changing that day's sales - A6) and work on any dump (29/10 or the latest B2 one).
// Throw-away local copy only. Idempotent: the second call returns the same seller.
const { execFileSync } = require('child_process');

const SELLER = 'e2e.muuzaji@local.test';
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();

/** Creates (once) the E2E seller as a copy of `fromEmail`, sets `password`, returns its uid. */
function ensureSeller(fromEmail, password) {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", password], { encoding: 'utf8' }).trim();
  let uid = sql(`select coalesce((select uid from users where email = '${SELLER}'), '')`);
  if (!uid) {
    uid = sql('select gen_random_uuid()::text');
    sql(`insert into users select (jsonb_populate_record(null::users, to_jsonb(u) || jsonb_build_object(
           'uid', '${uid}', 'id', nextval(pg_get_serial_sequence('users', 'id')), 'email', '${SELLER}', 'first_name', 'E2E', 'last_name', 'Muuzaji',
           'phone_number', null, 'created_at', now(), 'last_login_at', null))).* from users u where u.email = '${fromEmail}'`);
    for (const t of ['user_roles', 'user_branches']) {
      const cols = sql(`select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = '${t}' and column_name not in ('id')`);
      const sel = cols.split(',').map((c) => (c === 'user_uid' ? `'${uid}'` : c === 'uid' ? 'gen_random_uuid()::text' : c)).join(',');
      sql(`insert into ${t} (${cols}) select ${sel} from ${t} where user_uid = (select uid from users where email = '${fromEmail}')`);
    }
  }
  sql(`update users set password = '${hash}', status = 'ACTIVE', is_locked = false, is_deleted = false where uid = '${uid}'`);
  return uid;
}

module.exports = { SELLER, ensureSeller };
