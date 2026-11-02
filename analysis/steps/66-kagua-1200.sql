-- HATUA 66 (mmiliki 02/11 bz) - KUSOMA TU, PROD. GL 1200 dhidi ya daftari la stock (stock x current_average_cost) leo.
-- Query MOJA (snapshot moja ya transaction ya kusoma tu). Kila mstari una lebo yake (lebo|...) ili log isomeke kwa grep.
-- Mbinu:
--   * GL 1200 kwa bidhaa: kila mstari wa 1200 (journal isiyofutwa) unapewa bidhaa kutoka rejea yake:
--       purchase uid -> purchases.product_uid;  sale uid -> mistari ya sales_details (kwa uwiano wa total_cost);
--       COUNT:<stock_adjustment> -> product_uid;  STOCK:<store> -> products_uid;  capex uid -> store.capital_expenditure_uid;
--       sales_returns uid -> sales_return_items;  journal ya mkono yenye uid8 ya bidhaa moja kwenye maelezo (mf. 63 Jagger 886dc1ed).
--     Isiyopata bidhaa = "haina bidhaa" (true-up, journal za mkono, n.k.) - inaorodheshwa.
--   * Mwendo wa stock "una journal" ikiwa rejea yake ina mstari wa 1200 (PURCHASE -> purchase; SALE -> sale isiyo reversal;
--     SALE_REVERSAL -> reversal ya sale; COUNT-ADJ -> COUNT:<sa>; ADJ-* -> STOCK:<movement>; DAMAGE -> capex;
--     RETURN_TO_STOCK -> sales_returns; MAREKEBISHO-* -> journal ya mkono ya bidhaa hiyo).
--     Kiasi cha mwendo = stock_after - stock_before (si quantity: SALE/DAMAGE zina quantity chanya), thamani = kiasi x avg ya LEO.
--   * Kwa kila bidhaa: daftari - GL = mwendo bila journal + stock ya mwanzo + kiasi kisicholingana + "gharama" (mabaki:
--     avg ilibadilika bila mwendo, au journal iliandikwa kwa gharama tofauti na avg ya leo).
\pset footer off
\set ON_ERROR_STOP on
SELECT 'FLYWAY|' || max(version::int) || '|' || count(*) FILTER (WHERE NOT success) || ' zilizoshindwa'
  FROM flyway_schema_history WHERE version ~ '^[0-9]+$';
SELECT 'SAA_YA_DB|' || now()::timestamp(0) || '|' || current_setting('TimeZone') || '|read_only ' || current_setting('transaction_read_only');

WITH
p AS MATERIALIZED (
  SELECT uid, product_name nm, coalesce(is_deleted, false) del, coalesce(current_stock, 0) q,
         coalesce(current_average_cost, 0) avg, coalesce(last_purchase_cost, 0) lst
    FROM products),
jl AS MATERIALIZED (
  SELECT l.uid lu, j.uid ju, j.entry_number en, j.entry_date ed, j.reference_type rt, coalesce(j.reference_uid, '') ru,
         coalesce(j.is_reversal, false) rv, coalesce(j.status, '-') st, coalesce(j.description, '') || ' ' || coalesce(l.description, '') ds,
         coalesce(j.posted_by, '-') pb, j.posted_at pa, l.debit_amount - l.credit_amount net
    FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
   WHERE l.account_code = '1200' AND NOT coalesce(j.is_deleted, false)),
sh AS MATERIALIZED (   -- uwiano wa bidhaa ndani ya kila sale (total_cost ya mistari isiyofutwa; ikiwa 0, mistari yote; ikiwa bado 0, idadi)
  SELECT d.sale_uid su, d.product_uid pu,
         CASE WHEN sum(sum(coalesce(d.total_cost, 0)) FILTER (WHERE NOT coalesce(d.is_deleted, false))) OVER w > 0
              THEN coalesce(sum(coalesce(d.total_cost, 0)) FILTER (WHERE NOT coalesce(d.is_deleted, false)), 0)
                   / sum(sum(coalesce(d.total_cost, 0)) FILTER (WHERE NOT coalesce(d.is_deleted, false))) OVER w
              WHEN sum(sum(coalesce(d.total_cost, 0))) OVER w > 0
              THEN sum(coalesce(d.total_cost, 0)) / sum(sum(coalesce(d.total_cost, 0))) OVER w
              ELSE count(*)::numeric / sum(count(*)) OVER w END fr
    FROM sales_details d
   GROUP BY d.sale_uid, d.product_uid
  WINDOW w AS (PARTITION BY d.sale_uid)),
rsh AS MATERIALIZED (
  SELECT i.sales_return_uid ru, i.product_uid pu,
         CASE WHEN sum(sum(coalesce(i.total_amount, 0))) OVER w > 0 THEN sum(coalesce(i.total_amount, 0)) / sum(sum(coalesce(i.total_amount, 0))) OVER w
              ELSE count(*)::numeric / sum(count(*)) OVER w END fr
    FROM sales_return_items i GROUP BY 1, 2 WINDOW w AS (PARTITION BY i.sales_return_uid)),
