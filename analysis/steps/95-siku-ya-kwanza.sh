#!/usr/bin/env bash
# HATUA 95 (Chief 13/11 hi 4-5) - PROD, KUSOMA TU: ripoti ya siku ya kwanza baada ya 2.5.0 / 3.3.0 (prod tangu 13/11 14:05).
#   bash 95-siku-ya-kwanza.sh [YYYY-MM-DD]     siku D (bila hoja: leo, EAT)
#   1 toleo + swichi kwenye container (marejesho OFF - uamuzi hh; onyo la manunuzi)
#   2 onyo la manunuzi: sheria ileile ya PurchaseCheckController (6e) kwa siku [mwanzo wa onyo .. D]:
#       reco ya siku d ina manunuzi > 0 -> linganisha na yaliyolipwa kutoka DROO siku d-1..d+1 (tofauti >= 1 = ONYO);
#       reco 0 lakini DROO ililipa siku d na reco ya d-1..d+1 ni 0 -> ONYO. Siku D inategemea pia D+1: jioni ya D ni ya muda.
#       + manunuzi / malipo ya wasambazaji ya siku D, na mistari ya manunuzi ya reco ya D
#   3 reco ya D: kila muuzaji (hali, mauzo, droo, tofauti, manunuzi, nani ameidhinisha) + wauzaji wenye mauzo ya D bila reco
#   4 mauzo ya D, sale zilizofutwa D, marejesho (lazima 0: OFF), GL (TB, journal za D)
#   5 log ya backend saa 24: idadi ya ERROR / WARN + ujumbe 10 wa ERROR unaojirudia zaidi
#   6 hatua 74 KAGUA (74-umelipa-sasa.sh kagua, kusoma tu) - je, 74 bado inahitajika baada ya 74b?
#   HAKUNA kinachoandikwa: SELECT tu, docker logs, printenv. ASCII tu.
set -uo pipefail
H="${L95_HOME:-$HOME}"
DIR="${L95_DIR:-$H/lsms-deployment}"; PROJ="${L95_PROJ:-lsms-deployment}"; HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || { echo "SIYO: $DIR haipo"; echo "---95_IMESHINDWA---"; exit 1; }
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---95_IMESHINDWA---"; exit 1; }
D="${1:-$(TZ=Africa/Dar_es_Salaam date +%F)}"
[[ "$D" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && date -d "$D" +%F >/dev/null 2>&1 || die "tarehe '$D' si YYYY-MM-DD"
LIVE="e.status='POSTED' and not coalesce(e.is_deleted,false)"
cid=$(docker compose -p "$PROJ" ps -q backend | head -n1)
[ -n "$cid" ] || die "container ya backend haipo"
penv() { docker exec "$cid" printenv "$1" 2>/dev/null | tr -dc 'A-Za-z0-9.-'; }

echo "=== 95 SIKU YA KWANZA - D $D - $(date '+%F %T %Z') - KUSOMA TU"
echo "--- 1 toleo"
echo "  backend $(docker inspect -f '{{.Config.Image}}' "$cid" | sed 's/.*://') | frontend-v3 $(docker inspect -f '{{.Config.Image}}' "$(docker compose -p "$PROJ" ps -q frontend-v3 | head -n1)" 2>/dev/null | sed 's/.*://') | Flyway ya mwisho $(q "select max(version::int) from flyway_schema_history where success and version ~ '^[0-9]+\$'")"
echo "  backend ilianza: $(docker inspect -f '{{.State.StartedAt}}' "$cid" | cut -c1-19)Z | restarts $(docker inspect -f '{{.RestartCount}}' "$cid")"
RV=$(penv APP_FEATURES_SALES_RETURNS_ENABLED); S=${L95_PCF:-$(penv LSMS_PURCHASE_CHECK_FROM)}   # L95_PCF: jaribio la ndani tu
echo "  marejesho APP_FEATURES_SALES_RETURNS_ENABLED =${RV:-HAIJAWEKWA}$([ "$RV" = true ] && echo ' !! ON - uamuzi hh ni OFF' || echo ' (OFF - uamuzi hh)')"
echo "  onyo la manunuzi LSMS_PURCHASE_CHECK_FROM =${S:-HAIJAWEKWA (default ya jar 2026-12-02)}"
S="${S:-2026-12-02}"

echo "--- 2 onyo la manunuzi (sheria ya 6e) siku $S .. $D: siku | reco (manunuzi) | DROO siku hiyo | DROO d-1..d+1 | reco d-1..d+1 | matokeo"
if [[ "$D" < "$S" ]]; then echo "  D $D < mwanzo $S: hakuna onyo bado"; else
q "with days as (select g::date d from generate_series(date '$S', date '$D', interval '1 day') g),
     reco as (select r.reconciliation_date d, sum(p.amount) a from reconciliation_purchases p join daily_reconciliation r on r.uid = p.reconciliation_uid
              where not coalesce(p.is_deleted,false) and not coalesce(r.is_deleted,false) and r.reconciliation_date between date '$S' - 1 and date '$D' + 1 group by 1),
     dr as (select d, sum(a) a from (
              select cast(purchase_date as date) d, case when supplier_uid is null or supplier_uid = '' then coalesce(total_amount,0) else coalesce(amount_paid,0) end a
              from purchases where payment_source = 'DROO' and not coalesce(is_deleted,false) and coalesce(status,'') <> 'CANCELLED'
                and cast(purchase_date as date) between date '$S' - 1 and date '$D' + 1
              union all
              select cast(payment_date as date), amount from supplier_payments where payment_source = 'DROO' and not coalesce(is_deleted,false)
                and cast(payment_date as date) between date '$S' - 1 and date '$D' + 1) x group by 1),
     t as (select days.d,
              coalesce((select a from reco where reco.d = days.d),0) r,
              coalesce((select a from dr where dr.d = days.d),0) p,
              coalesce((select sum(a) from dr where dr.d between days.d - 1 and days.d + 1),0) pa,
              coalesce((select sum(a) from reco where reco.d between days.d - 1 and days.d + 1),0) ra from days)
   select d, r::numeric(19,0), p::numeric(19,0), pa::numeric(19,0), ra::numeric(19,0),
          case when r > 0 and abs(r - pa) >= 1 then 'ONYO: reco '||r::numeric(19,0)||', yaliyoandikwa '||pa::numeric(19,0)
               when r <= 0 and p > 0 and ra = 0 then 'ONYO: reco 0, DROO '||p::numeric(19,0)
               else 'SAWA' end
   from t order by d" | sed 's/^/  /'
fi
echo "  (siku $D inalinganishwa pia na DROO ya $(date -d "$D +1 day" +%F): ripoti ya jioni ni ya muda - kesho ndiyo ya mwisho)"
echo "--- 2b manunuzi ya $D: uid8 | jina | msambazaji? | jumla | kilicholipwa | hali ya malipo | chanzo | hali | aliyeandika"
q "select left(uid,8), coalesce(nullif(trim(supplier_name),''),'(tupu)'), case when supplier_uid is null or supplier_uid = '' then 'HAPANA' else 'NDIYO' end,
          total_amount::numeric(19,0), coalesce(amount_paid,0)::numeric(19,0), coalesce(payment_status,'-'), coalesce(payment_source,'-'), coalesce(status,'-'), coalesce(received_by, updated_by, '-')
   from purchases where cast(purchase_date as date) = date '$D' and not coalesce(is_deleted,false) order by purchase_date" | sed 's/^/  /'
echo "  jumla: $(q "select count(*)||' | '||coalesce(sum(total_amount),0)::numeric(19,0)||' | bila chanzo (payment_source tupu) '||count(*) filter (where coalesce(payment_source,'') = '') from purchases where cast(purchase_date as date) = date '$D' and not coalesce(is_deleted,false)")"
echo "--- 2c malipo ya wasambazaji ya $D: uid8 | kiasi | njia | chanzo | purchase8 | aliyelipa"
q "select left(uid,8), amount::numeric(19,0), coalesce(payment_method,'-'), coalesce(payment_source,'-'), coalesce(left(purchase_uid,8),'-'), coalesce(paid_by_name,'-')
   from supplier_payments where cast(payment_date as date) = date '$D' and not coalesce(is_deleted,false) order by payment_date" | sed 's/^/  /'
echo "--- 2d mistari ya manunuzi kwenye reco ya $D: muuzaji | jina | kiasi | purchase8 | imethibitishwa"
q "select coalesce(r.user_name,'-'), coalesce(p.supplier_name, p.description, '-'), p.amount::numeric(19,0), coalesce(left(p.purchase_uid,8),'-'), coalesce(p.is_verified,false)
   from reconciliation_purchases p join daily_reconciliation r on r.uid = p.reconciliation_uid
   where r.reconciliation_date = date '$D' and not coalesce(p.is_deleted,false) and not coalesce(r.is_deleted,false) order by 1" | sed 's/^/  /'

echo "--- 3 reco ya $D: muuzaji | hali | mauzo (auto) | droo iliyotangazwa | droo inayotarajiwa | tofauti | manunuzi | matumizi | imewasilishwa | imeidhinishwa na"
q "select coalesce(user_name,'-'), status, auto_total_sales::numeric(19,0), cash_on_hand_declared::numeric(19,0), expected_cash::numeric(19,0), variance_amount::numeric(19,0),
          purchases_total::numeric(19,0), expenses_total::numeric(19,0), coalesce(to_char(submitted_at,'HH24:MI'),'-'), coalesce(approved_by_name,'-')||coalesce(' '||to_char(approved_at,'DD/MM HH24:MI'),'')
   from daily_reconciliation where reconciliation_date = date '$D' and not coalesce(is_deleted,false) order by 1" | sed 's/^/  /'
echo "  maelezo ya tofauti: $(q "select coalesce(string_agg(coalesce(user_name,'-')||': '||left(variance_explanation,120), ' || '),'-') from daily_reconciliation where reconciliation_date = date '$D' and not coalesce(is_deleted,false) and coalesce(variance_explanation,'') <> ''")"
echo "--- 3b wauzaji wenye mauzo ya $D BILA reco: muuzaji | sale | jumla"
q "select coalesce(u.email, s.user_uid), count(*), sum(s.total_amount)::numeric(19,0) from sales s left join users u on u.uid = s.user_uid
   where s.sale_date::date = date '$D' and not coalesce(s.is_deleted,false)
     and not exists (select 1 from daily_reconciliation r where r.user_uid = s.user_uid and r.reconciliation_date = date '$D' and not coalesce(r.is_deleted,false))
   group by 1 order by 1" | sed 's/^/  /'

echo "--- 4 mauzo ya $D: muuzaji | sale | jumla | faida"
q "select coalesce(u.email, s.user_uid), count(*), sum(s.total_amount)::numeric(19,0), sum(coalesce(s.total_profit,0))::numeric(19,0) from sales s left join users u on u.uid = s.user_uid
   where s.sale_date::date = date '$D' and not coalesce(s.is_deleted,false) group by 1 order by 1" | sed 's/^/  /'
echo "  sale zilizofutwa (sale_date $D): $(q "select count(*)||' | '||coalesce(sum(total_amount),0)::numeric(19,0) from sales where sale_date::date = date '$D' and coalesce(is_deleted,false)")"
echo "  marejesho (sales_returns) tangu 13/11: $(q "select count(*) from sales_returns where created_at >= '2026-11-13'") (lazima 0 - OFF)"
echo "  GL: TB $(q "select coalesce(sum(l.debit_amount - l.credit_amount),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid = l.journal_entry_uid where $LIVE") | journal za $D (POSTED) $(q "select count(*) from journal_entry e where e.entry_date::date = date '$D' and $LIVE" 2>/dev/null || echo '?') | journal zisizo POSTED zilizoundwa tangu 13/11: $(q "select count(*) from journal_entry e where e.created_at >= '2026-11-13' and e.status <> 'POSTED'")"

echo "--- 5 log ya backend saa 24 (docker logs --since 24h)"
LG=$(docker logs --since 24h "$cid" 2>&1)
echo "  mistari $(wc -l <<<"$LG") | ERROR $(grep -cE ' ERROR ' <<<"$LG") | WARN $(grep -cE ' WARN ' <<<"$LG") | Exception $(grep -c 'Exception' <<<"$LG")"
echo "  ERROR zinazojirudia zaidi (idadi | ujumbe, bila muda):"
grep -E ' ERROR ' <<<"$LG" | sed -E 's/^[^ ]+ +ERROR +[0-9]+ +--- +//; s/\[[^]]*\] *//; s/[0-9a-f]{8}-[0-9a-f-]{27}/<uid>/g; s/[0-9]{4,}/<n>/g' | cut -c1-200 \
  | sort | uniq -c | sort -rn | head -10 | sed 's/^ */    /'
echo "  ERROR ya kwanza / ya mwisho: $(grep -E ' ERROR ' <<<"$LG" | head -1 | cut -c1-19) / $(grep -E ' ERROR ' <<<"$LG" | tail -1 | cut -c1-19)"

echo "--- 6 hatua 74 KAGUA (kusoma tu)"
if [ -f "$HERE/74-umelipa-sasa.sh" ]; then
  L74_DIR="$DIR" L74_PROJ="$PROJ" bash "$HERE/74-umelipa-sasa.sh" kagua 2>&1 | sed 's/^/  /'
else echo "  74-umelipa-sasa.sh haipo kando ya script hii"; fi
echo "---95_MWISHO---"
