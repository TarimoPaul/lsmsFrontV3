-- HATUA 65 (mmiliki 02/11 bv) - KUSOMA TU, PROD. Sale 6 zilizofutwa tangu 30/10: bidhaa zake, kama ziliingizwa upya,
-- na kama bidhaa hizo zilionekana upungufu kwenye hesabu iliyofuata na kutozwa 1120.
-- Haitumii safu za 2.4.0 (replaces_sale_uid): prod iko 2.3.0 / Flyway 135.
\pset footer off
\set ON_ERROR_STOP on
SELECT 'FLYWAY|' || max(version::int) || '|' || count(*) FILTER (WHERE NOT success) || ' zilizoshindwa'
  FROM flyway_schema_history WHERE version ~ '^[0-9]+$';
SELECT 'SAA_YA_DB|' || now()::timestamp(0) || '|' || current_setting('TimeZone') || '|read_only ' || current_setting('transaction_read_only');

WITH
r AS (SELECT unnest(ARRAY['301026-2245', '301026-2251', '301026-2253', '311026-0831', '311026-2139', '011126-0720']) rc),
-- zote zilizofutwa tangu 30/10 (ili kuona kama kuna zaidi ya 6)
d AS MATERIALIZED (
  SELECT s.uid, s.receipt_number rc, s.sale_date, s.created_at, s.deleted_at, s.deleted_date, s.deleted_by, s.user_uid, s.total_amount,
         s.payment_status, s.deletion_reason, s.sale_notes, s.customer_id, coalesce(s.is_deleted, false) del,
         coalesce(s.deleted_at, s.deleted_date, s.updated_at) wakati
    FROM sales s WHERE s.receipt_number IN (SELECT rc FROM r)
       OR (coalesce(s.is_deleted, false) AND coalesce(s.deleted_at, s.deleted_date, s.updated_at) >= TIMESTAMP '2026-10-30 00:00')),
mt AS (SELECT uid, coalesce(first_name, '') || ' ' || coalesce(last_name, '') nm, email FROM users),
-- mwendo wa stock wa kila sale (vipande): SALE (−) na SALE_REVERSAL (+)
mv AS MATERIALIZED (
  SELECT d.uid su, m.products_uid pu, m.movement_type t, m.movement_date md, coalesce(m.stock_after - m.stock_before, m.quantity) dq
    FROM d JOIN store m ON NOT coalesce(m.is_deleted, false)
     AND (m.reference = 'SALE-' || d.rc OR m.reference LIKE 'SALE_REV-' || d.rc || '-%')),
ln AS MATERIALIZED (
  SELECT d.uid su, sd.product_uid pu, sum(coalesce(sd.sub_total, 0)) sub, sum(coalesce(sd.total_cost, 0)) cost,
         string_agg(coalesce(sd.sale_type, '-') || ' ' || coalesce(sd.package_quantity, 0) || 'p+' || coalesce(sd.piece_quantity, 0) || 'v', ', ') qty,
         bool_and(coalesce(sd.is_deleted, false)) ldel
    FROM d JOIN sales_details sd ON sd.sale_uid = d.uid GROUP BY d.uid, sd.product_uid),
bp AS MATERIALIZED (   -- bidhaa za kila sale + mwendo wake
  SELECT ln.su, ln.pu, ln.sub, ln.cost, ln.qty, ln.ldel,
         coalesce((SELECT sum(dq) FROM mv WHERE mv.su = ln.su AND mv.pu = ln.pu AND mv.t = 'SALE'), 0) uzwa,
         coalesce((SELECT sum(dq) FROM mv WHERE mv.su = ln.su AND mv.pu = ln.pu AND mv.t = 'SALE_REVERSAL'), 0) rudi,
         (SELECT min(md) FROM mv WHERE mv.su = ln.su AND mv.pu = ln.pu AND mv.t = 'SALE_REVERSAL') rudi_lini
    FROM ln),
