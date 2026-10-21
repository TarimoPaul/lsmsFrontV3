-- HATUA 36 (STAGING, KUSOMA TU): hali ya staging kabla ya jaribio la H-2, na bidhaa + mteja wa kutumia.
BEGIN TRANSACTION READ ONLY;
SELECT 'FLYWAY_YA_MWISHO|' || version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1;
SELECT 'GL_CONFIG|posting_enabled=' || posting_enabled || '|shadow_mode=' || shadow_mode FROM gl_config LIMIT 1;
SELECT 'QA_H2_ZILIZOPO_KABLA|' || count(*) FROM sales WHERE sale_notes ~ '(^|\n)QA-H2 ';  -- dokezo la backend liko MBELE (Sales.addNote)
-- bidhaa 1: stock ya kutosha, bei ya kipande na gharama > 0
SELECT 'H2DATA|' || p.uid || '|' || replace(p.product_name, '|', '/') || '|' || p.piece_sale_price || '|' || coalesce(p.current_average_cost, 0)
       || '|' || coalesce(p.pieces_per_package, 1) || '|' || coalesce(p.current_stock, 0)
FROM products p
WHERE NOT coalesce(p.is_deleted, false) AND coalesce(p.is_active, true)
  AND p.current_stock >= 20 AND p.piece_sale_price > 0 AND coalesce(p.current_average_cost, 0) > 0
  AND p.piece_sale_price > p.current_average_cost
ORDER BY p.current_stock DESC LIMIT 1;
-- mteja 1 wa REGULAR (uid na aina tu)
SELECT 'H2CUST|' || c.uid || '|' || c.customer_type
FROM customers c WHERE NOT coalesce(c.is_deleted, false) AND c.customer_type = 'REGULAR'
ORDER BY c.created_at LIMIT 1;
ROLLBACK;
