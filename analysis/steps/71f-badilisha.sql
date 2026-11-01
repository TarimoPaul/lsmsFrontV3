-- HATUA 71f (INABADILISHA PROD: role_permissions + roles TU) - A4 ziada (mmiliki 29/10 ax). BAADA ya 71f-soma.sql na SAFISHA.
-- Transaction moja. Inakataa (RAISE -> ROLLBACK) ikiwa akaunti ya print-agent bado ACTIVE, kuna kazi PRINTING, au idadi ya
-- PRINT_JOB_MANAGE si :idadi ya dryRun. Role "printer" inafutwa kama app inavyofuta (Role.delete(): soft delete).
-- Kibali cha permission PRINT_JOB_MANAGE chenyewe kinabaki (seed/permissions.csv kingekirudisha); mapping tu zinaondoka.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('a4.idadi', :'idadi', true);  -- psql haibadilishi :idadi ndani ya DO $$...$$
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE uid = 'd89760f8-56d3-4b52-9131-53eef5778890'
             AND status = 'ACTIVE' AND NOT is_deleted AND NOT is_locked) THEN
    RAISE EXCEPTION 'A4F_KATAA: akaunti ya print-agent bado ni ACTIVE';
  END IF;
  IF EXISTS (SELECT 1 FROM print_jobs WHERE status = 'PRINTING') THEN
    RAISE EXCEPTION 'A4F_KATAA: bado kuna kazi PRINTING - endesha 71e kwanza';
  END IF;
  IF (SELECT count(*) FROM role_permissions rp JOIN permissions p ON p.uid = rp.permission_uid
      WHERE p.name = 'PRINT_JOB_MANAGE') <> current_setting('a4.idadi')::int THEN
    RAISE EXCEPTION 'A4F_KATAA: idadi ya PRINT_JOB_MANAGE si % ya dryRun', current_setting('a4.idadi');
  END IF;
END $$;
DELETE FROM role_permissions
 WHERE permission_uid IN (SELECT uid FROM permissions WHERE name = 'PRINT_JOB_MANAGE');
UPDATE roles SET is_deleted = true, deleted_at = now(), status = 'INACTIVE', updated_at = now()
 WHERE lower(name) = 'printer' AND NOT is_deleted;
SELECT 'MANAGE_BAADA ' || count(*) FROM role_permissions rp JOIN permissions p ON p.uid = rp.permission_uid
 WHERE p.name = 'PRINT_JOB_MANAGE';
SELECT 'ROLE_PRINTER_HAI_BAADA ' || count(*) FROM roles WHERE lower(name) = 'printer' AND NOT is_deleted;
COMMIT;
SELECT 'RP_JUMLA_BAADA ' || count(*) FROM role_permissions;