cap AS MATERIALIZED (SELECT capital_expenditure_uid cu, min(products_uid) pu FROM store WHERE capital_expenditure_uid IS NOT NULL GROUP BY 1),
u8 AS MATERIALIZED (SELECT left(uid, 8) k, min(uid) pu FROM p GROUP BY 1 HAVING count(*) = 1),
att0 AS (
  SELECT jl.lu, 1 k, pr.product_uid pu, jl.net amt FROM jl JOIN purchases pr ON pr.uid = jl.ru
  UNION ALL SELECT jl.lu, 2, sh.pu, jl.net * sh.fr FROM jl JOIN sh ON sh.su = jl.ru
  UNION ALL SELECT jl.lu, 3, sa.product_uid, jl.net FROM jl JOIN stock_adjustment sa ON jl.ru = 'COUNT:' || sa.uid
  UNION ALL SELECT jl.lu, 4, m.products_uid, jl.net FROM jl JOIN store m ON jl.ru = 'STOCK:' || m.uid
  UNION ALL SELECT jl.lu, 5, cap.pu, jl.net FROM jl JOIN cap ON cap.cu = jl.ru
  UNION ALL SELECT jl.lu, 6, rsh.pu, jl.net * rsh.fr FROM jl JOIN rsh ON rsh.ru = jl.ru),
att1 AS MATERIALIZED (
  SELECT * FROM att0
  UNION ALL   -- journal ya mkono: uid8 ya bidhaa MOJA tu ndani ya maelezo, na haijapewa bidhaa kwa njia nyingine
  SELECT jl.lu, 7, min(u8.pu), min(jl.net) FROM jl JOIN u8 ON jl.ds LIKE '%' || u8.k || '%'
   WHERE NOT EXISTS (SELECT 1 FROM att0 WHERE att0.lu = jl.lu)
   GROUP BY jl.lu HAVING count(DISTINCT u8.pu) = 1),
kk AS MATERIALIZED (SELECT lu, min(k) k, count(DISTINCT k) n FROM att1 GROUP BY lu),
att AS MATERIALIZED (SELECT a.* FROM att1 a JOIN kk ON kk.lu = a.lu AND kk.k = a.k),
glp AS MATERIALIZED (SELECT pu, sum(amt) gl FROM att GROUP BY pu),
una AS MATERIALIZED (SELECT jl.* FROM jl WHERE NOT EXISTS (SELECT 1 FROM kk WHERE kk.lu = jl.lu)),
jref AS MATERIALIZED (SELECT ru, bool_or(NOT rv) n, bool_or(rv) r FROM jl GROUP BY ru),
mj AS MATERIALIZED (SELECT DISTINCT pu FROM att WHERE k = 7),
tu AS MATERIALIZED (SELECT max(pa) t, count(DISTINCT ju) n, sum(net) v FROM jl WHERE ru LIKE 'TRUEUP:INVENTORY%'),
sr AS MATERIALIZED (SELECT receipt_number rc, uid FROM sales WHERE receipt_number IS NOT NULL),
mv00 AS MATERIALIZED (
  SELECT m.uid, m.id, m.products_uid pu, m.movement_type t, m.movement_date md, coalesce(m.reference, '') rf,
         coalesce(m.stock_after - m.stock_before, m.quantity) d, m.stock_before sb, m.capital_expenditure_uid cu,
         CASE WHEN m.movement_type = 'PURCHASE' THEN substring(m.reference FROM '^PUR(?:CHASE)?-(.+)$') END pur,
         CASE WHEN m.movement_type = 'SALE' THEN substring(m.reference FROM '^SALE-(.+)$') END rcp,
         CASE WHEN m.movement_type = 'SALE_REVERSAL' THEN substring(m.reference FROM '^SALE_REV-(.+)-[0-9]{14}$') END rrcp,
         m.stock_after sa, m.created_at ca
    FROM store m WHERE NOT coalesce(m.is_deleted, false)),
mv0 AS MATERIALIZED (SELECT mv00.*, sr.uid su FROM mv00 LEFT JOIN sr ON sr.rc = coalesce(mv00.rcp, mv00.rrcp)),
-- mauzo hupimwa kwa SALE nzima (sale + reversal zake): sale iliyofutwa yenye mwendo net 0 na journal net 0 haina athari.
sgl AS MATERIALIZED (SELECT ru su, sum(net) gl FROM jl GROUP BY ru),
sgq AS MATERIALIZED (SELECT su, pu, sum(d) q FROM mv0 WHERE su IS NOT NULL GROUP BY su, pu),
sgt AS MATERIALIZED (SELECT su, sum(q) q, count(*) FILTER (WHERE q <> 0) nbz FROM sgq GROUP BY su),
mv AS MATERIALIZED (
  SELECT mv0.*,
         CASE
           WHEN t = 'PURCHASE' THEN EXISTS (SELECT 1 FROM jref WHERE jref.ru = mv0.pur)
           WHEN t IN ('SALE', 'SALE_REVERSAL') THEN su IS NOT NULL AND (
                  EXISTS (SELECT 1 FROM sgl WHERE sgl.su = mv0.su AND abs(sgl.gl) > 0.005)
                  OR EXISTS (SELECT 1 FROM sgq WHERE sgq.su = mv0.su AND sgq.pu = mv0.pu AND sgq.q = 0))
           WHEN rf LIKE 'COUNT-ADJ-%' THEN EXISTS (SELECT 1 FROM stock_adjustment sa JOIN jref ON jref.ru = 'COUNT:' || sa.uid
                                                     WHERE sa.store_movement_uid = mv0.uid)
           WHEN rf LIKE 'MAREKEBISHO-%' THEN EXISTS (SELECT 1 FROM mj WHERE mj.pu = mv0.pu)
           WHEN t = 'DAMAGE' THEN EXISTS (SELECT 1 FROM jref WHERE jref.ru = mv0.cu)
           WHEN t = 'RETURN_TO_STOCK' THEN EXISTS (SELECT 1 FROM sales_returns r JOIN jref ON jref.ru = r.uid
                                                    WHERE mv0.rf = 'RETURN-' || r.return_reference)
           ELSE EXISTS (SELECT 1 FROM jref WHERE jref.ru = 'STOCK:' || mv0.uid)
         END hj,
         CASE WHEN rf LIKE 'COUNT-ADJ-%' THEN 'ADJUSTMENT/COUNT-ADJ' WHEN rf LIKE 'ADJ-RESET-%' THEN 'ADJUSTMENT/ADJ-RESET'
              WHEN rf LIKE 'ADJ-%' THEN 'ADJUSTMENT/ADJ' WHEN rf LIKE 'MAREKEBISHO-%' THEN 'ADJUSTMENT/MAREKEBISHO'
              WHEN t = 'ADJUSTMENT' THEN 'ADJUSTMENT/NYINGINE' ELSE t END aina
    FROM mv0),
