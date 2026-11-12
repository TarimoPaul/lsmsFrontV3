#!/usr/bin/env bash
# HATUA 91 (mmiliki 12/11 fi/fj) - PROD, KUSOMA TU: ukaguzi wa mwisho kabla ya toleo 2 (MUHTASARI-TOLEO2).
#   1. Jagger: SKU 4 - saizi inasomwa kwenye UJAZO (item_measure.unit_type kupitia product_measures), si kwenye jina (fn);
#      kipengele kimefungwa (fn/fo), sehemu hii ni taarifa tu
#   2. Flyway ya prod (toleo 2 litaongeza hadi 150) na gl_config (D lazima iwe HAIJAWEKWA kabla ya toleo 2)
#   3. akaunti za pesa (fj: ZOTE wazi): hali, salio, ilitumika mwisho, journal za siku 30 - kwa hatua 60 na orodha za chanzo
#   4. mkopo A (04/12): malipo ya mkopo yaliyopo
#   5. (fl) malipo tangu 01/10 ambayo huenda njia yake ilibadilishwa (check ya njia 8): log ya check, njia zilizotumika,
#      siku zenye amana ya Selcom + upungufu, maelezo yanayotaja Selcom/Airtel/PCB - RIPOTI TU
#   bash 91-ukaguzi-toleo2.sh kagua
# Hakuna kinachoandikwa. ASCII tu.
set -uo pipefail
MODE="${1:-}"
H="${L91_HOME:-$HOME}"
DIR="${L91_DIR:-$H/lsms-deployment}"; PROJ="${L91_PROJ:-lsms-deployment}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
[ "$MODE" = kagua ] || { echo "MATUMIZI: $0 kagua"; exit 2; }
LIVE="e.status='POSTED' and not coalesce(e.is_deleted,false)"
echo "=== 91 KAGUA $(date '+%F %T') - KUSOMA TU"
echo "--- 1. Jagger (uid8 | jina | UJAZO (item_measure.unit_type) | pcs/pkg | kategoria | active | stock | bei ya kipande | ilibadilishwa)"
echo "    (fn: saizi iko kwenye sehemu ya ujazo, si kwenye jina)"
q "select left(p.uid,8), p.product_name, coalesce(string_agg(distinct m.unit_type, ','), '-'), coalesce(p.pieces_per_package::text,'-'), coalesce(min(c.category_name),'-'),
          p.is_active, p.current_stock, p.piece_sale_price, p.updated_at::date
   from products p left join product_measures pm on pm.product_uid = p.uid left join item_measure m on m.uid = pm.measure_uid and not coalesce(m.is_deleted,false)
     left join categories c on c.uid = p.category_uid
   where p.product_name ilike '%jag%' and not coalesce(p.is_deleted,false) group by p.uid, p.product_name, p.pieces_per_package, p.is_active, p.current_stock, p.piece_sale_price, p.updated_at
   order by 2, 1" | sed 's/^/  /'
