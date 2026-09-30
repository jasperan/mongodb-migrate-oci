-- Relational views over the migrated JSON collections.
-- Run as MERN26 (saved SQLcl connection: mig26-app).
--
-- These are the "relational views for structural analysis" that make the
-- non-relational store queryable by SQL/BI tools without copying data.
-- Views and materialized views do not count against the Autonomous JSON
-- Database non-JSON storage limit.

set echo on

create or replace view product_catalog as
select json_value(p.data, '$._id')                    as product_id,
       json_value(p.data, '$.sku')                    as sku,
       json_value(p.data, '$.name')                   as name,
       json_value(p.data, '$.description')            as description,
       json_value(p.data, '$.price'    returning number) as price,
       json_value(p.data, '$.quantity' returning number) as quantity,
       json_value(p.data, '$.taxable'  returning varchar2(5)) as taxable,
       json_value(p.data, '$.isActive' returning varchar2(5)) as is_active,
       json_value(p.data, '$.slug')                   as slug,
       json_value(p.data, '$.brand')                  as brand_ref,
       json_value(b.data, '$.name')                   as brand_name,
       json_value(b.data, '$.slug')                   as brand_slug
  from products p
  left join brands b
    on json_value(p.data, '$.brand') = json_value(b.data, '$._id');

create or replace view active_products_over_50 as
select product_id, sku, name, price, quantity, brand_name, slug
  from product_catalog
 where is_active = 'true' and price > 50;

create or replace view active_nontaxable_products as
select product_id, sku, name, price, quantity, brand_name, slug
  from product_catalog
 where is_active = 'true' and taxable = 'false';

create or replace view product_review_stats as
select json_value(r.data, '$.product')                       as product_ref,
       count(*)                                              as review_count,
       round(avg(json_value(r.data, '$.rating' returning number)), 2) as average_rating
  from reviews r
 group by json_value(r.data, '$.product');

-- Business view: orders joined to customers, with the tax and totals the order actually carries.
-- The order document stores only the checkout total (`{_id, cart, user, total, created, __v}`);
-- the money lives on the cart's line items, which is exactly where the application reads it back
-- from (utils/store.js -> caculateTaxAmount): line price = purchasePrice * quantity,
-- priceWithTax = line price + totalTax. The view sums the same lines, so `order_subtotal` /
-- `order_tax` / `order_total_with_tax` match what GET /api/order/:id reports. Cancelled lines are
-- excluded; an order whose cart is already gone (cancelled orders delete the cart) reports NULL
-- for the derived columns rather than a made-up zero. `order_total` stays the migrated document
-- field, as sent by the client at checkout.
create or replace view order_summary as
select json_value(o.data, '$._id')                                as order_id,
       json_value(u.data, '$.firstName') || ' ' || json_value(u.data, '$.lastName') as customer,
       json_value(u.data, '$.email')                              as customer_email,
       json_value(o.data, '$.total'    returning number)          as order_total,
       (select sum(nvl(i.unit_price, 0) * nvl(i.quantity, 0))
          from carts c,
               json_table(c.data, '$.products[*]'
                          columns (unit_price number       path '$.purchasePrice',
                                   quantity   number       path '$.quantity',
                                   status     varchar2(32) path '$.status')) i
         where json_value(c.data, '$._id') = json_value(o.data, '$.cart')
           and nvl(i.status, 'x') <> 'Cancelled')                 as order_subtotal,
       (select sum(nvl(i.total_tax, 0))
          from carts c,
               json_table(c.data, '$.products[*]'
                          columns (total_tax number       path '$.totalTax',
                                   status    varchar2(32) path '$.status')) i
         where json_value(c.data, '$._id') = json_value(o.data, '$.cart')
           and nvl(i.status, 'x') <> 'Cancelled')                 as order_tax,
       (select sum(nvl(i.unit_price, 0) * nvl(i.quantity, 0) + nvl(i.total_tax, 0))
          from carts c,
               json_table(c.data, '$.products[*]'
                          columns (unit_price number       path '$.purchasePrice',
                                   quantity   number       path '$.quantity',
                                   total_tax  number       path '$.totalTax',
                                   status     varchar2(32) path '$.status')) i
         where json_value(c.data, '$._id') = json_value(o.data, '$.cart')
           and nvl(i.status, 'x') <> 'Cancelled')                 as order_total_with_tax,
       json_value(o.data, '$.created')                            as created
  from orders o
  left join users u
    on json_value(o.data, '$.user') = json_value(u.data, '$._id');

-- Document-shaped view: the same catalog data exposed as read-only JSON
-- documents (Oracle AI Database 26ai JSON collection view). Document clients
-- can read this through the MongoDB API like any collection, but the join and
-- the rating aggregation are done once, in the database.
drop view if exists products_enriched;

create json collection view products_enriched as
select json_object(
         '_id'         value json_value(p.data, '$._id'),
         'sku'         value json_value(p.data, '$.sku'),
         'name'        value json_value(p.data, '$.name'),
         'description' value json_value(p.data, '$.description'),
         'price'       value json_value(p.data, '$.price' returning number),
         'quantity'    value json_value(p.data, '$.quantity' returning number),
         'slug'        value json_value(p.data, '$.slug'),
         'isActive'    value json_value(p.data, '$.isActive' returning boolean),
         'taxable'     value json_value(p.data, '$.taxable' returning boolean),
         'brand'       value json_object(
                                 'name' value json_value(b.data, '$.name'),
                                 'slug' value json_value(b.data, '$.slug')),
         'rating'      value json_object(
                                 'average' value nvl(rs.average_rating, 0),
                                 'count'   value nvl(rs.review_count, 0))
         returning json) as data
  from products p
  left join brands b
    on json_value(p.data, '$.brand') = json_value(b.data, '$._id')
  left join product_review_stats rs
    on rs.product_ref = json_value(p.data, '$._id');

select object_name, object_type from user_objects
 where object_name in ('PRODUCT_CATALOG','ACTIVE_PRODUCTS_OVER_50','ACTIVE_NONTAXABLE_PRODUCTS','PRODUCT_REVIEW_STATS','ORDER_SUMMARY','PRODUCTS_ENRICHED')
 order by object_name;

select collection_name, collection_type from user_json_collections order by collection_name;
