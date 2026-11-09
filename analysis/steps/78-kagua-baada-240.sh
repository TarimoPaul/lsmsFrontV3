#!/usr/bin/env bash
# HATUA 78 (mmiliki 09/11 dl) - PROD, KUSOMA TU, asubuhi ya 10/11 baada ya deploy ya 2.4.0 + 3.2.0 (09/11 14:03).
# 1 gl_posting_failure tangu deploy  2 LOANINT ya 10/11  3 "Muhtasari wa Mauzo" (nani, faida au la)
# 4 login_audit saa 24 za kwanza     5 ERROR kwenye log ya backend tangu deploy
set -u
cd /home/chief/lsms-deployment || { echo "HAIPO lsms-deployment"; exit 1; }
DEPZ='2026-11-09 13:55+03'   # timestamptz (login_audit.at)
DEP='2026-11-09 13:55'   # timestamp ya JVM (EAT): created_at; deploy ilianza 14:02, backend 2.4.0 14:03 (EAT)
q() { docker compose exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " | " -c "$SQL"' < /dev/null; }
echo "=== 0 HALI"
docker compose ps --format '{{.Service}} {{.Image}} {{.Status}}' < /dev/null
echo "flyway_max $(q "select max(version::int) from flyway_schema_history where success and version ~ '^[0-9]+\$'")"
echo "=== 1 GL_POSTING_FAILURE tangu $DEP (zote / hazijatatuliwa)"
q "select count(*), count(*) filter (where resolved_at is null) from gl_posting_failure where created_at >= '$DEP'"
q "select created_at::timestamp(0), source_type, event_type, entry_date, attempts, coalesce(resolution,'-'), left(error,140) from gl_posting_failure where created_at >= '$DEP' order by id limit 20"
echo "=== 2 LOANINT 10/11 (riba ya mkopo ya siku)"
q "select e.reference_uid, e.entry_date, e.status, e.total_debit, (select string_agg(l.account_code||':'||(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0))::numeric(19,0), ',' order by l.account_code) from journal_entry_line l where l.journal_entry_uid=e.uid) from journal_entry e where e.reference_uid like 'LOANINT:%:2026-11-10' order by e.id"
echo "LOANINT 10/11 idadi: $(q "select count(*) from journal_entry where reference_uid like 'LOANINT:%:2026-11-10'") | 09/11: $(q "select count(*) from journal_entry where reference_uid like 'LOANINT:%:2026-11-09'") (09/11 na 10/11 zinapaswa kuwa sawa: mkopo mmoja = journal moja kwa siku)"
q "select count(*), string_agg(distinct left(error,120), ' ; ') from gl_posting_failure where reference_uid like 'LOANINT:%' and created_at >= '$DEP'"
echo "=== 3 MUHTASARI WA MAUZO (DAILY_SALES_SUMMARY) tangu $DEP"
q "select n.created_at::timestamp(0), n.summary_date, coalesce(u.first_name||' '||u.last_name, u.email, n.recipient_user_uid) as mpokeaji, coalesce((select string_agg(r.name, ',') from user_roles ur join roles r on r.uid=ur.role_uid where ur.user_uid=u.uid),'?') as roles, case when n.total_profit is null then 'MAUZO TU' else 'INA FAIDA' end, n.total_count, n.total_amount, n.is_read from notifications n left join users u on u.uid=n.recipient_user_uid where n.type='DAILY_SALES_SUMMARY' and n.created_at >= '$DEP' order by n.id" 2>&1
echo "=== 4 LOGIN_AUDIT saa 24 za kwanza"
q "select event, result, count(*) from login_audit where at >= '$DEPZ' group by 1,2 order by 3 desc"
q "select coalesce(email_attempted,'-'), result, coalesce(failure_reason,'-'), count(*), max(at)::timestamp(0) from login_audit where at >= '$DEPZ' and result <> 'SUCCESS' group by 1,2,3 order by 4 desc limit 15"
q "select network_flag, coalesce(country,'-'), count(*), count(*) filter (where new_device) as kifaa_kipya, string_agg(distinct coalesce(alert,''), ',') from login_audit where at >= '$DEPZ' group by 1,2 order by 3 desc limit 15"
echo "=== 5 ERROR kwenye log ya backend tangu deploy"
L=$(docker compose logs --no-log-prefix --since '2026-11-09T11:03:00Z' backend < /dev/null 2>&1)
echo "mistari $(wc -l <<<"$L") | ERROR $(grep -c ' ERROR ' <<<"$L") | WARN $(grep -c ' WARN ' <<<"$L") | Exception $(grep -c 'Exception' <<<"$L")"
grep ' ERROR ' <<<"$L" | sed -E 's/^[0-9T:.+-]+ +//; s/[0-9a-f]{8}-[0-9a-f-]{27}/<uid>/g; s/[0-9]+/N/g' | cut -c1-200 | sort | uniq -c | sort -rn | head -15
echo "=== 6 SCHEDULER za usiku (00:05 / 02:00)"
grep -E 'LoanInterest|DailySales|Muhtasari|backup|Scheduler' <<<"$L" | grep -E ' (INFO|WARN|ERROR) ' | cut -c1-200 | tail -12
ls -la /home/chief/backups/daily/ | tail -2
echo "---78_SERVER_MWISHO---"
