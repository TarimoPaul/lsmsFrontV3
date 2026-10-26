-- HATUA 55 (mmiliki 26/10) - KUFUTA KABISA admin@admin.com (users id=9, uid 5e0e9b5c-863c-4719-a196-947f98f0819c) kwenye DB ya prod.
-- Inaendeshwa na 55-admin-futa.sh kwa psql: -v hali=kagua (BEGIN READ ONLY ... ROLLBACK - kinga zote, hakuna kuandika)
--   au -v hali=futa (BEGIN ... COMMIT). Hali zote mbili zinaendesha KINGA ZILEZILE ndani ya transaction moja; kosa lolote = RAISE
--   EXCEPTION = ROLLBACK (hakuna kilichobadilika).
-- Kinga:
--   1) safu ya admin ipo kwa id=9 NA email NA uid zote tatu; users ni 9; root@system.com ipo, ACTIVE, is_root, si deleted;
--      root ni 2 hasa (admin na root@system.com) - baada ya kufuta lazima ibaki 1.
--   2) FK yoyote kwenda users yenye ON DELETE CASCADE / SET NULL / SET DEFAULT ambayo si user_branches.user_uid -> IMEKATALIWA
--      (FK hizo zingebadilisha majedwali mengine kimya kimya).
--   3) marejeo (hesabu ileile ya 52b/54: FK, maandishi/uuid/json KAMILI, namba kwenye safu yenye jina la mtumiaji = 9,
--      maandishi YENYE uid/email ndani yake). Yanayoruhusiwa kwa jina kamili TU:
--        user_branches.user_uid                  - inafutwa ndani ya transaction hii, kabla ya users (lazima safu 1)
--        backup_20260930_journal_entry.posted_by - haiguswi (jedwali la backup, bila FK)
--        order_suggestion_line.user_packs        - namba ya pakiti, si mtumiaji
--      Rejeo lingine lolote > 0 -> IMEKATALIWA.
--   4) futa: DELETE user_branches (safu 1) kisha DELETE users WHERE id=9 AND email AND uid (safu 1); baada: admin 0, users 8,
--      is_root 1 (root@system.com). Vinginevyo ROLLBACK.
-- Ishara: KINGA_55_SAWA (kagua/futa), ADMIN_IMEFUTWA_55 (futa, kabla ya COMMIT), IMEKATALIWA_55 <sababu> (kosa).
\set ON_ERROR_STOP on
\if :{?hali}
\else
\echo 'IMEKATALIWA_55 hali haijatolewa (-v hali=kagua au -v hali=futa)'
\quit
\endif
SELECT :'hali' IN ('kagua', 'futa') AS hali_sawa \gset
\if :hali_sawa
\echo 'HALI_55|' :hali
\else
\echo 'IMEKATALIWA_55 hali si kagua wala futa'
\quit
\endif
SELECT (:'hali' = 'futa') AS ni_futa \gset
\if :ni_futa
BEGIN;
\else
BEGIN READ ONLY;
\endif
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT set_config('lsms.hali_55', :'hali', true) AS hali_iliyowekwa \gset
DO $$
DECLARE
  a_id constant bigint := 9;
  a_uid constant text := '5e0e9b5c-863c-4719-a196-947f98f0819c';
  a_email constant text := 'admin@admin.com';
  ruhusa constant text[] := ARRAY['user_branches.user_uid', 'backup_20260930_journal_entry.posted_by', 'order_suggestion_line.user_packs'];
  futa constant boolean := current_setting('lsms.hali_55') = 'futa';
  r record;
  n bigint;
  ub bigint := 0;
  fkcols text[] := '{}';
  mbaya text[] := '{}';
