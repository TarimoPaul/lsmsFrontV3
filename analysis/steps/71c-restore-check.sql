-- HATUA 71c - ukaguzi wa restore test (PG ya KUTUPWA kwenye PC, si DB yoyote iliyopo). KUSOMA TU.
select 'FLYWAY ' || count(*) || ' ' || coalesce((select version from flyway_schema_history where success
                                                  order by installed_rank desc limit 1), '-')
from flyway_schema_history where success;
select 'FLYWAY_ZILIZOSHINDWA ' || count(*) from flyway_schema_history where not success;
select 'MAJEDWALI ' || count(*) from pg_tables where schemaname = 'public';
select 'ROWS users ' || (select count(*) from users) || ' sales ' || (select count(*) from sales)
       || ' journal_entry ' || (select count(*) from journal_entry)
       || ' journal_entry_line ' || (select count(*) from journal_entry_line);
select 'MAUZO_YA_MWISHO ' || coalesce(max(created_at)::date::text, '-') from sales;
select 'TB_TOFAUTI ' || coalesce(sum(coalesce(l.debit_amount, 0) - coalesce(l.credit_amount, 0)), 0)
from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid
where not coalesce(j.is_deleted, false);
