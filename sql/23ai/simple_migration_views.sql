-- this query was created to automatically monitor those products
-- that are over $50 and are active
CREATE OR REPLACE VIEW ECOMMERCEDV.active_products_over_50 AS
SELECT
  jt.sku,
  jt.price,
  jt.isActive AS is_active,
  jt.description,
  jt.taxable,
  jt.created,
  jt."__v" AS version,
  jt.quantity,
  jt.slug,
  jt.name,
  jt.brand
FROM ECOMMERCE."products" p,
     JSON_TABLE(p.data, '$' COLUMNS (
       sku VARCHAR2(100) PATH '$.sku',
       price NUMBER PATH '$.price',
       isActive BOOLEAN PATH '$.isActive',
       description VARCHAR2(4000) PATH '$.description',
       taxable BOOLEAN PATH '$.taxable',
       created VARCHAR2(50) PATH '$.created',
       "__v" NUMBER PATH '$."__v"',
       quantity NUMBER PATH '$.quantity',
       slug VARCHAR2(200) PATH '$.slug',
       name VARCHAR2(200) PATH '$.name',
       brand VARCHAR2(100) PATH '$.brand'
     )) jt
WHERE jt.price > 50;

-- also filter in taxable products
CREATE OR REPLACE VIEW ECOMMERCEDV.active_nontaxable_products AS
SELECT
  jt.sku,
  jt.price,
  jt.isActive AS is_active,
  jt.description,
  jt.taxable,
  jt.created,
  jt."__v" AS version,
  jt.quantity,
  jt.slug,
  jt.name,
  jt.brand
FROM ECOMMERCE."products" p,
     JSON_TABLE(p.data, '$' COLUMNS (
       sku VARCHAR2(100) PATH '$.sku',
       price NUMBER PATH '$.price',
       isActive BOOLEAN PATH '$.isActive',
       description VARCHAR2(4000) PATH '$.description',
       taxable BOOLEAN PATH '$.taxable',
       created VARCHAR2(50) PATH '$.created',
       "__v" NUMBER PATH '$."__v"',
       quantity NUMBER PATH '$.quantity',
       slug VARCHAR2(200) PATH '$.slug',
       name VARCHAR2(200) PATH '$.name',
       brand VARCHAR2(100) PATH '$.brand'
     )) jt
WHERE jt.taxable = false;