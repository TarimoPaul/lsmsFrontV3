-- Item Measure data check — READ ONLY (one read-only transaction, SELECTs only, no temp objects).
-- Output: CSV sections separated by "### name" lines.
\set ON_ERROR_STOP on
\pset format csv
\pset tuples_only off
BEGIN TRANSACTION READ ONLY;

SELECT to_regclass('public.order_suggestion_line') IS NOT NULL AS has_order \gset
\if :has_order
  -- Class of each product = its line in the LATEST order; a forced class wins.
  \set cls '(SELECT x.product_uid, COALESCE(f.forced_class, x.order_class) AS order_class FROM (SELECT DISTINCT ON (l.product_uid) l.product_uid, l.order_class FROM order_suggestion_line l JOIN order_suggestion s ON s.uid = l.suggestion_uid ORDER BY l.product_uid, s.order_date DESC) x LEFT JOIN product_order_setting f ON f.product_uid = x.product_uid)'
\else
  \set cls '(SELECT NULL::text AS product_uid, NULL::text AS order_class WHERE false)'
\endif

\echo ### overview
SELECT current_database() AS db, now()::timestamp(0) AS at, :'has_order' AS has_order_tables,
       (SELECT count(*) FROM products WHERE is_deleted = false) AS products,
       (SELECT count(*) FROM item_measure WHERE is_deleted = false) AS measures,
       (SELECT max(sale_date)::date FROM sales) AS last_sale;

\if :has_order
\echo ### latest_order
SELECT s.order_date, s.status, l.order_class, count(*) AS lines
FROM order_suggestion s JOIN order_suggestion_line l ON l.suggestion_uid = s.uid
WHERE s.order_date = (SELECT max(order_date) FROM order_suggestion)
GROUP BY 1, 2, 3 ORDER BY 3;
\endif

\echo ### measures
SELECT im.id, im.package_type, im.unit_type, im.abbreviation, im.description,
       (SELECT count(*) FROM product_measures pm JOIN products p ON p.uid = pm.product_uid AND p.is_deleted = false
         WHERE pm.measure_uid = im.uid) AS products
FROM item_measure im WHERE im.is_deleted = false ORDER BY lower(im.package_type), lower(im.unit_type), im.id;

\echo ### qa_test_measures
SELECT im.id, im.package_type, im.unit_type, im.abbreviation, im.description, im.created_at::timestamp(0)
FROM item_measure im
WHERE im.unit_type IN ('QA2X1JML', 'QB2X1JML') OR im.unit_type ILIKE 'Q_2X1JML' OR im.description ILIKE '%E2E%' OR lower(im.abbreviation) IN ('qa', 'qb');

\echo ### no_measure
SELECT p.id, p.product_name, c.category_name AS category, p.pieces_per_package, p.current_stock, COALESCE(k.order_class, '') AS order_class
FROM products p LEFT JOIN categories c ON c.uid = p.category_uid LEFT JOIN :cls k ON k.product_uid = p.uid
WHERE p.is_deleted = false AND NOT EXISTS (SELECT 1 FROM product_measures pm JOIN item_measure im ON im.uid = pm.measure_uid AND im.is_deleted = false WHERE pm.product_uid = p.uid)
ORDER BY (k.order_class = 'A') DESC NULLS LAST, p.product_name;

\echo ### bottle_measure_with_pack
SELECT p.id, p.product_name, c.category_name AS category, im.id AS measure_id, im.package_type, im.unit_type, im.abbreviation,
       p.pieces_per_package, COALESCE(k.order_class, '') AS order_class
FROM products p JOIN product_measures pm ON pm.product_uid = p.uid JOIN item_measure im ON im.uid = pm.measure_uid AND im.is_deleted = false
LEFT JOIN categories c ON c.uid = p.category_uid LEFT JOIN :cls k ON k.product_uid = p.uid
WHERE p.is_deleted = false AND p.pieces_per_package > 1
  AND (lower(im.abbreviation) IN ('btl', 'bt') OR im.package_type ILIKE 'bot%' OR im.package_type ILIKE 'chupa%')
ORDER BY (k.order_class = 'A') DESC NULLS LAST, p.product_name;

\echo ### no_pieces_per_package
SELECT p.id, p.product_name, c.category_name AS category, p.pieces_per_package, p.current_stock,
       (SELECT string_agg(im.package_type || ' ' || im.unit_type || ' (' || im.abbreviation || ')', ' + ' ORDER BY im.id)
          FROM product_measures pm JOIN item_measure im ON im.uid = pm.measure_uid WHERE pm.product_uid = p.uid) AS measures,
       COALESCE(k.order_class, '') AS order_class
FROM products p LEFT JOIN categories c ON c.uid = p.category_uid LEFT JOIN :cls k ON k.product_uid = p.uid
WHERE p.is_deleted = false AND COALESCE(p.pieces_per_package, 0) <= 1
ORDER BY (k.order_class = 'A') DESC NULLS LAST, p.product_name;

\echo ### more_than_one_measure
SELECT p.id, p.product_name, p.pieces_per_package, im.id AS measure_id, im.package_type, im.unit_type, im.abbreviation, COALESCE(k.order_class, '') AS order_class
FROM products p JOIN product_measures pm ON pm.product_uid = p.uid JOIN item_measure im ON im.uid = pm.measure_uid AND im.is_deleted = false
LEFT JOIN :cls k ON k.product_uid = p.uid
WHERE p.is_deleted = false AND (SELECT count(*) FROM product_measures x WHERE x.product_uid = p.uid) > 1
ORDER BY p.product_name, im.id;

\echo ### size_repeated_in_name
SELECT p.id, p.product_name, im.unit_type, COALESCE(k.order_class, '') AS order_class
FROM products p JOIN product_measures pm ON pm.product_uid = p.uid JOIN item_measure im ON im.uid = pm.measure_uid AND im.is_deleted = false
LEFT JOIN :cls k ON k.product_uid = p.uid
WHERE p.is_deleted = false AND replace(lower(p.product_name), ' ', '') LIKE '%' || replace(lower(im.unit_type), ' ', '') || '%'
ORDER BY p.product_name;

\echo ### class_a_products
SELECT p.id, p.product_name, c.category_name AS category, p.pieces_per_package,
       (SELECT string_agg(im.package_type || ' ' || im.unit_type || ' (' || im.abbreviation || ')', ' + ' ORDER BY im.id)
          FROM product_measures pm JOIN item_measure im ON im.uid = pm.measure_uid WHERE pm.product_uid = p.uid) AS measures
FROM products p JOIN :cls k ON k.product_uid = p.uid AND k.order_class = 'A' LEFT JOIN categories c ON c.uid = p.category_uid
WHERE p.is_deleted = false ORDER BY p.product_name;

ROLLBACK;