-- sale mbadala: hai, yenye bidhaa ileile, iliyoundwa kati ya saa 2 kabla na saa 24 baada ya kufutwa (au inayotaja risiti yake)
mb AS MATERIALIZED (
  SELECT d.uid su, n.uid nu, n.receipt_number nrc, n.created_at ncr, n.sale_date nsd, n.total_amount ntot, n.user_uid nuser,
         count(DISTINCT nd.product_uid) FILTER (WHERE nd.product_uid IN (SELECT pu FROM bp WHERE bp.su = d.uid)) sawa,
         (SELECT count(*) FROM bp WHERE bp.su = d.uid) zote,
         coalesce(n.sale_notes, '') LIKE '%' || d.rc || '%' taja
    FROM d JOIN sales n ON n.uid <> d.uid AND NOT coalesce(n.is_deleted, false)
     AND (n.created_at BETWEEN d.wakati - interval '2 hours' AND d.wakati + interval '24 hours'
          OR coalesce(n.sale_notes, '') LIKE '%' || d.rc || '%')
    JOIN sales_details nd ON nd.sale_uid = n.uid AND NOT coalesce(nd.is_deleted, false)
   GROUP BY d.uid, d.rc, n.uid, n.receipt_number, n.created_at, n.sale_date, n.total_amount, n.user_uid, n.sale_notes),
mb5 AS MATERIALIZED (   -- 5 bora kwa kila sale: inataja risiti, kisha bidhaa nyingi sawa, kisha jumla inayokaribiana
  SELECT * FROM (SELECT mb.*, row_number() OVER (PARTITION BY mb.su ORDER BY mb.taja DESC, mb.sawa DESC,
                                                  abs(mb.ntot - (SELECT total_amount FROM d WHERE d.uid = mb.su)), mb.ncr) rn,
                        count(*) OVER (PARTITION BY mb.su) wote
                   FROM mb WHERE mb.sawa > 0) z WHERE rn <= 5),
-- hesabu baada ya kufutwa, kwa bidhaa za sale
hs AS MATERIALIZED (
  SELECT bp.su, bp.pu, cs.session_date, cs.status cst, cl.uid clu, cl.system_qty_snapshot sq, cl.counted_qty cq, cl.variance_qty vq,
         cl.variance_value vv, cl.charge_value chg, cl.cashier_reason cr, cl.cashier_note cn,
         row_number() OVER (PARTITION BY bp.su, bp.pu ORDER BY cs.session_date, cs.id) nr
    FROM bp JOIN d ON d.uid = bp.su
    JOIN counting_line cl ON cl.product_uid = bp.pu AND NOT coalesce(cl.is_deleted, false)
    JOIN counting_session cs ON cs.uid = cl.session_uid AND NOT coalesce(cs.is_deleted, false)
   WHERE coalesce(cs.started_at, cs.session_date::timestamp) >= d.created_at AND cl.counted_qty IS NOT NULL),
