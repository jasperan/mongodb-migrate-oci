-- Relational views over the migrated JSON collections.
-- Run as MERN26 (saved SQLcl connection: mig26-app).
--
-- Plain relational views that let SQL tools and BI tools query the migrated
-- collections as ordinary tables. Nothing is copied: each view reads the
-- JSON collection table directly, using Oracle simple dot notation with item
-- methods, for example
--
--   p.data.price.number()      p.data.name.string()      p.data."_id".string()
--
-- `alias.data.<field>` addresses a top-level field of the document and
-- `.string()` / `.number()` converts it to a SQL value. ObjectId values
-- (`_id` and the reference fields) come back as the same 24-character hex
-- strings the MongoDB API shows, booleans as 'true' / 'false', and dates as
-- ISO 8601 strings. A field that is missing from a document is NULL.
--
-- Part 1 creates one view per collection (brands_v, categories_v, products_v,
-- users_v, orders_v, reviews_v): one column per top-level field, plus
-- `rawjson`, the whole document, for fields that are not listed. users_v has
-- no rawjson on purpose: the user document holds the password hash.
-- Part 2 builds the reporting views on top of them with ordinary SQL joins.
-- Where an array has to be unnested (a category's `products`, a cart's
-- `products`) the views use json_table.
--
-- Views and materialized views do not count against the Autonomous JSON
-- Database non-JSON storage limit. The script can be re-run.

set echo on

-- Part 1: one simple view per collection

create or replace view brands_v as
select b.data."_id".string()        as brand_id,
       b.data.name.string()         as name,
       b.data.slug.string()         as slug,
       b.data.description.string()  as description,
       b.data.isActive.string()     as is_active,
       b.data.created.string()      as created,
       b.data                       as rawjson
  from brands b;

create or replace view categories_v as
select c.data."_id".string()        as category_id,
       c.data.name.string()         as name,
       c.data.slug.string()         as slug,
       c.data.description.string()  as description,
       c.data.isActive.string()     as is_active,
       c.data.created.string()      as created,
       c.data                       as rawjson
  from categories c;

create or replace view products_v as
select p.data."_id".string()        as product_id,
       p.data.sku.string()          as sku,
       p.data.name.string()         as name,
       p.data.slug.string()         as slug,
       p.data.description.string()  as description,
       p.data.price.number()        as price,
       p.data.quantity.number()     as quantity,
       p.data.taxable.string()      as taxable,
       p.data.isActive.string()     as is_active,
       p.data.brand.string()        as brand_id,
       p.data.created.string()      as created,
       p.data                       as rawjson
  from products p;

-- no rawjson: the user document contains the password hash
create or replace view users_v as
select u.data."_id".string()        as user_id,
       u.data.email.string()        as email,
       u.data.firstName.string()    as first_name,
       u.data.lastName.string()     as last_name,
       u.data.role.string()         as role,
       u.data.provider.string()     as provider,
       u.data.created.string()      as created
  from users u;

create or replace view orders_v as
select o.data."_id".string()        as order_id,
       o.data.cart.string()         as cart_id,
       o.data."user".string()       as user_id,
       o.data.total.number()        as total,
       o.data.created.string()      as created,
       o.data                       as rawjson
  from orders o;

create or replace view reviews_v as
select r.data."_id".string()        as review_id,
       r.data.product.string()      as product_id,
       r.data."user".string()       as user_id,
       r.data.title.string()        as title,
       r.data.rating.number()       as rating,
       r.data.review.string()       as review,
       r.data.isRecommended.string() as is_recommended,
       r.data.status.string()       as status,
       r.data.created.string()      as created,
       r.data                       as rawjson
  from reviews r;

-- Part 2: reporting views built on the simple views

create or replace view product_catalog as
select p.product_id,
       p.sku,
       p.name,
       p.description,
       p.price,
       p.quantity,
       p.taxable,
       p.is_active,
       p.slug,
       p.brand_id                                    as brand_ref,
       b.name                                        as brand_name,
       b.slug                                        as brand_slug,
       -- a category document lists its product ids in `products`; the product holds no category field
       (select c.name
          from categories_v c,
               json_table(c.rawjson, '$.products[*]' columns (pid varchar2(40) path '$')) jt
         where jt.pid = p.product_id
         fetch first 1 row only)                     as category_name
  from products_v p
  left join brands_v b
    on p.brand_id = b.brand_id;

