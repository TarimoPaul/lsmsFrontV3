#!/usr/bin/env bash
# HATUA 81 (mmiliki 10/11 dw) - PROD, KUSOMA TU: materialized views (mv_*) - zipo zipi, zina data hadi lini,
# zimepitwa na mauzo halisi kiasi gani, na log ya refresh (kosa la MaterializedViewScheduler).
# Hakuna REFRESH, hakuna kuandika. Kila SELECT ni ndogo (meza ya sales ya duka moja).
set -u
cd /home/chief/lsms-deployment || { echo "HAIPO lsms-deployment"; exit 1; }
# KUSOMA TU kwa lazima: kila muunganisho una default_transaction_read_only=on (andiko lolote lingekataliwa na PG).
q() { docker compose exec -T -e "SQL=$1" -e "PGOPTIONS=-c default_transaction_read_only=on" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " | " -v ON_ERROR_STOP=1 -c "$SQL"' < /dev/null; }
echo "=== 0 HALI"
docker compose ps --format '{{.Service}} {{.Image}} {{.Status}}' < /dev/null
echo "=== 1 VIEW ZILIZOPO: jina | ina data | ukubwa"
q "select matviewname, ispopulated, pg_size_pretty(pg_total_relation_size(('public.'||matviewname)::regclass)) from pg_matviews where schemaname='public' order by 1"
echo "=== 2 DATA YA MWISHO NDANI YA VIEW vs MAUZO HALISI"
echo "--- 2a mv_daily: siku | max(sale_date) | jumla ya total_amount"
q "select count(*), max(sale_date), coalesce(sum(total_amount),0)::numeric(19,0) from mv_daily_sales_summary"
echo "--- 2b mv_hourly: safu | max(sale_date)"
q "select count(*), max(sale_date) from mv_hourly_sales_summary"
echo "--- 2c mv_monthly: safu | mwezi wa mwisho"
q "select count(*), max(year*100+month) from mv_monthly_sales_summary"
echo "--- 2d mv_top_products: safu | jumla ya quantity_sold"
q "select count(*), coalesce(sum(quantity_sold),0)::numeric(19,0) from mv_top_products_summary"
echo "--- 2e mauzo halisi (kanuni ileile ya view): siku | max(sale_date) | jumla"
q "select count(distinct s.sale_date::date), max(s.sale_date::date), coalesce(sum(s.total_amount),0)::numeric(19,0) from sales s where s.is_active = true and s.is_deleted = false and (s.sale_source is null or s.sale_source = 'STANDARD')"
echo "--- 2f siku 10 za mwisho: tarehe | mauzo halisi | ndani ya mv_daily | tofauti"
q "with h as (select s.sale_date::date d, sum(s.total_amount) a from sales s where s.is_active = true and s.is_deleted = false and (s.sale_source is null or s.sale_source = 'STANDARD') and s.sale_date >= current_date - 10 group by 1)
   select h.d, h.a::numeric(19,0), coalesce(m.total_amount,0)::numeric(19,0), (h.a - coalesce(m.total_amount,0))::numeric(19,0) from h left join mv_daily_sales_summary m on m.sale_date = h.d order by 1"
echo "--- 2g siku ya mwisho ambayo mv_daily inalingana na mauzo halisi (tofauti < 1)"
q "with h as (select s.sale_date::date d, sum(s.total_amount) a from sales s where s.is_active = true and s.is_deleted = false and (s.sale_source is null or s.sale_source = 'STANDARD') group by 1)
   select max(h.d) from h join mv_daily_sales_summary m on m.sale_date = h.d where abs(h.a - m.total_amount) < 1"
echo "=== 3 TAKWIMU ZA PG (dalili ya refresh): jina | n_tup_ins | n_live_tup | last_autovacuum | last_autoanalyze | last_analyze"
q "select relname, n_tup_ins, n_live_tup, coalesce(last_autovacuum::timestamp(0)::text,'-'), coalesce(last_autoanalyze::timestamp(0)::text,'-'), coalesce(last_analyze::timestamp(0)::text,'-') from pg_stat_user_tables where relname like 'mv\_%' order by 1"
echo "takwimu_tangu $(q "select coalesce(stats_reset::timestamp(0)::text,'-') from pg_stat_database where datname = current_database()") | pg_iliwashwa $(q "select pg_postmaster_start_time()::timestamp(0)")"
echo "=== 4 FLYWAY: migration za view (V096 ilizijenga upya)"
q "select version, installed_on::timestamp(0), success from flyway_schema_history where version in ('14','15','16','17','60','96') order by installed_rank"
echo "=== 5 LOG YA FAILI (./logs/backend, tangu 2.4.0): refresh kwa siku"
if [ -d logs/backend ]; then
  ls -la logs/backend | tail -5
  for f in logs/backend/*; do
    [ -f "$f" ] || continue
    echo "$(basename "$f") | imeshindwa $(grep -c 'Failed to refresh materialized views' "$f") | imefanikiwa $(grep -c 'Materialized views refreshed' "$f") | baada_ya_kubadili_tarehe $(grep -c 'after sale date change' "$f")"
  done
else
  echo "HAKUNA logs/backend"
fi
echo "=== 6 LOG YA CONTAINER (tangu container ianze)"
L=$(docker compose logs --no-log-prefix backend < /dev/null 2>&1)
echo "imeshindwa $(grep -c 'Failed to refresh materialized views' <<<"$L") | imefanikiwa $(grep -c 'Materialized views refreshed' <<<"$L") | kwanza $(grep -m1 'Failed to refresh materialized views' <<<"$L" | cut -c1-19)"
echo "---MWISHO-81---"
