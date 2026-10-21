-- 11 (Awamu 1b, kipengele 3): sales zilizoingizwa kwa kuchelewa, kwa makundi ya muda.
-- DB: lsms_audit_20261015_0200. Kusoma tu. Sales zisizofutwa tu.
-- kuchelewa = created_at - sale_date. sale_date yenye saa 00:00:00 ni "tarehe tu" (1,054 kati ya 2,312): kwa hizo kuchelewa
-- kunapimwa kuanzia MWISHO wa siku ya sale (sale_date + siku 1); ikiingizwa ndani ya siku ileile = "siku ileile (tarehe tu)".
SET default_transaction_read_only = on;
WITH s AS (
  SELECT s.*, (s.sale_date::time = '00:00:00') tarehe_tu,
         CASE WHEN s.sale_date::time = '00:00:00' THEN s.created_at - (s.sale_date + interval '1 day')
              ELSE s.created_at - s.sale_date END lag
  FROM sales s WHERE NOT s.is_deleted),
b AS (
  SELECT s.*, CASE
      WHEN tarehe_tu AND lag <= interval '0' AND created_at >= sale_date THEN '1 siku ileile (tarehe tu)'
      WHEN lag < interval '0' THEN '0 kabla ya sale_date'
      WHEN lag < interval '6 hours' THEN '2 < 6h'
      WHEN lag < interval '24 hours' THEN '3 6-24h'
      WHEN lag < interval '3 days' THEN '4 siku 1-3'
      ELSE '5 > siku 3' END kundi
  FROM s)
SELECT kundi, count(*) idadi, round(sum(total_amount)) tzs,
       count(*) FILTER (WHERE sale_source='STANDARD') standard, count(*) FILTER (WHERE sale_source<>'STANDARD') nyingine,
       count(*) FILTER (WHERE tarehe_tu) tarehe_tu,
       count(*) FILTER (WHERE date_trunc('month',created_at) > date_trunc('month',sale_date)) mwezi_uliopita,
       count(*) FILTER (WHERE sale_date >= '2026-09-30 10:32:19' OR created_at >= '2026-09-30 10:32:19') tangu_gl_live,
       max(lag) kuchelewa_max
FROM b GROUP BY ROLLUP (kundi) ORDER BY kundi NULLS LAST;
-- sale_source zilizopo
SELECT sale_source, count(*), count(*) FILTER (WHERE sale_date::time='00:00:00') tarehe_tu FROM sales WHERE NOT is_deleted GROUP BY 1;
-- Ulinganisho na RIPOTI H-7 (kipimo cha siku za kalenda, kama 09): 14/10 ilikuwa 1,034 (815 STANDARD, 219 walk-in, hadi siku 36)
SELECT count(*) FILTER (WHERE created_at::date - sale_date::date >= 1) siku_1_au_zaidi,
       count(*) FILTER (WHERE created_at::date - sale_date::date >= 1 AND sale_source='STANDARD') standard,
       count(*) FILTER (WHERE created_at::date - sale_date::date >= 1 AND sale_source<>'STANDARD') nyingine,
       max(created_at::date - sale_date::date) max_siku
FROM sales WHERE NOT is_deleted;
-- "kabla ya sale_date": sale_date ya baadaye kuliko created_at (sales za kabla, mfano za kesho?)
SELECT sale_source, count(*), min(sale_date - created_at), max(sale_date - created_at)
FROM sales WHERE NOT is_deleted AND sale_date::time <> '00:00:00' AND created_at < sale_date GROUP BY 1;
-- Sales 242 za "kabla ya sale_date": kipindi chake (dhana: created_at ni UTC na sale_date ni EAT, +3h)
SELECT min(created_at)::date kuanzia, max(created_at)::date hadi, count(*),
       count(*) FILTER (WHERE sale_date - created_at BETWEEN interval '2 hours' AND interval '3 hours') kati_ya_2h_3h
FROM sales WHERE NOT is_deleted AND sale_date::time <> '00:00:00' AND created_at < sale_date;
SELECT date_trunc('month', created_at)::date mwezi, count(*) FILTER (WHERE created_at < sale_date AND sale_date::time <> '00:00:00') kabla,
       count(*) FILTER (WHERE sale_date::time <> '00:00:00') zenye_saa
FROM sales WHERE NOT is_deleted GROUP BY 1 ORDER BY 1;
