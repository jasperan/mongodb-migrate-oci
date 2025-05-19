-- this query was created to automatically monitor those products
-- that are over $50 and are active
CREATE OR REPLACE VIEW ECOMMERCE.active_products_over_50 AS
SELECT
  p.data.sku AS sku,
  p.data.price AS price,
  p.data.isActive AS is_active,
  p.data.description AS description,
  p.data.taxable AS taxable,
  p.data.created AS created,
  p.data."__v" AS version,
  p.data.quantity AS quantity,
  p.data.slug AS slug,
  p.data.name AS name,
  p.data.brand AS brand
FROM ECOMMERCE."products" p
WHERE p.data.price > 50;

-- also filter in taxable products
CREATE OR REPLACE VIEW ECOMMERCE.active_nontaxable_products AS
SELECT
  p.data.sku AS sku,
  p.data.price AS price,
  p.data.isActive AS is_active,
  p.data.description AS description,
  p.data.taxable AS taxable,
  p.data.created AS created,
  p.data."__v" AS version,
  p.data.quantity AS quantity,
  p.data.slug AS slug,
  p.data.name AS name,
  p.data.brand AS brand
FROM ECOMMERCE."products" p
  WHERE p.data.taxable = false;