create or replace view active_products_over_50 as
select product_id, sku, name, price, quantity, brand_name, slug
  from product_catalog
 where is_active = 'true' and price > 50;

create or replace view active_nontaxable_products as
select product_id, sku, name, price, quantity, brand_name, slug
  from product_catalog
 where is_active = 'true' and taxable = 'false';

create or replace view product_review_stats as
select r.product_id                                  as product_ref,
       count(*)                                      as review_count,
       round(avg(r.rating), 2)                       as average_rating
  from reviews_v r
 group by r.product_id;

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
select o.order_id,
       u.first_name || ' ' || u.last_name            as customer,
       u.email                                       as customer_email,
       o.total                                       as order_total,
       (select sum(nvl(i.unit_price, 0) * nvl(i.quantity, 0))
          from carts c,
               json_table(c.data, '$.products[*]'
                          columns (unit_price number       path '$.purchasePrice',
                                   quantity   number       path '$.quantity',
                                   status     varchar2(32) path '$.status')) i
         where c.data."_id".string() = o.cart_id
           and nvl(i.status, 'x') <> 'Cancelled')    as order_subtotal,
       (select sum(nvl(i.total_tax, 0))
          from carts c,
               json_table(c.data, '$.products[*]'
                          columns (total_tax number       path '$.totalTax',
                                   status    varchar2(32) path '$.status')) i
         where c.data."_id".string() = o.cart_id
           and nvl(i.status, 'x') <> 'Cancelled')    as order_tax,
       (select sum(nvl(i.unit_price, 0) * nvl(i.quantity, 0) + nvl(i.total_tax, 0))
          from carts c,
               json_table(c.data, '$.products[*]'
                          columns (unit_price number       path '$.purchasePrice',
                                   quantity   number       path '$.quantity',
                                   total_tax  number       path '$.totalTax',
                                   status     varchar2(32) path '$.status')) i
         where c.data."_id".string() = o.cart_id
           and nvl(i.status, 'x') <> 'Cancelled')    as order_total_with_tax,
       o.created
  from orders_v o
  left join users_v u
    on o.user_id = u.user_id;

-- Document-shaped view: the same catalog data exposed as read-only JSON
-- documents (Oracle AI Database 26ai JSON collection view). Document clients
-- can read this through the MongoDB API like any collection, but the join and
-- the rating aggregation are done once, in the database.
drop view if exists products_enriched;

create json collection view products_enriched as
select json_object(
         '_id'         value p.product_id,
         'sku'         value p.sku,
         'name'        value p.name,
         'description' value p.description,
         'price'       value p.price,
         'quantity'    value p.quantity,
         'slug'        value p.slug,
         'isActive'    value cast(p.is_active as boolean),
         'taxable'     value cast(p.taxable as boolean),
         'brand'       value json_object(
                                 'name' value b.name,
                                 'slug' value b.slug),
         'rating'      value json_object(
                                 'average' value nvl(rs.average_rating, 0),
                                 'count'   value nvl(rs.review_count, 0))
         returning json) as data
  from products_v p
  left join brands_v b
    on p.brand_id = b.brand_id
  left join product_review_stats rs
    on rs.product_ref = p.product_id;

select object_name, object_type from user_objects
 where object_name in ('BRANDS_V','CATEGORIES_V','PRODUCTS_V','USERS_V','ORDERS_V','REVIEWS_V',
                       'PRODUCT_CATALOG','ACTIVE_PRODUCTS_OVER_50','ACTIVE_NONTAXABLE_PRODUCTS',
                       'PRODUCT_REVIEW_STATS','ORDER_SUMMARY','PRODUCTS_ENRICHED')
 order by object_name;

select collection_name, collection_type from user_json_collections order by collection_name;
