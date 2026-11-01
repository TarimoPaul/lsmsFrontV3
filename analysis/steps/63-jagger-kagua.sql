-- HATUA 63 (mmiliki 01/11 bo) - KAGUA, KUSOMA TU. Jagger Master: carton ya chupa 6 iliyoingizwa kama chupa 1 (11/10).
-- Inaendeshwa ndani ya transaction ya kusoma tu. Kila mstari una lebo J63_...; 63-rekebisha-jagger.mjs inazisoma.
-- Kiasi kinahesabiwa kwa njia mbili zinazojitegemea, na lazima zilingane:
--   A = thamani ambayo Jagger iliweka kwenye 1200 tangu manunuzi ya 11/10 (stock ilikuwa 0 kabla yake):
--       manunuzi (jumla) + marekebisho ya hesabu (adjustment_value) - COGS ya mauzo (sales_details.total_cost)
--       MINUS chupa zilizopo x gharama sahihi;
--   B = chupa zilizopo x (gharama ya sasa - gharama sahihi).
--   Gharama sahihi = bei ya carton ya 11/10 / chupa kwa carton.
\pset footer off
\set ON_ERROR_STOP on
\set P '886dc1ed-2793-453c-bc9f-2c1e251ec5de'
SELECT 'J63_TAREHE|' || (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
SELECT 'J63_KIPINDI|' || m || '|' || coalesce((SELECT status FROM gl_period WHERE period_year = 2026 AND period_month = m LIMIT 1), 'OPEN')
  FROM (VALUES (10), (11)) v(m);
SELECT 'J63_BIDHAA|' || uid || '|' || product_name || '|' || coalesce(pieces_per_package, 0) || '|' || coalesce(current_average_cost, 0)
       || '|' || coalesce(last_purchase_cost, 0) || '|' || coalesce(current_stock, 0) || '|' || coalesce(is_deleted, false)
  FROM products WHERE uid = :'P';
-- Manunuzi ya 11/10 (nanga): lazima yawe moja, PER_PIECE, gharama = bei nzima, na stock ilikuwa 0 kabla yake.
WITH a AS (SELECT pr.* FROM purchases pr
            WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false))
SELECT 'J63_NANGA|' || count(*) || '|' || coalesce(max(a.uid), '-') || '|' || coalesce(max(a.total_amount), 0) || '|' || coalesce(max(a.cost_per_piece), 0)
       || '|' || coalesce(max(a.pieces_per_package_at_purchase), 0) || '|' || coalesce(max(a.price_input_mode), '-')
       || '|' || coalesce((SELECT max(s.movement_date)::text FROM store s WHERE s.reference = 'PUR-' || max(a.uid)), '-')
       || '|' || coalesce((SELECT max(s.stock_before) FROM store s WHERE s.reference = 'PUR-' || max(a.uid)), -1)
  FROM a;
-- Kila mwendo wa stock tangu nanga (aina zisizo PURCHASE/ADJUSTMENT/SALE = hatua inasimama, ichunguzwe kwa mkono).
WITH t0 AS (SELECT min(s.movement_date) AS t FROM store s JOIN purchases pr ON s.reference = 'PUR-' || pr.uid
             WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false))
SELECT 'J63_MWENDO|' || s.movement_date::timestamp(0) || '|' || s.movement_type || '|' || s.quantity || '|' || coalesce(s.stock_before, 0)
       || '->' || coalesce(s.stock_after, 0) || '|' || coalesce(s.unit_price::text, '-') || '|' || coalesce(s.reference, '-')
  FROM store s, t0 WHERE s.products_uid = :'P' AND s.movement_date >= t0.t AND NOT coalesce(s.is_deleted, false)
 ORDER BY s.movement_date, s.id;
WITH t0 AS (SELECT min(s.movement_date) AS t FROM store s JOIN purchases pr ON s.reference = 'PUR-' || pr.uid
             WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false))
SELECT 'J63_MWENDO_MWINGINE|' || count(*) FILTER (WHERE s.movement_type NOT IN ('PURCHASE', 'ADJUSTMENT', 'SALE'))
       || '|stock_ya_mwisho ' || coalesce((SELECT s2.stock_after FROM store s2, t0 WHERE s2.products_uid = :'P' AND NOT coalesce(s2.is_deleted, false)
                                            ORDER BY s2.movement_date DESC, s2.id DESC LIMIT 1), -1)
  FROM store s, t0 WHERE s.products_uid = :'P' AND s.movement_date >= t0.t AND NOT coalesce(s.is_deleted, false);