-- mnyororo wa stock kwa mpangilio wa kuandikwa (id): mwanzo, mwisho, na mapengo (stock_before <> stock_after ya mwendo uliotangulia)
fst AS MATERIALIZED (SELECT DISTINCT ON (pu) pu, coalesce(sb, 0) sb, md FROM mv ORDER BY pu, id),
lsa AS MATERIALIZED (SELECT DISTINCT ON (pu) pu, sa FROM mv ORDER BY pu, id DESC),
gap AS MATERIALIZED (SELECT pu, sum(g) FILTER (WHERE g <> 0) gq, count(*) FILTER (WHERE g <> 0) gn
                       FROM (SELECT pu, coalesce(sb, 0) - lag(coalesce(sa, 0)) OVER (PARTITION BY pu ORDER BY id) g FROM mv) z GROUP BY pu),
mvp AS MATERIALIZED (
  SELECT pu, sum(d) dq,
         sum(d) FILTER (WHERE NOT hj) nq,
         sum(d) FILTER (WHERE NOT hj AND aina = 'ADJUSTMENT/COUNT-ADJ') q_cnt,
         sum(d) FILTER (WHERE NOT hj AND aina = 'ADJUSTMENT/ADJ') q_adj,
         sum(d) FILTER (WHERE NOT hj AND aina = 'ADJUSTMENT/ADJ-RESET') q_reset,
         sum(d) FILTER (WHERE NOT hj AND t IN ('SALE', 'SALE_REVERSAL')) q_mauzo,
         sum(d) FILTER (WHERE NOT hj AND aina NOT IN ('ADJUSTMENT/COUNT-ADJ', 'ADJUSTMENT/ADJ', 'ADJUSTMENT/ADJ-RESET', 'SALE', 'SALE_REVERSAL')) q_nyingine
    FROM mv GROUP BY pu),
pp AS MATERIALIZED (   -- kila bidhaa: daftari, GL, na vipande vya tofauti
  SELECT coalesce(p.uid, g.pu) pu, coalesce(p.nm, '(bidhaa haipo: ' || left(g.pu, 8) || ')') nm, coalesce(p.del, true) del,
         coalesce(p.q, 0) q, coalesce(p.avg, 0) avg, coalesce(p.lst, 0) lst,
         CASE WHEN coalesce(p.del, true) THEN 0 ELSE coalesce(p.q, 0) * coalesce(p.avg, 0) END dft,
         coalesce(g.gl, 0) gl,
         coalesce(v.nq, 0) * coalesce(p.avg, 0) bj,
         coalesce(v.q_cnt, 0) * coalesce(p.avg, 0) bj_cnt, coalesce(v.q_adj, 0) * coalesce(p.avg, 0) bj_adj,
         coalesce(v.q_nyingine, 0) * coalesce(p.avg, 0) bj_ny,
         coalesce(v.q_reset, 0) * coalesce(p.avg, 0) bj_rs, coalesce(v.q_mauzo, 0) * coalesce(p.avg, 0) bj_ma,
         coalesce(f.sb, 0) * coalesce(p.avg, 0) mwa,
         (coalesce(p.q, 0) - coalesce(f.sb, 0) - coalesce(v.dq, 0)) * coalesce(p.avg, 0) kis,
         coalesce(p.q, 0) - coalesce(f.sb, 0) - coalesce(v.dq, 0) kis_q, coalesce(f.sb, 0) sb, coalesce(v.nq, 0) nq,
         ls.sa la, coalesce(gp.gq, 0) gq, coalesce(gp.gn, 0) gn
    FROM p FULL JOIN glp g ON g.pu = p.uid
    LEFT JOIN mvp v ON v.pu = coalesce(p.uid, g.pu) LEFT JOIN fst f ON f.pu = coalesce(p.uid, g.pu)
    LEFT JOIN lsa ls ON ls.pu = coalesce(p.uid, g.pu) LEFT JOIN gap gp ON gp.pu = coalesce(p.uid, g.pu)),
pq AS MATERIALIZED (SELECT pp.*, CASE WHEN del THEN 0 ELSE dft - gl - bj - mwa - kis END gh,
                                 CASE WHEN del THEN -gl ELSE dft - gl END tf FROM pp),
-- ripoti ya uendeshaji: DailyPnlService.stockValueAt(leo) - nakala ya SQL yake (bei ya manunuzi ya mwisho, kisha avg)
ru_s AS (SELECT receipt_number rcp, MIN(CAST(sale_date AS date)) sd FROM sales WHERE is_deleted = false AND receipt_number IS NOT NULL GROUP BY receipt_number),
ru_bal AS (SELECT m.products_uid pu, (ARRAY_AGG(m.stock_after ORDER BY m.movement_date DESC, m.id DESC))[1] q
             FROM store m WHERE m.is_deleted = false AND m.movement_date < current_date + 1 GROUP BY m.products_uid),
