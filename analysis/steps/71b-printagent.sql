-- HATUA 71b (KUSOMA TU, PROD) - akaunti ya print-agent (mmiliki 29/10 as.0e). Email haiandikwi hapa: inatafutwa kwa
-- sha256(lower(trim(email))) ya device-email za application.yml mbili za lsms-print-agent (zip ya 71).
--   a7c8e812... = application.yml ya juu (email halisi);  ecbb8f0d... = src/main/resources (kishika-nafasi, bila @)
select 'PA_IDADI ' || count(*)
from users u
where encode(sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex') in
      ('a7c8e8126b673e238d14d80a63c190bbd745171ba8dd4458be29d1d9d46b9cb8',
       'ecbb8f0dbb7bf4f97724ea3ff5eb8c162bf36e803ee8bab4040680df2fd0a3ae');
select 'PA_USER|' || case when encode(sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex')
                              = 'a7c8e8126b673e238d14d80a63c190bbd745171ba8dd4458be29d1d9d46b9cb8' then 'yml-juu' else 'yml-src' end
       || '|uid ' || u.uid || '|status ' || u.status || '|is_active ' || u.is_active || '|is_deleted ' || u.is_deleted
       || '|is_locked ' || u.is_locked || '|is_root ' || u.is_root || '|is_admin ' || u.is_admin
       || '|created_at ' || u.created_at::date || '|last_login_at ' || coalesce(u.last_login_at::text, '-')
       || '|roles ' || coalesce((select string_agg(r.name, ',' order by r.name)
                                 from user_roles ur join roles r on r.uid = ur.role_uid
                                 where ur.user_uid = u.uid), '-')
       || '|branches ' || (select count(*) from user_branches ub where ub.user_uid = u.uid)
from users u
where encode(sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex') in
      ('a7c8e8126b673e238d14d80a63c190bbd745171ba8dd4458be29d1d9d46b9cb8',
       'ecbb8f0dbb7bf4f97724ea3ff5eb8c162bf36e803ee8bab4040680df2fd0a3ae')
order by u.uid;
-- print_jobs: agent iliacha lini, na je V3/backend bado inaunda kazi ambazo hakuna anayechukua?
select 'PJ_STATUS|' || status || '|' || count(*) || '|mwisho ' || max(created_at)::date
from print_jobs group by status order by status;
select 'PJ_MWISHO_COMPLETED ' || coalesce(max(completed_at)::text, '-') from print_jobs;
select 'PJ_SIKU7_ZILIZOUNDWA ' || count(*) from print_jobs where created_at > now() - interval '7 days';