J=$(q "select count(*) from products p where p.product_name ilike '%jag%' and not coalesce(p.is_deleted,false)
   and not exists (select 1 from product_measures pm join item_measure m on m.uid = pm.measure_uid where pm.product_uid = p.uid and not coalesce(m.is_deleted,false) and coalesce(trim(m.unit_type),'') <> '')")
echo "  JAGGER_BILA_UJAZO $J   (0 = kila SKU ina ujazo, k.m. 750ml / 1LT)"
echo "--- 2. Flyway na gl_config"
echo "  FLYWAY $(q "select version from flyway_schema_history where success order by installed_rank desc limit 1")   zilizoshindwa: $(q "select count(*) from flyway_schema_history where not success")"
echo "  CUTOVER_D $(q "select coalesce((select bank_cutover_date::text from gl_config order by id limit 1),'HAIJAWEKWA')")   posting: $(q "select coalesce((select posting_enabled::text from gl_config order by id limit 1),'?')")"
echo "  TB $(q "select coalesce(sum(l.debit_amount-l.credit_amount),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where $LIVE")"
echo "--- 3. akaunti za pesa (code | jina | active | salio | ilitumika mwisho | journal siku 30)"
q "select a.account_code, a.account_name, a.is_active, coalesce(u.bal,0)::numeric(19,2), coalesce(u.last_used::text,'HAIJAWAHI'), coalesce(u.n30,0)
   from gl_account a left join (select l.account_code, sum(l.debit_amount-l.credit_amount) bal, max(e.entry_date) last_used,
        count(distinct e.uid) filter (where e.entry_date >= current_date - 30) n30
      from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where $LIVE group by l.account_code) u on u.account_code=a.account_code
   where a.account_code='1000' or a.account_code like '102_' or a.account_code like '103_' or a.account_code in ('1010','2900','2910','6130')
   order by a.account_code" | sed 's/^/  /'
echo "  (2910 / 6130 zinaonekana tu baada ya toleo 2 - V149/V150)"
echo "--- 4. mikopo: malipo yaliyoandikwa (mkopo | tarehe | kiasi)"
q "select coalesce(e.reference_number,''), e.entry_date, sum(l.debit_amount)::numeric(19,2) from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
   where $LIVE and e.reference_type like 'LOAN%' and e.entry_date >= current_date - 60 group by 1,2 order by 2" | sed 's/^/  /'
echo "--- 5. (fl) malipo yaliyokataliwa tangu 01/10: check ya prod ina njia 8 tu (CASH VODACOM TIGOPESA HALOPESA CRDB NMB NBC CREDIT)"
echo "  5a. makosa ya check kwenye log ya backend (tangu kontena lilipoanza; sale/deni lililokataliwa = halikuhifadhiwa)"
LOGC=$(docker compose -p "$PROJ" logs --no-color --timestamps --no-log-prefix --since 2026-10-01T00:00:00 backend < /dev/null 2>/dev/null)
echo "  KONTENA_LOG_KUANZIA $(head -1 <<<"$LOGC" | cut -c1-19)"
echo "  CHECK_ILIKATAA $(grep -c 'payment_method_check' <<<"$LOGC")"
grep 'payment_method_check' <<<"$LOGC" | cut -c1-19 | cut -c1-16 | sort | uniq -c | head -40 | sed 's/^/    /'
echo "  5b. njia zilizotumika tangu 01/10 (jedwali | njia | idadi | kiasi)"
q "select 'payments', payment_method, count(*), sum(amount_paid)::numeric(19,2) from payments where payment_date >= '2026-10-01' and not coalesce(is_deleted,false) group by 2
   union all select 'credit_payments', payment_method, count(*), sum(amount)::numeric(19,2) from credit_payments where payment_date >= '2026-10-01' and not coalesce(is_deleted,false) group by 2 order by 1, 3 desc" | sed 's/^/    /'
echo "  5c. siku zenye amana ya Selcom (reco au safe box) - upungufu = variance > 0 (expected - accounted)"
echo "      (tarehe | muuzaji | hali | variance | amana Selcom reco | safe box Selcom | taslimu | simu | benki | UPUNGUFU?)"
q "with sel as (select r.uid ruid, sum(e.amount) a from reconciliation_cash_entries e join daily_reconciliation r on r.uid = e.reconciliation_uid
                where e.bank_name ilike '%selcom%' and not coalesce(e.is_deleted,false) group by 1),
        sb as (select source_recon_uid ruid, sum(submitted_amount) a from safe_box_deposits where bank_name ilike '%selcom%' and not coalesce(is_deleted,false) and status <> 'CANCELLED' group by 1)
   select r.reconciliation_date, r.user_name, r.status, r.variance_amount, coalesce(sel.a,0), coalesce(sb.a,0), coalesce(r.auto_cash_sales,0), coalesce(r.auto_mobile_sales,0),
          coalesce(r.bank_deposits_total,0), case when r.variance_amount > 0 then 'UPUNGUFU' else '-' end
   from daily_reconciliation r left join sel on sel.ruid = r.uid left join sb on sb.ruid = r.uid
   where r.reconciliation_date >= '2026-10-01' and not coalesce(r.is_deleted,false) and (sel.a is not null or sb.a is not null)
   order by 1" | sed 's/^/    /'
echo "  5d. maelezo ya sale / reco / pesa ya simu yanayotaja Selcom, Airtel au PCB tangu 01/10 (tarehe | wapi | maandishi)"
q "select sale_date::date, 'sale ' || coalesce(receipt_number,left(uid,8)), left(regexp_replace(regexp_replace(sale_notes, '^.*Profit: [0-9.,-]+ ?', ''), '\s+', ' ', 'g'), 120) from sales
     where sale_date >= '2026-10-01' and sale_notes ~* '(selcom|airtel|pcb)'
   union all select r.reconciliation_date, 'reco', left(regexp_replace(coalesce(r.notes,'') || ' ' || coalesce(r.variance_explanation,''), '\s+', ' ', 'g'), 120) from daily_reconciliation r
     where r.reconciliation_date >= '2026-10-01' and (coalesce(r.notes,'') || coalesce(r.variance_explanation,'')) ~* '(selcom|airtel|pcb)'
   union all select r.reconciliation_date, 'simu ' || m.provider, m.amount::text || ' ' || left(coalesce(m.notes,''), 100) from reconciliation_mobile_entries m join daily_reconciliation r on r.uid = m.reconciliation_uid
     where r.reconciliation_date >= '2026-10-01' and m.provider ~* 'airtel' and not coalesce(m.is_deleted,false)
   order by 1" | sed 's/^/    /'
echo "---91_KAGUA_MWISHO---"