ru_corr AS (SELECT m.products_uid pu, SUM(CASE WHEN s.sd <= current_date AND m.movement_date >= current_date + 1 THEN -m.quantity
                                              WHEN s.sd > current_date AND m.movement_date < current_date + 1 THEN m.quantity ELSE 0 END) dq
              FROM store m JOIN ru_s s ON s.rcp = SUBSTRING(m.reference FROM '^SALE-(RCP-[0-9]+-[0-9]+-[0-9A-Za-z]+)')
             WHERE m.is_deleted = false AND m.movement_type = 'SALE' GROUP BY m.products_uid),
ru_cost AS (SELECT product_uid, (ARRAY_AGG(cost_per_piece ORDER BY purchase_date DESC, id DESC))[1] c
              FROM purchases WHERE is_deleted = false AND status IN ('RECEIVED', 'APPROVED') AND cost_per_piece > 0
               AND purchase_date < current_date + 1 GROUP BY product_uid),
ru AS (SELECT p.uid pu, (COALESCE(b.q, 0) + COALESCE(c2.dq, 0)) q, COALESCE(k.c, p.current_average_cost, 0) c, k.c IS NULL bila_manunuzi
         FROM products p LEFT JOIN ru_bal b ON b.pu = p.uid LEFT JOIN ru_corr c2 ON c2.pu = p.uid LEFT JOIN ru_cost k ON k.product_uid = p.uid
        WHERE b.pu IS NOT NULL OR c2.pu IS NOT NULL),
-- ukurasa wa Store wa V3 (/display/stock/summary): stock x wastani wa miezi 6 wa unit_price ya mwendo wa PURCHASE
-- (StoreRepository.calculateWeightedAvgCostForProducts); bidhaa bila manunuzi ndani ya miezi 6 = 0
st6 AS (SELECT m.products_uid pu, CASE WHEN sum(m.quantity) > 0 THEN sum(m.unit_price * m.quantity) / sum(m.quantity) ELSE 0 END c
          FROM store m WHERE m.movement_type = 'PURCHASE' AND m.movement_date >= now() - interval '6 months' AND m.unit_price IS NOT NULL
           AND m.quantity > 0 AND NOT m.is_deleted GROUP BY m.products_uid),
-- manunuzi
mn AS MATERIALIZED (
  SELECT pr.uid, pr.product_uid, pr.status, coalesce(pr.is_deleted, false) del, pr.purchase_date, pr.total_amount, pr.cost_per_piece,
         pr.supplier_name, (SELECT sum(jl.net) FROM jl WHERE jl.ru = pr.uid) gl,
         (SELECT sum(m.d) FROM mv m WHERE m.pur = pr.uid) sq
    FROM purchases pr),
tot AS MATERIALIZED (
  SELECT (SELECT sum(net) FROM jl) gl, (SELECT sum(net) FROM jl WHERE st = 'POSTED') gl_posted,
         (SELECT sum(dft) FROM pq) dft, (SELECT sum(gl) FROM pq) gl_att, (SELECT sum(net) FROM una) gl_una,
         (SELECT sum(bj) FROM pq WHERE NOT del) bj, (SELECT sum(mwa) FROM pq WHERE NOT del) mwa,
         (SELECT sum(kis) FROM pq WHERE NOT del) kis, (SELECT sum(gh) FROM pq WHERE NOT del) gh,
         (SELECT sum(gl) FROM pq WHERE del) gl_del),
