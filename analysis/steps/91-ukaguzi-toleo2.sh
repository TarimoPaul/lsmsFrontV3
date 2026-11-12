#!/usr/bin/env bash
# HATUA 91 (mmiliki 12/11 fi/fj) - PROD, KUSOMA TU: ukaguzi wa mwisho kabla ya toleo 2 (MUHTASARI-TOLEO2).
#   1. Jagger: majina ya SKU 4 (Chief amebadilisha mwenyewe kwenye V3) - yaonyeshe saizi; kwenye nakala ya 29/10 yalikuwa
#      JAGER MASTER x2 / JAGGER MASTER x2 (4d727520, 4453f20a, 886dc1ed, 6dc452f6)
#   2. Flyway ya prod (toleo 2 litaongeza hadi 150) na gl_config (D lazima iwe HAIJAWEKWA kabla ya toleo 2)
#   3. akaunti za pesa (fj: ZOTE wazi): hali, salio, ilitumika mwisho, journal za siku 30 - kwa hatua 60 na orodha za chanzo
#   4. mkopo A (04/12): malipo ya mkopo yaliyopo
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
echo "--- 1. Jagger (uid8 | jina | active | deleted | stock | bei ya kipande | ilibadilishwa)"
q "select left(uid,8), product_name, is_active, coalesce(is_deleted,false), current_stock, piece_sale_price, updated_at::date from products where product_name ilike '%jag%' order by product_name, uid" | sed 's/^/  /'
J=$(q "select count(*) from products where product_name ilike '%jag%' and not coalesce(is_deleted,false) and product_name !~ '[0-9]'")
echo "  JAGGER_BILA_SAIZI $J   (0 = kila jina lina saizi, k.m. 700ML / 1L)"
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
echo "---91_KAGUA_MWISHO---"