-- Mauzo ya Jagger tangu nanga: siku, chupa, COGS iliyotumika.
WITH t0 AS (SELECT min(s.movement_date) AS t FROM store s JOIN purchases pr ON s.reference = 'PUR-' || pr.uid
             WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false))
SELECT 'J63_MAUZO|' || sa.sale_date::date || '|' || sa.receipt_number || '|chupa ' || d.piece_quantity || '|gharama_kwa_chupa ' || coalesce(d.cost_per_piece, 0)
       || '|COGS ' || coalesce(d.total_cost, 0) || '|imefutwa ' || coalesce(sa.is_deleted, false)
  FROM sales_details d JOIN sales sa ON sa.uid = d.sale_uid, t0
 WHERE d.product_uid = :'P' AND sa.created_at >= t0.t AND NOT coalesce(d.is_deleted, false)
 ORDER BY sa.sale_date;
-- Hesabu: A na B.
WITH t0 AS (SELECT min(s.movement_date) AS t FROM store s JOIN purchases pr ON s.reference = 'PUR-' || pr.uid
             WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false)),
     nanga AS (SELECT pr.total_amount, pr.pieces_per_package_at_purchase AS chupa FROM purchases pr
                WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false) LIMIT 1),
     manunuzi AS (SELECT coalesce(sum(pr.total_amount), 0) AS v FROM purchases pr, t0
                   WHERE pr.product_uid = :'P' AND pr.created_at >= t0.t - interval '1 minute' AND NOT coalesce(pr.is_deleted, false)
                     AND coalesce(pr.status, '') = 'RECEIVED'),
     marekebisho AS (SELECT coalesce(sum(a.adjustment_value), 0) AS v FROM stock_adjustment a, t0
                      WHERE a.product_uid = :'P' AND a.approved_at >= t0.t AND NOT coalesce(a.is_deleted, false) AND coalesce(a.gl_posted, false)),
     mauzo AS (SELECT coalesce(sum(d.total_cost), 0) AS v, coalesce(sum(d.piece_quantity), 0) AS chupa FROM sales_details d JOIN sales sa ON sa.uid = d.sale_uid, t0
                WHERE d.product_uid = :'P' AND sa.created_at >= t0.t AND NOT coalesce(d.is_deleted, false) AND NOT coalesce(sa.is_deleted, false)),
     p AS (SELECT coalesce(current_stock, 0) AS chupa, coalesce(current_average_cost, 0) AS gharama FROM products WHERE uid = :'P'),
     g AS (SELECT round(nanga.total_amount / nullif(nanga.chupa, 0), 2) AS sahihi FROM nanga)
SELECT 'J63_HESABU|manunuzi ' || manunuzi.v || '|marekebisho ' || marekebisho.v || '|COGS ' || mauzo.v || '|chupa_zilizouzwa ' || mauzo.chupa
       || '|kwenye_1200 ' || (manunuzi.v + marekebisho.v - mauzo.v) || '|chupa_zilizopo ' || p.chupa || '|gharama_ya_sasa ' || p.gharama
       || '|gharama_sahihi ' || coalesce(g.sahihi, 0) || '|thamani_sahihi ' || round(p.chupa * coalesce(g.sahihi, 0), 2)
       || '|A ' || round(manunuzi.v + marekebisho.v - mauzo.v - p.chupa * coalesce(g.sahihi, 0), 2)
       || '|B ' || round(p.chupa * (p.gharama - coalesce(g.sahihi, 0)), 2)
  FROM manunuzi, marekebisho, mauzo, p, g;
-- Journal za GL za nanga na marekebisho zipo (Dr 1200)?
WITH t0 AS (SELECT min(s.movement_date) AS t FROM store s JOIN purchases pr ON s.reference = 'PUR-' || pr.uid
             WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false))