matokeo AS (
  SELECT 10 o, 0::numeric s, 'JUMLA_GL_1200|' || t.gl || '|POSTED ' || t.gl_posted || '|mistari ' || (SELECT count(*) FROM jl)
         || '|journal ' || (SELECT count(DISTINCT ju) FROM jl) || '|mmiliki_63_alisema 4578975.35|tofauti ' || (t.gl - 4578975.35) x FROM tot t
  UNION ALL SELECT 11, 0, 'JUMLA_DAFTARI_AVG|' || round(sum(q * avg), 2) || '|bidhaa_zenye_stock ' || count(*) FILTER (WHERE q <> 0)
         || '|stock_hasi ' || count(*) FILTER (WHERE q < 0) || ' thamani ' || coalesce(round(sum(q * avg) FILTER (WHERE q < 0), 2), 0)
         || '|stock_bila_gharama ' || count(*) FILTER (WHERE q > 0 AND avg = 0) FROM p WHERE NOT del
  UNION ALL SELECT 12, 0, 'JUMLA_DAFTARI_LAST|' || round(sum(q * lst), 2) || '|tofauti_na_avg ' || round(sum(q * (lst - avg)), 2)
         || '|bidhaa_last_0_zenye_stock ' || count(*) FILTER (WHERE q > 0 AND lst = 0) FROM p WHERE NOT del
  UNION ALL SELECT 13, 0, 'JUMLA_RIPOTI_YA_UENDESHAJI|' || round(sum(q * c), 2) || '|stockValueAt(leo): stock ya store x bei ya manunuzi ya mwisho (avg ikikosekana)'
         || '|bidhaa_bila_manunuzi ' || count(*) FILTER (WHERE bila_manunuzi AND q <> 0) FROM ru
  UNION ALL SELECT 13, 1, 'JUMLA_UKURASA_WA_STORE|' || round(sum(p.q * coalesce(st6.c, 0))::numeric, 2)
         || '|stock x wastani wa miezi 6 wa bei ya PURCHASE (V3 Store "Thamani ya mzigo")|bidhaa_zenye_stock_bila_manunuzi_miezi_6 '
         || count(*) FILTER (WHERE p.q <> 0 AND st6.pu IS NULL) || ' thamani_avg ' || round(coalesce(sum(p.q * p.avg) FILTER (WHERE p.q <> 0 AND st6.pu IS NULL), 0), 2)
         FROM p LEFT JOIN st6 ON st6.pu = p.uid WHERE NOT p.del
  UNION ALL SELECT 14, 0, 'JUMLA_BIDHAA_ZILIZOFUTWA|zenye_stock ' || count(*) FILTER (WHERE q <> 0) || '|thamani_avg ' || coalesce(round(sum(q * avg), 2), 0)
         FROM p WHERE del
  UNION ALL SELECT 15, 0, 'STOCK_DHIDI_YA_STORE|bidhaa ' || count(*) || '|current_stock<>stock_after_ya_mwisho ' || count(*) FILTER (WHERE la IS NOT NULL AND la <> q)
         || '|bila_mwendo_lakini_stock ' || count(*) FILTER (WHERE la IS NULL AND q <> 0) FROM pp WHERE NOT del
  -- daraja: daftari -> GL
  UNION ALL SELECT 20, 0, 'DARAJA|1 daftari (stock x avg, bidhaa hai)|' || round(t.dft, 2) FROM tot t
  UNION ALL SELECT 21, 0, 'DARAJA|2 - mwendo wa stock bila journal (kiasi x avg ya leo)|' || round(-t.bj, 2) FROM tot t
  UNION ALL SELECT 22, 0, 'DARAJA|3 - stock ya mwanzo (stock_before ya mwendo wa kwanza)|' || round(-t.mwa, 2) FROM tot t
  UNION ALL SELECT 23, 0, 'DARAJA|4 - stock isiyoelezwa na mwendo (current_stock - mwanzo - jumla ya mwendo)|' || round(-t.kis, 2) FROM tot t
  UNION ALL SELECT 24, 0, 'DARAJA|5 - gharama (avg ya leo dhidi ya gharama zilizoandikwa)|' || round(-t.gh, 2) FROM tot t
  UNION ALL SELECT 25, 0, 'DARAJA|6 + GL ya bidhaa zilizofutwa/zisizopo|' || round(t.gl_del, 2) FROM tot t
  UNION ALL SELECT 26, 0, 'DARAJA|7 + GL isiyo na bidhaa (true-up, journal za mkono...)|' || round(t.gl_una, 2) FROM tot t
  UNION ALL SELECT 27, 0, 'DARAJA|8 = GL 1200|' || round(t.dft - t.bj - t.mwa - t.kis - t.gh + t.gl_del + t.gl_una, 2)
         || '|GL_halisi ' || t.gl || '|TOFAUTI_ISIYOELEZEKA ' || round(t.dft - t.bj - t.mwa - t.kis - t.gh + t.gl_del + t.gl_una - t.gl, 2) FROM tot t
  UNION ALL SELECT 28, 0, 'DARAJA_UPEKEE|mistari ya 1200 iliyolingana na njia >1 ' || count(*) FILTER (WHERE n > 1) || '|njia: '
         || coalesce((SELECT string_agg(k::text || '=' || c, ' ' ORDER BY k) FROM (SELECT k, count(*) c FROM kk GROUP BY k) z), '-') FROM kk
  -- GL 1200 kwa aina ya rejea
  UNION ALL SELECT 30, 0, 'GL_KWA_AINA|' || rt || '|journal ' || count(DISTINCT ju) || '|Dr ' || sum(greatest(net, 0)) || '|Cr ' || sum(greatest(-net, 0))
         || '|net ' || sum(net) || '|bila_bidhaa ' || coalesce(sum(net) FILTER (WHERE NOT EXISTS (SELECT 1 FROM kk WHERE kk.lu = jl.lu)), 0)
         || '|' || min(ed) || '..' || max(ed) FROM jl GROUP BY rt
  -- GL isiyo na bidhaa: kila journal (hadi 60)
  UNION ALL SELECT 40, -abs(net), 'GL_BILA_BIDHAA|' || en || '|' || ed || '|' || rt || '|' || left(ru, 50) || '|' || net || '|' || st
         || '|posted_by ' || pb || '|' || coalesce(pa::timestamp(0)::text, '-') || '|' || left(replace(ds, E'\n', ' '), 140)
         FROM (SELECT * FROM una ORDER BY abs(net) DESC LIMIT 60) z
  UNION ALL SELECT 41, 0, 'GL_BILA_BIDHAA_IDADI|' || count(*) || '|' || coalesce(sum(net), 0) FROM una
  -- mwendo bila journal: kwa aina, na kwa aina+mwezi
  UNION ALL SELECT 50, 0, 'MWENDO_KWA_AINA|' || aina || '|mwendo ' || count(*) || '|bila_journal ' || count(*) FILTER (WHERE NOT hj)
         || '|kiasi_bila_journal ' || coalesce(sum(d) FILTER (WHERE NOT hj), 0)
         || '|thamani_avg_leo ' || coalesce(round(sum(d * p.avg) FILTER (WHERE NOT hj), 2), 0)
         || '|' || min(md)::date || '..' || max(md)::date FROM mv LEFT JOIN p ON p.uid = mv.pu GROUP BY aina
  UNION ALL SELECT 51, 0, 'MWENDO_BILA_JOURNAL_MWEZI|' || to_char(md, 'YYYY-MM') || '|' || aina || '|' || count(*) || '|kiasi ' || sum(d)
         || '|thamani_avg_leo ' || round(sum(d * p.avg), 2) FROM mv LEFT JOIN p ON p.uid = mv.pu WHERE NOT hj GROUP BY to_char(md, 'YYYY-MM'), aina
  -- mauzo kwa sale nzima
  UNION ALL SELECT 53, 0, 'MAUZO_HALI|futwa ' || coalesce(s.is_deleted, false) || '|gl_ya_1200 ' || (abs(coalesce(g.gl, 0)) > 0.005)
         || '|mwendo_net ' || CASE WHEN t.su IS NULL THEN 'HAKUNA' WHEN t.nbz > 0 THEN '<>0' ELSE '0' END
         || '|sale ' || count(*) || '|kiasi ' || coalesce(sum(t.q), 0) || '|gl ' || round(coalesce(sum(g.gl), 0), 2)
         FROM sales s LEFT JOIN sgt t ON t.su = s.uid LEFT JOIN sgl g ON g.su = s.uid
        GROUP BY coalesce(s.is_deleted, false), abs(coalesce(g.gl, 0)) > 0.005, CASE WHEN t.su IS NULL THEN 'HAKUNA' WHEN t.nbz > 0 THEN '<>0' ELSE '0' END
  UNION ALL SELECT 54, -abs(z.v), 'MAUZO_STOCK_BILA_JOURNAL|' || z.receipt_number || '|' || z.sale_date::date || '|futwa ' || coalesce(z.is_deleted, false)
         || '|deleted_at ' || coalesce(z.deleted_at::timestamp(0)::text, '-') || '|kiasi ' || z.q || '|thamani_avg_leo ' || round(z.v, 2)
         FROM (SELECT s.receipt_number, s.sale_date, s.is_deleted, s.deleted_at, sum(q.q) q, sum(q.q * coalesce(p.avg, 0)) v
                 FROM sales s JOIN sgq q ON q.su = s.uid LEFT JOIN p ON p.uid = q.pu LEFT JOIN sgl g ON g.su = s.uid
                WHERE abs(coalesce(g.gl, 0)) <= 0.005 AND q.q <> 0
                GROUP BY 1, 2, 3, 4 ORDER BY abs(sum(q.q * coalesce(p.avg, 0))) DESC LIMIT 15) z
  UNION ALL SELECT 55, -abs(z.gl), 'MAUZO_JOURNAL_BILA_STOCK|' || z.receipt_number || '|' || z.sale_date::date || '|futwa ' || z.del
         || '|gl ' || round(z.gl, 2) || '|mwendo ' || z.mw
         FROM (SELECT s.receipt_number, s.sale_date, coalesce(s.is_deleted, false) del, g.gl, CASE WHEN t.su IS NULL THEN 'HAKUNA' ELSE 'net 0' END mw
                 FROM sales s JOIN sgl g ON g.su = s.uid LEFT JOIN sgt t ON t.su = s.uid
                WHERE abs(g.gl) > 0.005 AND coalesce(t.nbz, 0) = 0 ORDER BY abs(g.gl) DESC LIMIT 15) z
  UNION ALL SELECT 55, 1, 'MAUZO_JOURNAL_BILA_STOCK_IDADI|' || count(*) || '|gl ' || round(coalesce(sum(g.gl), 0), 2)
         FROM sales s JOIN sgl g ON g.su = s.uid LEFT JOIN sgt t ON t.su = s.uid
        WHERE abs(g.gl) > 0.005 AND coalesce(t.nbz, 0) = 0
  UNION ALL SELECT 56, 0, 'MWENDO_WA_MAUZO_BILA_SALE|' || count(*) || '|kiasi ' || coalesce(sum(d), 0)
         FROM mv WHERE t IN ('SALE', 'SALE_REVERSAL') AND su IS NULL
  -- tangu true-up ya mwisho ya 1200 (posted_at): mwendo ulioandikwa (created_at) baadaye bila journal
  UNION ALL SELECT 57, 0, 'TANGU_TRUE_UP|true_up ' || coalesce(tu.t::timestamp(0)::text, 'HAKUNA') || '|journal ' || tu.n || '|jumla ' || coalesce(tu.v, 0) FROM tu
  UNION ALL SELECT 58, 0, 'TANGU_TRUE_UP_MWENDO_BILA_JOURNAL|' || aina || '|' || count(*) || '|kiasi ' || sum(d)
         || '|thamani_avg_leo ' || round(sum(d * coalesce(p.avg, 0)), 2) || '|' || min(md)::date || '..' || max(md)::date
         FROM mv LEFT JOIN p ON p.uid = mv.pu, tu WHERE NOT hj AND mv.ca > tu.t GROUP BY aina
  UNION ALL SELECT 59, 0, 'TANGU_TRUE_UP_JUMLA|tofauti_leo(daftari-GL) ' || round(t.dft - t.gl, 2)
         || '|mwendo_bila_journal_tangu ' || coalesce((SELECT round(sum(d * coalesce(p.avg, 0)), 2) FROM mv LEFT JOIN p ON p.uid = mv.pu, tu
                                                        WHERE NOT hj AND mv.ca > tu.t), 0)
         || '|mabaki (tofauti ya 30/09 baada ya true-up + avg kubadilika + gharama tofauti) '
         || round(t.dft - t.gl - coalesce((SELECT sum(d * coalesce(p.avg, 0)) FROM mv LEFT JOIN p ON p.uid = mv.pu, tu WHERE NOT hj AND mv.ca > tu.t), 0), 2)
         FROM tot t
  -- hesabu (COUNT-ADJ) zisizoandikwa: kwa hali ya stock_adjustment
  UNION ALL SELECT 52, 0, 'COUNT_ADJ_HALI|gl_posted ' || coalesce(sa.gl_posted::text, '-') || '|' || coalesce(sa.gl_dr_account_code, '-') || '/'
         || coalesce(sa.gl_cr_account_code, '-') || '|' || coalesce(sa.reason, '-') || '|safu ' || count(*) || '|adjustment_value ' || coalesce(sum(sa.adjustment_value), 0)
         || '|mwendo_bila_journal ' || count(*) FILTER (WHERE NOT mv.hj) || '|thamani_avg_leo ' || coalesce(round(sum(mv.d * p.avg) FILTER (WHERE NOT mv.hj), 2), 0)
         FROM stock_adjustment sa LEFT JOIN mv ON mv.uid = sa.store_movement_uid LEFT JOIN p ON p.uid = sa.product_uid
        WHERE NOT coalesce(sa.is_deleted, false) GROUP BY sa.gl_posted, sa.gl_dr_account_code, sa.gl_cr_account_code, sa.reason
  -- stock ya mwanzo
  UNION ALL SELECT 60, 0, 'STOCK_YA_MWANZO|bidhaa_zenye_mwanzo<>0 ' || count(*) FILTER (WHERE sb <> 0) || '|kiasi ' || coalesce(sum(sb), 0)
         || '|thamani_avg_leo ' || round(coalesce(sum(mwa), 0), 2) || '|kiasi_kisichoelezwa_bidhaa ' || count(*) FILTER (WHERE kis_q <> 0)
         || '|thamani ' || round(coalesce(sum(kis), 0), 2)
         || '|ndani_yake: mapengo_ya_mnyororo ' || count(*) FILTER (WHERE gn > 0) || ' bidhaa, ' || coalesce(sum(gn), 0) || ' mapengo, kiasi ' || coalesce(sum(gq), 0)
         || ' thamani ' || round(coalesce(sum(gq * avg), 0), 2)
         || '; current_stock-stock_after_ya_mwisho kiasi ' || coalesce(sum(q - coalesce(la, 0)) FILTER (WHERE la IS NOT NULL), 0)
         || ' thamani ' || round(coalesce(sum((q - coalesce(la, 0)) * avg) FILTER (WHERE la IS NOT NULL), 0), 2) FROM pp WHERE NOT del
  UNION ALL SELECT 61, -abs(mwa + kis), 'STOCK_YA_MWANZO_BIDHAA|' || nm || '|' || left(pu, 8) || '|mwanzo ' || sb || '|kisichoelezwa ' || kis_q
         || '|mapengo ' || gn || ' kiasi ' || gq || '|current-mwisho ' || (q - coalesce(la, q)) || '|avg ' || avg || '|thamani ' || round(mwa + kis, 2)
         FROM (SELECT * FROM pp WHERE NOT del AND (sb <> 0 OR kis_q <> 0) ORDER BY abs(mwa + kis) DESC LIMIT 15) z
  UNION ALL SELECT 62, 0, 'TRUE_UP_1200|' || en || '|' || ed || '|' || left(ru, 60) || '|' || net || '|posted_by ' || pb || '|'
         || coalesce(pa::timestamp(0)::text, '-') FROM jl WHERE ru LIKE 'TRUEUP:%' OR rt = 'OPENING_BALANCE'
  -- manunuzi
  UNION ALL SELECT 70, 0, 'MANUNUZI_HALI|' || coalesce(status, '-') || '|futwa ' || del || '|' || count(*) || '|total_amount ' || coalesce(sum(total_amount), 0)
         || '|zenye_journal ' || count(*) FILTER (WHERE gl IS NOT NULL) || '|gl ' || coalesce(sum(gl), 0)
         || '|zenye_stock ' || count(*) FILTER (WHERE sq IS NOT NULL) || '|stock_x_gharama ' || coalesce(round(sum(sq * cost_per_piece), 2), 0)
         FROM mn GROUP BY status, del
  UNION ALL SELECT 71, -abs(coalesce(sq, 0) * coalesce(cost_per_piece, 0)), 'MANUNUZI_STOCK_BILA_JOURNAL|' || purchase_date::date || '|'
         || coalesce((SELECT nm FROM p WHERE p.uid = z.product_uid), '-') || '|' || left(z.uid, 8) || '|' || coalesce(status, '-')
         || '|futwa ' || del || '|stock ' || sq || '|gharama ' || coalesce(cost_per_piece, 0) || '|thamani ' || round(sq * coalesce(cost_per_piece, 0), 2)
         || '|' || coalesce(supplier_name, '-')
         FROM (SELECT * FROM mn WHERE sq IS NOT NULL AND sq <> 0 AND gl IS NULL ORDER BY abs(sq * coalesce(cost_per_piece, 0)) DESC LIMIT 20) z
  UNION ALL SELECT 72, 0, 'MANUNUZI_STOCK_BILA_JOURNAL_IDADI|' || count(*) || '|thamani ' || coalesce(round(sum(sq * coalesce(cost_per_piece, 0)), 2), 0)
         FROM mn WHERE sq IS NOT NULL AND sq <> 0 AND gl IS NULL
  UNION ALL SELECT 73, 0, 'MANUNUZI_JOURNAL_BILA_STOCK_IDADI|' || count(*) || '|gl ' || coalesce(sum(gl), 0)
         FROM mn WHERE gl IS NOT NULL AND gl <> 0 AND coalesce(sq, 0) = 0
  UNION ALL SELECT 74, -abs(gl), 'MANUNUZI_JOURNAL_BILA_STOCK|' || purchase_date::date || '|' || coalesce((SELECT nm FROM p WHERE p.uid = z.product_uid), '-')
         || '|' || left(z.uid, 8) || '|' || coalesce(status, '-') || '|futwa ' || del || '|gl ' || gl
         FROM (SELECT * FROM mn WHERE gl IS NOT NULL AND gl <> 0 AND coalesce(sq, 0) = 0 ORDER BY abs(gl) DESC LIMIT 15) z
  UNION ALL SELECT 75, 0, 'MANUNUZI_GL_DHIDI_YA_STOCK|zenye_vyote ' || count(*) || '|zinazotofautiana>1 ' || count(*) FILTER (WHERE abs(gl - sq * cost_per_piece) > 1)
         || '|jumla_tofauti(gl-stock_x_gharama) ' || coalesce(round(sum(gl - sq * cost_per_piece), 2), 0)
         FROM mn WHERE gl IS NOT NULL AND sq IS NOT NULL AND sq <> 0 AND cost_per_piece IS NOT NULL
  UNION ALL SELECT 76, -abs(gl - sq * cost_per_piece), 'MANUNUZI_GL_TOFAUTI|' || purchase_date::date || '|' || coalesce((SELECT nm FROM p WHERE p.uid = z.product_uid), '-')
         || '|' || left(z.uid, 8) || '|gl ' || gl || '|stock ' || sq || ' x ' || cost_per_piece || ' = ' || round(sq * cost_per_piece, 2)
         || '|total_amount ' || coalesce(total_amount, 0) || '|tofauti ' || round(gl - sq * cost_per_piece, 2)
         FROM (SELECT * FROM mn WHERE gl IS NOT NULL AND sq IS NOT NULL AND sq <> 0 AND cost_per_piece IS NOT NULL AND abs(gl - sq * cost_per_piece) > 1
                ORDER BY abs(gl - sq * cost_per_piece) DESC LIMIT 10) z
  -- bidhaa kumi kubwa kwa |daftari - GL|
  UNION ALL SELECT 80, -abs(tf), 'BIDHAA_KUBWA|' || nm || '|' || left(pu, 8) || '|futwa ' || del || '|stock ' || q || '|avg ' || avg || '|last ' || lst
         || '|daftari ' || round(dft, 2) || '|gl ' || round(gl, 2) || '|tofauti ' || round(tf, 2)
         || '|bila_journal ' || round(bj, 2) || ' (count ' || round(bj_cnt, 2) || ', adj ' || round(bj_adj, 2) || ', adj-reset ' || round(bj_rs, 2)
         || ', mauzo ' || round(bj_ma, 2) || ', nyingine ' || round(bj_ny, 2) || ')'
         || '|mwanzo ' || round(mwa, 2) || '|kisichoelezwa ' || round(kis, 2) || '|gharama ' || round(gh, 2)
         || '|last_vs_avg ' || round(q * (lst - avg), 2)
         FROM (SELECT * FROM pq ORDER BY abs(tf) DESC LIMIT 10) z
  UNION ALL SELECT 81, 0, 'BIDHAA_JUMLA|zenye_tofauti>1 ' || count(*) FILTER (WHERE abs(tf) > 1) || '|kumi_kubwa '
         || (SELECT round(sum(tf), 2) FROM (SELECT tf FROM pq ORDER BY abs(tf) DESC LIMIT 10) z) || '|zote ' || round(sum(tf), 2) FROM pq
  -- ripoti ya uendeshaji dhidi ya daftari (avg), kwa bidhaa
  UNION ALL SELECT 91, -abs(z.v), 'RIPOTI_VS_DAFTARI|' || z.nm || '|' || left(z.uid, 8) || '|stock_ya_ripoti ' || z.rq || '|current_stock ' || z.q
         || '|bei_ya_ripoti ' || round(z.c, 2) || '|avg ' || z.avg || '|ripoti-daftari ' || round(z.v, 2)
         FROM (SELECT p.nm, p.uid, coalesce(ru.q, 0) rq, p.q, coalesce(ru.c, 0) c, p.avg, coalesce(ru.q * ru.c, 0) - p.q * p.avg v
                 FROM p LEFT JOIN ru ON ru.pu = p.uid WHERE NOT p.del ORDER BY abs(coalesce(ru.q * ru.c, 0) - p.q * p.avg) DESC LIMIT 10) z
  UNION ALL SELECT 92, 0, 'RIPOTI_VS_DAFTARI_JUMLA|kwa_idadi(stock_ya_ripoti-current_stock)xavg '
         || round(sum((coalesce(ru.q, 0) - p.q) * p.avg), 2) || '|kwa_bei(bei_ya_ripoti-avg)xstock_ya_ripoti '
         || round(sum(coalesce(ru.q, 0) * (coalesce(ru.c, p.avg) - p.avg)), 2)
         FROM p LEFT JOIN ru ON ru.pu = p.uid WHERE NOT p.del
  -- average dhidi ya last cost
  UNION ALL SELECT 90, -abs(q * (lst - avg)), 'AVG_VS_LAST|' || nm || '|' || left(uid, 8) || '|stock ' || q || '|avg ' || avg || '|last ' || lst
         || '|stock_x(last-avg) ' || round(q * (lst - avg), 2)
         FROM (SELECT * FROM p WHERE NOT del AND q <> 0 AND lst > 0 ORDER BY abs(q * (lst - avg)) DESC LIMIT 10) z
)
SELECT x FROM matokeo ORDER BY o, s, x;

SELECT 'KIPINDI|' || period_year || '-' || lpad(period_month::text, 2, '0') || '|' || coalesce(status, '-')
  FROM gl_period WHERE (period_year, period_month) IN ((2026, 10), (2026, 11)) ORDER BY period_year, period_month;
SELECT 'USHAHIDI_66_SQL_UMEKAMILIKA';