BEGIN
  IF futa THEN
    PERFORM 1 FROM public.users WHERE id = a_id AND email = a_email AND uid::text = a_uid FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.users WHERE id = a_id AND email = a_email AND uid::text = a_uid;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'IMEKATALIWA_55 admin haipo kwa id=9 + email + uid zote tatu'; END IF;
  SELECT count(*) INTO n FROM public.users;
  IF n <> 9 THEN RAISE EXCEPTION 'IMEKATALIWA_55 users ni % (lazima 9)', n; END IF;
  SELECT count(*) INTO n FROM public.users WHERE email = 'root@system.com' AND is_root AND status = 'ACTIVE' AND NOT is_deleted;
  IF n <> 1 THEN RAISE EXCEPTION 'IMEKATALIWA_55 root@system.com si root ACTIVE (safu %)', n; END IF;
  SELECT count(*) INTO n FROM public.users WHERE is_root;
  IF n <> 2 THEN RAISE EXCEPTION 'IMEKATALIWA_55 is_root ni % (lazima 2: admin na root@system.com)', n; END IF;
  RAISE NOTICE 'KABLA users 9 is_root 2 root@system.com ACTIVE';

  -- (2) FK kwenda users na hatua yake ya DELETE (a = NO ACTION, r = RESTRICT, c = CASCADE, n = SET NULL, d = SET DEFAULT)
  FOR r IN
    SELECT cl.relname AS t, a.attname AS c, co.confdeltype::text AS del
    FROM pg_constraint co
    JOIN pg_class cl ON cl.oid = co.conrelid
    JOIN LATERAL unnest(co.conkey) k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = k.attnum
    WHERE co.contype = 'f' AND co.confrelid = 'public.users'::regclass
    ORDER BY 1, 2
  LOOP
    fkcols := array_append(fkcols, r.t || '.' || r.c);
    IF r.del IN ('c', 'n', 'd') AND (r.t || '.' || r.c) <> 'user_branches.user_uid' THEN
      mbaya := array_append(mbaya, format('FK %s.%s ON DELETE %s', r.t, r.c,
                 CASE r.del WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' ELSE 'SET DEFAULT' END));
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text IN ($1, $2)', r.t, r.c) INTO n USING a_id::text, a_uid;
    RAISE NOTICE 'FK|%.%|%|del=%', r.t, r.c, n, r.del;
    IF n > 0 AND NOT (r.t || '.' || r.c) = ANY (ruhusa) THEN mbaya := array_append(mbaya, format('%s.%s = %s', r.t, r.c, n)); END IF;
    IF (r.t || '.' || r.c) = 'user_branches.user_uid' THEN ub := n; END IF;
  END LOOP;

  -- (3) marejeo yasiyo FK (kama 52b)
  FOR r IN
    SELECT c.table_name AS t, c.column_name AS col, c.data_type AS dt
    FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
      AND c.data_type IN ('character varying', 'text', 'character', 'uuid', 'json', 'jsonb', 'bigint', 'integer')
    ORDER BY 1, 2
  LOOP
    CONTINUE WHEN r.t = 'users';
    CONTINUE WHEN (r.t || '.' || r.col) = ANY (fkcols);
    IF r.dt IN ('bigint', 'integer') THEN
      CONTINUE WHEN r.col !~* '(user|_by$|_by_id$|cashier|manager|approver|owner|creator|employee|staff|actor|admin)';
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.t, r.col) INTO n USING a_id;
      IF n > 0 THEN
        RAISE NOTICE 'NAMBA|%.%|%', r.t, r.col, n;
        IF NOT (r.t || '.' || r.col) = ANY (ruhusa) THEN mbaya := array_append(mbaya, format('%s.%s = %s (namba)', r.t, r.col, n)); END IF;
      END IF;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text IN ($1, $2)', r.t, r.col) INTO n USING a_uid, a_email;
      IF n > 0 THEN
        RAISE NOTICE 'KAMILI|%.%|%', r.t, r.col, n;
        IF NOT (r.t || '.' || r.col) = ANY (ruhusa) THEN mbaya := array_append(mbaya, format('%s.%s = %s', r.t, r.col, n)); END IF;
      END IF;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text NOT IN ($1, $2) AND (strpos(%I::text, $1) > 0 OR strpos(lower(%I::text), $2) > 0)',
                     r.t, r.col, r.col, r.col) INTO n USING a_uid, a_email;
      IF n > 0 THEN
        RAISE NOTICE 'NDANI|%.%|%', r.t, r.col, n;
        mbaya := array_append(mbaya, format('%s.%s = %s (ndani ya maandishi)', r.t, r.col, n));
      END IF;
    END IF;
  END LOOP;

  IF cardinality(mbaya) > 0 THEN
    RAISE EXCEPTION 'IMEKATALIWA_55 marejeo/FK yasiyoruhusiwa: %', array_to_string(mbaya, '; ');
  END IF;
  IF ub <> 1 THEN RAISE EXCEPTION 'IMEKATALIWA_55 user_branches ya admin ni % (lazima 1)', ub; END IF;
  RAISE NOTICE 'KINGA_55_SAWA';

  IF futa THEN
    DELETE FROM public.user_branches WHERE user_uid::text = a_uid;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'IMEKATALIWA_55 DELETE user_branches safu % (lazima 1)', n; END IF;
    DELETE FROM public.users WHERE id = a_id AND email = a_email AND uid::text = a_uid;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'IMEKATALIWA_55 DELETE users safu % (lazima 1)', n; END IF;
    SELECT count(*) INTO n FROM public.users WHERE email = a_email OR id = a_id OR uid::text = a_uid;
    IF n <> 0 THEN RAISE EXCEPTION 'IMEKATALIWA_55 admin bado ipo baada ya DELETE'; END IF;
    SELECT count(*) INTO n FROM public.users;
    IF n <> 8 THEN RAISE EXCEPTION 'IMEKATALIWA_55 users baada ni % (lazima 8)', n; END IF;
    SELECT count(*) INTO n FROM public.users WHERE is_root;
    IF n <> 1 THEN RAISE EXCEPTION 'IMEKATALIWA_55 is_root baada ni % (lazima 1)', n; END IF;
    RAISE NOTICE 'ADMIN_IMEFUTWA_55 user_branches 1 users 1; baada users 8 is_root 1';
  END IF;
END $$;
\if :ni_futa
COMMIT;
\echo 'COMMIT_55'
\else
ROLLBACK;
\echo 'KAGUA_55_ROLLBACK'
\endif
