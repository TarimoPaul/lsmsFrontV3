-- HATUA 52b (mmiliki 21/10) - KUSOMA TU, kwenye nakala ya PC lsms_audit_<tarehe>_0200 (si DB ya prod).
-- Inahesabu rekodi zote zinazorejelea admin@admin.com (id, uid au email):
--   1) safu zenye FK kwenda users (kwa id au uid);
--   2) safu za maandishi / uuid / json zenye uid au email KAMILI;
--   3) safu za namba zenye jina la mtumiaji (user, *_by, cashier, manager, approver, ...) = id (huenda zikawa si marejeo -
--      zinahesabiwa ili uamuzi uelekee upande salama, TOMBSTONE);
--   4) maandishi YENYE uid au email ndani yake (mf. maelezo ya audit) - yanaonyeshwa kando na kuhesabiwa pia.
--   5) (22/10) JINA 'System Root' kamili - taarifa tu: admin na root@system.com wana jina hilohilo, kwa hiyo haliwezi
--      kuonyesha ni nani; halihesabiwi kwenye uamuzi.
-- (22/10) Kila safu ya FK kwenda users inaonyeshwa hata ikiwa 0 (FK|jedwali.safu|idadi), na mwisho JEDWALI|jedwali|idadi
--   kwa kila jedwali lenye marejeo. Inatumika pia na 54 (prod, READ ONLY) - haina jina la DB ndani yake.
-- Mwisho: UAMUZI_DELETE (marejeo 0) au UAMUZI_TOMBSTONE (> 0); ADMIN_HAYUPO ikiwa akaunti haipo kwenye nakala hii.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 'ADMIN_SAFU id=' || id || ' status=' || status || ' is_root=' || is_root || ' is_deleted=' || is_deleted
FROM public.users WHERE email = 'admin@admin.com';
DO $$
DECLARE
  a_email text := 'admin@admin.com';
  a_id bigint;
  a_uid text;
  r record;
  n bigint;
  jumla bigint := 0;
  ndani bigint := 0;
  fkcols text[] := '{}';
  kwa_jedwali jsonb := '{}';
  jina bigint;
  k text;
  v jsonb;
BEGIN
  SELECT id, uid::text INTO a_id, a_uid FROM public.users WHERE email = a_email;
  IF NOT FOUND THEN RAISE NOTICE 'ADMIN_HAYUPO'; RETURN; END IF;
  a_uid := coalesce(nullif(a_uid, ''), '__hakuna_uid__');
  RAISE NOTICE 'ADMIN id % uid %', a_id, a_uid;

  FOR r IN
    SELECT cl.relname AS t, a.attname AS c
    FROM pg_constraint co
    JOIN pg_class cl ON cl.oid = co.conrelid
    JOIN LATERAL unnest(co.conkey) k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = k.attnum
    WHERE co.contype = 'f' AND co.confrelid = 'public.users'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text IN ($1, $2)', r.t, r.c) INTO n USING a_id::text, a_uid;
    RAISE NOTICE 'FK|%.%|%', r.t, r.c, n;
    IF n > 0 THEN
      RAISE NOTICE 'MAREJEO FK %.% = %', r.t, r.c, n; jumla := jumla + n;
      kwa_jedwali := jsonb_set(kwa_jedwali, ARRAY[r.t], to_jsonb(coalesce((kwa_jedwali->>r.t)::bigint, 0) + n));
    END IF;
    fkcols := array_append(fkcols, r.t || '.' || r.c);
  END LOOP;

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
        RAISE NOTICE 'MAREJEO NAMBA %.% = % (jina la safu ni la mtumiaji; huenda si marejeo)', r.t, r.col, n; jumla := jumla + n;
        kwa_jedwali := jsonb_set(kwa_jedwali, ARRAY[r.t], to_jsonb(coalesce((kwa_jedwali->>r.t)::bigint, 0) + n));
      END IF;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text IN ($1, $2)', r.t, r.col) INTO n USING a_uid, a_email;
      IF n > 0 THEN
        RAISE NOTICE 'MAREJEO KAMILI %.% = %', r.t, r.col, n; jumla := jumla + n;
        kwa_jedwali := jsonb_set(kwa_jedwali, ARRAY[r.t], to_jsonb(coalesce((kwa_jedwali->>r.t)::bigint, 0) + n));
      END IF;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text NOT IN ($1, $2) AND (strpos(%I::text, $1) > 0 OR strpos(lower(%I::text), $2) > 0)',
                     r.t, r.col, r.col, r.col) INTO n USING a_uid, a_email;
      IF n > 0 THEN
        RAISE NOTICE 'MAREJEO NDANI-YA-MAANDISHI %.% = %', r.t, r.col, n; ndani := ndani + n;
        kwa_jedwali := jsonb_set(kwa_jedwali, ARRAY[r.t], to_jsonb(coalesce((kwa_jedwali->>r.t)::bigint, 0) + n));
      END IF;
      IF r.dt NOT IN ('json', 'jsonb') THEN
        EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text = $1', r.t, r.col) INTO jina USING 'System Root';
        IF jina > 0 THEN RAISE NOTICE 'JINA %.% = % (System Root - admin AU root@system.com; taarifa tu)', r.t, r.col, jina; END IF;
      END IF;
    END IF;
  END LOOP;

  FOR k, v IN SELECT * FROM jsonb_each(kwa_jedwali) ORDER BY 1 LOOP
    RAISE NOTICE 'JEDWALI|%|%', k, v;
  END LOOP;

  RAISE NOTICE 'MAREJEO_JUMLA % NDANI_YA_MAANDISHI %', jumla, ndani;
  IF jumla + ndani = 0 THEN RAISE NOTICE 'UAMUZI_DELETE'; ELSE RAISE NOTICE 'UAMUZI_TOMBSTONE'; END IF;
END $$;
ROLLBACK;
