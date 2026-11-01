-- HATUA 71e (KUSOMA TU, PROD) - A4 print-agent (mmiliki 29/10 aw). Inaendeshwa ndani ya kikao read-only.
-- (a) akaunti ya print-agent (uid kutoka 71b) imezimwa?
select 'PA_HALI|uid ' || u.uid || '|status ' || u.status || '|is_active ' || u.is_active || '|is_deleted ' || u.is_deleted
       || '|is_locked ' || u.is_locked || '|updated_at ' || coalesce(u.updated_at::text, '-')
       || '|last_login_at ' || coalesce(u.last_login_at::text, '-')
from users u where u.uid = 'd89760f8-56d3-4b52-9131-53eef5778890';
select case
         when count(*) = 0 then 'PA_HAIPO'
         when bool_and(u.status <> 'ACTIVE' or u.is_deleted or u.is_locked) then 'PA_IMEZIMWA'
         else 'PA_BADO_ACTIVE'
       end
from users u where u.uid = 'd89760f8-56d3-4b52-9131-53eef5778890';
-- (b) kazi zilizokwama PRINTING (dryRun): nakala kamili ya kila safu (ndiyo rollback: status irudishwe PRINTING kwa uid hizi)
select 'PJ_SAFU|' || pj.uid || '|' || pj.status || '|created ' || pj.created_at || '|branch ' || pj.branch_uid
       || '|receipt ' || coalesce(pj.receipt_number, '-') || '|sale ' || coalesce(pj.sale_uid, '-')
       || '|printer ' || coalesce(pj.printer_name, '-') || '|error ' || coalesce(left(pj.error_message, 80), '-')
from print_jobs pj where pj.status = 'PRINTING' order by pj.created_at, pj.uid;
select 'PJ_PRINTING_IDADI ' || count(*) from print_jobs where status = 'PRINTING';
select 'PJ_PRINTING_KABLA_YA_JULAI ' || count(*) from print_jobs where status = 'PRINTING' and created_at < '2026-07-01';
select 'PJ_DRYRUN|zitabadilishwa ' || count(*) || '|PRINTING -> FAILED|error_message "A4 29/10 (aw): imeachwa - print-agent haitumiki tangu 28/07"'
from print_jobs where status = 'PRINTING' and created_at < '2026-07-01';
-- (c) role "printer": nani mwingine anayo, na ruhusa zake (orodha tu - hakuna kinachobadilishwa)
select 'ROLE_PRINTER|uid ' || r.uid || '|status ' || r.status || '|is_active ' || r.is_active || '|is_deleted ' || r.is_deleted
from roles r where lower(r.name) = 'printer';
select 'ROLE_PRINTER_WATUMIAJI|jumla ' || count(*)
       || '|wasio print-agent ' || count(*) filter (where u.uid <> 'd89760f8-56d3-4b52-9131-53eef5778890')
       || '|wasio print-agent ACTIVE ' || count(*) filter (where u.uid <> 'd89760f8-56d3-4b52-9131-53eef5778890'
                                                         and u.status = 'ACTIVE' and not u.is_deleted)
from user_roles ur join roles r on r.uid = ur.role_uid join users u on u.uid = ur.user_uid
where lower(r.name) = 'printer';
select 'ROLE_PRINTER_RUHUSA|' || coalesce(string_agg(p.name, ',' order by p.name), '-')
from roles r left join role_permissions rp on rp.role_uid = r.uid left join permissions p on p.uid = rp.permission_uid
where lower(r.name) = 'printer';
select 'PRINT_JOB_MANAGE_ROLES|' || coalesce(string_agg(distinct r.name, ',' order by r.name), '-')
from permissions p join role_permissions rp on rp.permission_uid = p.uid join roles r on r.uid = rp.role_uid
where p.name = 'PRINT_JOB_MANAGE';
