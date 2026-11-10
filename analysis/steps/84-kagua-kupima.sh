#!/usr/bin/env bash
# HATUA 84 (mmiliki 10/11 el/em) - PROD, KUSOMA TU:
#   A) maelezo ya journal ya 83 kwenye DB: je "–" (U+2013) imehifadhiwa sawa au mojibake? (output ni ASCII tu: hex)
#   B) bidhaa za kupima na wazazi wanaopendekezwa kwenye store (Konyagi / Moon Light / Golden King / Gilbeys / Camino
#      750ml; Wine dumu 5L): stock, gharama, mauzo, na yupi hayupo.
# Hakuna kuandika: kila muunganisho una default_transaction_read_only=on.
set -u
cd /home/chief/lsms-deployment || { echo "HAIPO lsms-deployment"; exit 1; }
q() { docker compose exec -T -e "SQL=$1" -e "PGOPTIONS=-c default_transaction_read_only=on" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " | " -v ON_ERROR_STOP=1 -c "$SQL"' < /dev/null; }

echo "=== A JOURNAL YA 83: mstari | herufi | bytes | hex ya herufi 3 baada ya '20/02' | ina U+2013? | ina mojibake (U+0393)?"
q "select l.account_code, length(l.description), octet_length(l.description),
          encode(substring(convert_to(l.description, 'UTF8') from position(convert_to('20/02', 'UTF8') in convert_to(l.description, 'UTF8')) + 5 for 6), 'hex'),
          (strpos(l.description, chr(8211)) > 0), (strpos(l.description, chr(915)) > 0)
   from journal_entry e join journal_entry_line l on l.journal_entry_uid = e.uid
   where e.reference_number = 'MAREKEBISHO-83-VIPIMO' order by l.account_code"
echo "   (sahihi: hex inaanza e28093 = U+2013 na 'ina U+2013' = t; mojibake ingeonyesha ce93c387c3b4 na 'mojibake' = t)"
echo "   server_encoding $(q 'show server_encoding') | client_encoding $(q 'show client_encoding')"

echo "=== B1 BIDHAA ZA KUPIMA: id | jina | aina | stock ya mfumo | gharama | mistari ya mauzo | mauzo ya mwisho"
q "select p.id, p.product_name, coalesce(c.category_name,'-'), p.current_stock, p.current_average_cost::numeric(19,0),
          (select count(*) from sales_details d where d.product_uid = p.uid),
          coalesce((select max(s.sale_date)::date::text from sales_details d join sales s on s.uid = d.sale_uid where d.product_uid = p.uid), '-')
   from products p left join categories c on c.uid = p.category_uid
   where not coalesce(p.is_deleted, false) and p.product_name ilike '%pima%' order by p.product_name"
echo "=== B2 WAZAZI WANAOWEZEKANA: id | jina | aina | vipande/katoni | bei ya kipande | bei ya katoni | gharama | stock | ununuzi wa mwisho"
q "select p.id, p.product_name, coalesce(c.category_name,'-'), coalesce(p.pieces_per_package::text,'-'), coalesce(p.piece_sale_price::numeric(19,0)::text,'-'),
          coalesce(p.whole_sale_price::numeric(19,0)::text,'-'), p.current_average_cost::numeric(19,0), p.current_stock, coalesce(p.last_purchase_date::date::text,'-')
   from products p left join categories c on c.uid = p.category_uid
   where not coalesce(p.is_deleted, false) and p.product_name not ilike '%pima%'
     and (p.product_name ilike any (array['%konyagi%','%moon%','%golden%','%gilbey%','%camino%','%wine%','%dumu%','%5l%','%5 l%','%lita%','%ltr%']))
   order by p.product_name, p.id"
echo "=== B3 HAKUNA KABISA (jina halipo nje ya bidhaa za kupima):"
for w in gilbey camino dumu; do
  echo "   $w: $(q "select count(*) from products where not coalesce(is_deleted,false) and product_name ilike '%$w%' and product_name not ilike '%pima%'")"
done
echo "=== MWISHO"
