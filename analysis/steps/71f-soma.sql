-- HATUA 71f (KUSOMA TU, PROD) - A4 ziada (mmiliki 29/10 ax): PRINT_JOB_MANAGE iondolewe kwenye role zote, role "printer" ifutwe.
-- (1) NAKALA KAMILI ya role_permissions kabla ya badiliko (rollback = INSERT tena safu za PRINT_JOB_MANAGE hapa chini)
select 'RP_NAKALA|' || r.name || '|' || p.name || '|role ' || rp.role_uid || '|perm ' || rp.permission_uid
from role_permissions rp join roles r on r.uid = rp.role_uid join permissions p on p.uid = rp.permission_uid
order by r.name, p.name;
select 'RP_JUMLA ' || count(*) from role_permissions;
-- (2) dryRun: kitakachobadilika
select 'MANAGE_KUONDOLEWA|' || r.name || '|role ' || rp.role_uid
from role_permissions rp join roles r on r.uid = rp.role_uid join permissions p on p.uid = rp.permission_uid
where p.name = 'PRINT_JOB_MANAGE' order by r.name;
select 'MANAGE_IDADI ' || count(*)
from role_permissions rp join permissions p on p.uid = rp.permission_uid where p.name = 'PRINT_JOB_MANAGE';
select 'ROLE_PRINTER_KUFUTWA|uid ' || uid || '|status ' || status || '|is_deleted ' || is_deleted
from roles where lower(name) = 'printer';
select 'ROLE_PRINTER_IDADI ' || count(*) from roles where lower(name) = 'printer' and not is_deleted;
-- (3) endpoints: GET /api/v1/print-jobs/{uid} = CREATE au MANAGE. Role yenye MANAGE bila CREATE ingepoteza GET hiyo.
select 'MANAGE_BILA_CREATE|' || coalesce(string_agg(r.name, ',' order by r.name), '-')
from roles r
where exists (select 1 from role_permissions rp join permissions p on p.uid = rp.permission_uid
              where rp.role_uid = r.uid and p.name = 'PRINT_JOB_MANAGE')
  and not exists (select 1 from role_permissions rp join permissions p on p.uid = rp.permission_uid
                  where rp.role_uid = r.uid and p.name = 'PRINT_JOB_CREATE')
  and lower(r.name) <> 'printer';
select 'CREATE_ROLES|' || coalesce(string_agg(r.name, ',' order by r.name), '-')
from roles r join role_permissions rp on rp.role_uid = r.uid join permissions p on p.uid = rp.permission_uid
where p.name = 'PRINT_JOB_CREATE' and not r.is_deleted;
-- (4) masharti ya 71e: akaunti ya print-agent imezimwa na hakuna kazi PRINTING
select case when exists (select 1 from users where uid = 'd89760f8-56d3-4b52-9131-53eef5778890'
                         and status = 'ACTIVE' and not is_deleted and not is_locked)
            then 'PA_BADO_ACTIVE' else 'PA_IMEZIMWA' end;
select 'PJ_PRINTING_IDADI ' || count(*) from print_jobs where status = 'PRINTING';