SELECT 'J63_GL|marekebisho_1200 ' || coalesce((SELECT sum(l.debit_amount - l.credit_amount) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
                                                WHERE NOT coalesce(j.is_deleted, false) AND l.account_code = '1200'
                                                  AND j.reference_uid IN (SELECT a.gl_reference_uid FROM stock_adjustment a, t0 WHERE a.product_uid = :'P' AND a.approved_at >= t0.t)), 0)
       || '|manunuzi_1200 ' || coalesce((SELECT sum(l.debit_amount - l.credit_amount) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
                                         WHERE NOT coalesce(j.is_deleted, false) AND l.account_code = '1200'
                                           AND j.reference_uid IN (SELECT pr.uid FROM purchases pr WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11')), 0)
  FROM t0;
-- (bp) Oktoba OPEN: J1 31/10 = ziada ya 1200 mwisho wa 31/10 (kutoka data ya hadi 31/10), J2 01/11 = COGS ya ziada ya mauzo
-- ya Jagger kuanzia 01/11 (chupa x (gharama iliyotumika - gharama sahihi)). Ukaguzi: J1 - J2 = A.
WITH t0 AS (SELECT min(s.movement_date) AS t FROM store s JOIN purchases pr ON s.reference = 'PUR-' || pr.uid
             WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false)),
     nanga AS (SELECT pr.total_amount, pr.pieces_per_package_at_purchase AS chupa FROM purchases pr
                WHERE pr.product_uid = :'P' AND pr.purchase_date::date = DATE '2026-10-11' AND NOT coalesce(pr.is_deleted, false) LIMIT 1),
     g AS (SELECT round(nanga.total_amount / nullif(nanga.chupa, 0), 2) AS sahihi FROM nanga),
     manunuzi AS (SELECT coalesce(sum(pr.total_amount), 0) AS v FROM purchases pr, t0
                   WHERE pr.product_uid = :'P' AND pr.created_at >= t0.t - interval '1 minute' AND pr.created_at < TIMESTAMP '2026-11-01'
                     AND NOT coalesce(pr.is_deleted, false) AND coalesce(pr.status, '') = 'RECEIVED'),
     marekebisho AS (SELECT coalesce(sum(a.adjustment_value), 0) AS v FROM stock_adjustment a, t0
                      WHERE a.product_uid = :'P' AND a.approved_at >= t0.t AND a.approved_at < TIMESTAMP '2026-11-01'
                        AND NOT coalesce(a.is_deleted, false) AND coalesce(a.gl_posted, false)),
     okt AS (SELECT coalesce(sum(d.total_cost), 0) AS v FROM sales_details d JOIN sales sa ON sa.uid = d.sale_uid, t0
              WHERE d.product_uid = :'P' AND sa.created_at >= t0.t AND sa.sale_date < TIMESTAMP '2026-11-01'
                AND NOT coalesce(d.is_deleted, false) AND NOT coalesce(sa.is_deleted, false)),
     nov AS (SELECT coalesce(sum(d.piece_quantity), 0) AS chupa, coalesce(sum(d.total_cost - d.piece_quantity * g.sahihi), 0) AS ziada
               FROM sales_details d JOIN sales sa ON sa.uid = d.sale_uid, t0, g
              WHERE d.product_uid = :'P' AND sa.sale_date >= TIMESTAMP '2026-11-01'
                AND NOT coalesce(d.is_deleted, false) AND NOT coalesce(sa.is_deleted, false)),
     c3110 AS (SELECT coalesce((SELECT s.stock_after FROM store s WHERE s.products_uid = :'P' AND s.movement_date < TIMESTAMP '2026-11-01'
                                   AND NOT coalesce(s.is_deleted, false) ORDER BY s.movement_date DESC, s.id DESC LIMIT 1), 0) AS chupa)
SELECT 'J63_HESABU2|kwenye_1200_3110 ' || (manunuzi.v + marekebisho.v - okt.v) || '|chupa_3110 ' || c3110.chupa
       || '|J1 ' || round(manunuzi.v + marekebisho.v - okt.v - c3110.chupa * g.sahihi, 2)
       || '|chupa_nov ' || nov.chupa || '|J2 ' || round(nov.ziada, 2)
  FROM manunuzi, marekebisho, okt, nov, c3110, g;
-- Journal za marekebisho haya zilizokwisha andikwa, kila moja peke yake (kinga ya kurudia na kuendelea).
SELECT 'J63_JOURNAL_IPO|' || k.ufunguo || '|' || count(j.uid) || '|' || coalesce(string_agg(j.entry_number || ' ' || j.entry_date || ' ' || j.total_debit, ', '), '-')
  FROM (VALUES ('MOJA', 'Marekebisho ya Oktoba: Jagger carton kama chupa (11/10)'),
               ('J1', 'J1 31/10: Jagger carton kama chupa (11/10) - ziada ya 1200'),
               ('J2', 'J2 01/11: Jagger carton kama chupa (11/10) - COGS ya ziada Nov')) k(ufunguo, memo)
  LEFT JOIN journal_entry j ON j.reference_type = 'MANUAL_ADJUSTMENT' AND j.reference_number = k.memo
       AND NOT coalesce(j.is_deleted, false) AND NOT coalesce(j.is_reversal, false)
 GROUP BY k.ufunguo ORDER BY k.ufunguo;
SELECT 'J63_TB|' || coalesce(sum(l.debit_amount - l.credit_amount), 0)
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid WHERE NOT coalesce(j.is_deleted, false);
SELECT 'J63_KAGUA_IMEKAMILIKA';
