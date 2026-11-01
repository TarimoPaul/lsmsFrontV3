-- HATUA 71-db (KUSOMA TU) - DB zote za PG ya local (5432): ukubwa, miunganisho, na uamuzi wa (ao)/(as.0c).
-- Haigusi DB zisizo za LSMS (2psDante, _2ps-*, DHMS/dhms, PHMS, SDMS, SmartChakula): zinaonyeshwa kama "-" tu.
\pset footer off
select d.datname as db,
       pg_size_pretty(pg_database_size(d.datname)) as ukubwa,
       (select count(*) from pg_stat_activity a where a.datname = d.datname) as miunganisho,
       case
         when d.datname in ('lsms_audit', 'lsms_audit_1004', 'lsms_toleo1_scratch') then 'FUTA (ao)'
         when d.datname in ('LocalLsms', 'LsmsAngular', 'Lsms') then 'pg_dump -> D:\LSMS-ARCHIVE\db, kisha FUTA (as.0c)'
         when d.datname = 'lsms_test_reco' then 'BAKI (dev, as.0c)'
         when d.datname in ('lsms_audit_20261015_0200', 'lsms_returns_scratch') then 'BAKI (ao)'
         else '-'
       end as uamuzi
from pg_database d
where not d.datistemplate
order by (d.datname ilike '%lsms%') desc, d.datname;
select 'DB_ZA_KUFUTA_ZILIZOPO ' || count(*) from pg_database
where datname in ('lsms_audit', 'lsms_audit_1004', 'lsms_toleo1_scratch', 'LocalLsms', 'LsmsAngular', 'Lsms');
select 'MIUNGANISHO_KWENYE_ZA_KUFUTA ' || count(*) from pg_stat_activity
where datname in ('lsms_audit', 'lsms_audit_1004', 'lsms_toleo1_scratch', 'LocalLsms', 'LsmsAngular', 'Lsms');
select 'DB_ZA_KUBAKI_ZILIZOPO ' || count(*) from pg_database
where datname in ('lsms_test_reco', 'lsms_audit_20261015_0200', 'lsms_returns_scratch');