matokeo AS (
  SELECT 10 o, d.created_at k1, ''::text k2, 'SALE|' || d.rc || '|sale_date ' || d.sale_date::timestamp(0) || '|created ' || d.created_at::timestamp(0)
         || '|futwa ' || d.del || ' ' || coalesce(d.deleted_at::timestamp(0)::text, coalesce(d.deleted_date::timestamp(0)::text, '-'))
         || '|na ' || coalesce(d.deleted_by, '-') || ' = ' || coalesce((SELECT nm FROM mt WHERE mt.uid = d.deleted_by OR mt.email = d.deleted_by LIMIT 1), 'HAIJULIKANI')
         || '|muuzaji ' || coalesce((SELECT nm FROM mt WHERE mt.uid = d.user_uid), '-') || '|jumla ' || d.total_amount || '|' || coalesce(d.payment_status, '-')
         || '|sababu ' || coalesce(left(replace(d.deletion_reason, E'\n', ' '), 120), '-') || '|maelezo ' || coalesce(left(replace(d.sale_notes, E'\n', ' '), 120), '-')
         || '|kwenye_orodha ' || (d.rc IN (SELECT rc FROM r)) x FROM d
  UNION ALL SELECT 11, NULL, rc, 'SALE_HAIPO|' || rc FROM r WHERE rc NOT IN (SELECT rc FROM d)
  UNION ALL SELECT 12, NULL, '', 'IDADI|kwenye_orodha ' || (SELECT count(*) FROM d WHERE rc IN (SELECT rc FROM r))
         || '|zilizofutwa_tangu_30_10 ' || (SELECT count(*) FROM d WHERE del) || '|nje_ya_orodha ' || (SELECT count(*) FROM d WHERE rc NOT IN (SELECT rc FROM r))
  UNION ALL SELECT 20, d.created_at, p.product_name, 'BIDHAA|' || d.rc || '|' || p.product_name || '|' || left(p.uid, 8) || '|' || bp.qty || '|sub ' || bp.sub
         || '|gharama ' || bp.cost || '|stock_uzwa ' || bp.uzwa || '|stock_rudi ' || bp.rudi || ' ' || coalesce(bp.rudi_lini::timestamp(0)::text, '-')
         || '|mstari_umefutwa ' || bp.ldel
         FROM bp JOIN d ON d.uid = bp.su JOIN products p ON p.uid = bp.pu
  UNION ALL SELECT 30, d.created_at, mb.nrc, 'MBADALA|' || d.rc || ' -> ' || mb.nrc || '|created ' || mb.ncr::timestamp(0) || '|sale_date ' || mb.nsd::timestamp(0)
         || '|jumla ' || mb.ntot || ' (ya zamani ' || d.total_amount || ')|bidhaa_sawa ' || mb.sawa || '/' || mb.zote
         || '|muuzaji ' || coalesce((SELECT nm FROM mt WHERE mt.uid = mb.nuser), '-') || '|inataja_risiti ' || mb.taja
         || '|nafasi ' || mb.rn || ' kati ya ' || mb.wote
         || '|tathmini ' || CASE WHEN mb.taja OR (mb.sawa = mb.zote AND mb.ntot = d.total_amount) THEN 'IMEINGIZWA_UPYA'
                                 WHEN mb.sawa = mb.zote THEN 'HUENDA (bidhaa zote, jumla tofauti)' ELSE 'SEHEMU' END
         FROM mb5 mb JOIN d ON d.uid = mb.su
  UNION ALL SELECT 31, d.created_at, '', 'MBADALA_HAKUNA|' || d.rc FROM d WHERE NOT EXISTS (SELECT 1 FROM mb5 WHERE mb5.su = d.uid)
  UNION ALL SELECT 40, d.created_at, p.product_name || hs.session_date, 'HESABU|' || d.rc || '|' || p.product_name || '|' || hs.session_date || ' (' || coalesce(hs.cst, '-')
         || ', ya ' || hs.nr || ')|mfumo ' || coalesce(hs.sq::text, '-') || '|imehesabiwa ' || coalesce(hs.cq::text, '-') || '|tofauti ' || coalesce(hs.vq::text, '-')
         || ' (' || coalesce(hs.vv::text, '-') || ')|tozo ' || coalesce(hs.chg::text, '-') || '|sababu ' || coalesce(hs.cr, '-') || ' ' || coalesce(left(hs.cn, 60), '')
         || '|1120 ' || coalesce((SELECT string_agg(coalesce(mt.nm, sl.user_uid) || ' ' || li.line_amount || ' (' || coalesce(sl.status, '-') || ')', '; ')
                                    FROM staff_liability_item li JOIN staff_liability sl ON sl.uid = li.liability_uid LEFT JOIN mt ON mt.uid = sl.user_uid
                                   WHERE li.counting_line_uid = hs.clu AND NOT coalesce(li.is_deleted, false) AND NOT coalesce(sl.is_deleted, false)), 'hakuna')
         || '|stock_adjustment ' || coalesce((SELECT string_agg(sa.adjustment_qty || ' ' || sa.adjustment_value || ' ' || coalesce(sa.gl_dr_account_code, '-') || '/'
                                                               || coalesce(sa.gl_cr_account_code, '-') || ' ' || coalesce(sa.reason, '-'), '; ')
                                                FROM stock_adjustment sa WHERE sa.counting_line_uid = hs.clu AND NOT coalesce(sa.is_deleted, false)), 'hakuna')
         FROM hs JOIN d ON d.uid = hs.su JOIN products p ON p.uid = hs.pu WHERE hs.nr <= 2
  UNION ALL SELECT 41, d.created_at, '', 'HESABU_HAKUNA|' || d.rc || '|hakuna hesabu (iliyohesabiwa) ya bidhaa zake tangu sale iliundwa'
         FROM d WHERE NOT EXISTS (SELECT 1 FROM hs WHERE hs.su = d.uid)
)
SELECT x FROM matokeo ORDER BY k1 NULLS FIRST, o, k2, x;
SELECT 'USHAHIDI_65_SQL_UMEKAMILIKA';
