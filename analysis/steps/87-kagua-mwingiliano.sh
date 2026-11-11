#!/usr/bin/env bash
# HATUA 87 (mmiliki 11/11 ew) - PROD, KUSOMA TU: gharama za 2026 zenye MWINGILIANO kwenye ripoti ya uendeshaji -
#   "share ya mwaka" (mstari wa mwezi wa gharama ya mwaka mzima, k.m. "KODI YA FRAME (Mwaka mzima ...)") NA mtoto
#   mwingine wa mwezi uleule wa kitu kilekile (k.m. REN-MON Nov 200k, TAX-MON Nov 250k). Orodha tu, hakuna kubadilisha.
# Hakuna kuandika: kila muunganisho una default_transaction_read_only=on.
set -u
cd /home/chief/lsms-deployment || { echo "HAIPO lsms-deployment"; exit 1; }
q() { docker compose exec -T -e "SQL=$1" -e "PGOPTIONS=-c default_transaction_read_only=on" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " | " -v ON_ERROR_STOP=1 -c "$SQL"' < /dev/null; }

# rows of 2026 that reach the operations report (not deleted, not cancelled / rejected)
ROWS="select ce.uid, ce.reference_number ref, ce.expenditure_type::text typ, coalesce(ce.expense_category,'-') cat, ce.description descr,
             ce.amount, ce.status::text st, date_trunc('month', ce.transaction_date)::date mon,
             (ce.description ilike '%mwaka mzima%' or ce.expenditure_type::text = 'ANNUAL_EXPENSE') is_share
      from capital_expenditure ce
      where not coalesce(ce.is_deleted, false) and ce.status::text not in ('CANCELLED','REJECTED')
        and ce.transaction_date >= '2026-01-01' and ce.transaction_date < '2027-01-01'
        and ce.expenditure_type::text in ('MONTHLY_EXPENSE','ANNUAL_EXPENSE')"

echo "   (share = maelezo 'Mwaka mzima' au ANNUAL_EXPENSE; mstari wenye maelezo ya namba tu, k.m. '2400000', uangaliwe kwa macho kwenye C)"
echo "=== A SHARE ZA MWAKA 2026 (mwezi | ref | aina | kundi | maelezo | kiasi | hali)"
q "select r.mon, r.ref, r.typ, r.cat, r.descr, r.amount::numeric(19,2), r.st from ($ROWS) r where r.is_share order by r.mon, r.ref"

echo "=== B MWINGILIANO (share ya mwaka inahesabiwa kila mwezi): mwezi wa mtoto | share (ref, kiasi, maelezo) | mtoto mwingine (ref, kiasi, maelezo) | neno/kundi linalofanana"
q "with r as ($ROWS),
        w as (select r.uid, lower(t) tok from r, regexp_split_to_table(r.descr, '[^A-Za-z]+') t where length(t) >= 3
                and lower(t) not in ('mwaka','mzima','jumla','tzs','kwa','malipo','ya','la','wa','the','and','monthly','mwezi','gharama','kodi'))
   select b.mon, a.ref, a.amount::numeric(19,2), a.descr, b.ref, b.amount::numeric(19,2), b.descr,
          coalesce((select string_agg(distinct wa.tok, ',') from w wa join w wb on wb.tok = wa.tok where wa.uid = a.uid and wb.uid = b.uid),
                   case when a.cat <> '-' and a.cat = b.cat then 'kundi:' || a.cat end)
   from r a join r b on b.uid <> a.uid and not b.is_share  -- a share counts in EVERY month of 2026 on the ops report
   where a.is_share
     and ((a.cat <> '-' and a.cat = b.cat)
          or exists (select 1 from w wa join w wb on wb.tok = wa.tok where wa.uid = a.uid and wb.uid = b.uid))
   order by b.mon, a.ref, b.ref"
echo "   (rejea ew: REN-MON-20261101-...-5D9DD844 na TAX-MON-20261101-...-B4F8EA66 zinatarajiwa hapa, Nov)"

echo "=== C WATOTO WOTE WA MWEZI 2026 WASIO SHARE, KWA MWEZI (mwezi | ref | kundi | maelezo | kiasi) - kwa ukaguzi wa macho"
q "select r.mon, r.ref, r.cat, r.descr, r.amount::numeric(19,2) from ($ROWS) r where not r.is_share order by r.mon, r.ref"
echo "=== MWISHO"
