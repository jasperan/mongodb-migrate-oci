-- Validation step: compare MongoDB source counts with the Oracle JSON collections.
-- Run as ADMIN (saved SQLcl connection: mig26-admin); the counts come from the
-- target schema itself, so this is the SQL counterpart of mongosh counting.
--
-- Expected source counts are supplied by the migration run (see docs/26ai/migration-guide.md).

set linesize 200
set feedback off

column collection_name format a18
column oracle_count    format 999999
column mongodb_count   format 999999
column status          format a8

with expected (collection_name, mongodb_count) as (
  select 'addresses',  4 from dual union all
  select 'brands',    16 from dual union all
  select 'cartitems', 15 from dual union all
  select 'carts',      8 from dual union all
  select 'categories',13 from dual union all
  select 'contacts',   4 from dual union all
  select 'merchants',  4 from dual union all
  select 'orders',     5 from dual union all
  select 'products', 112 from dual union all
  select 'reviews',   10 from dual union all
  select 'users',      7 from dual union all
  select 'wishlists',  6 from dual
),
actual as (
  select 'addresses'  collection_name, count(*) oracle_count from mern26.addresses  union all
  select 'brands',        count(*) from mern26.brands     union all
  select 'cartitems',     count(*) from mern26.cartitems  union all
  select 'carts',         count(*) from mern26.carts      union all
  select 'categories',    count(*) from mern26.categories union all
  select 'contacts',      count(*) from mern26.contacts   union all
  select 'merchants',     count(*) from mern26.merchants  union all
  select 'orders',        count(*) from mern26.orders     union all
  select 'products',      count(*) from mern26.products   union all
  select 'reviews',       count(*) from mern26.reviews    union all
  select 'users',         count(*) from mern26.users      union all
  select 'wishlists',     count(*) from mern26.wishlists
)
select e.collection_name,
       e.mongodb_count,
       a.oracle_count,
       case when e.mongodb_count = a.oracle_count then 'MATCH' else 'MISMATCH' end status
  from expected e join actual a on a.collection_name = e.collection_name
 order by e.collection_name;

select count(*) as mismatched_collections
  from (
    select 'addresses' c, 4 n from dual union all select 'brands', 16 from dual union all
    select 'cartitems', 15 from dual union all select 'carts', 8 from dual union all
    select 'categories', 13 from dual union all select 'contacts', 4 from dual union all
    select 'merchants', 4 from dual union all select 'orders', 5 from dual union all
    select 'products', 112 from dual union all select 'reviews', 10 from dual union all
    select 'users', 7 from dual union all select 'wishlists', 6 from dual
  ) e
  left join (
    select 'addresses' c, count(*) n from mern26.addresses union all
    select 'brands', count(*) from mern26.brands union all
    select 'cartitems', count(*) from mern26.cartitems union all
    select 'carts', count(*) from mern26.carts union all
    select 'categories', count(*) from mern26.categories union all
    select 'contacts', count(*) from mern26.contacts union all
    select 'merchants', count(*) from mern26.merchants union all
    select 'orders', count(*) from mern26.orders union all
    select 'products', count(*) from mern26.products union all
    select 'reviews', count(*) from mern26.reviews union all
    select 'users', count(*) from mern26.users union all
    select 'wishlists', count(*) from mern26.wishlists
  ) a on a.c = e.c
 where a.n is null or a.n <> e.n;
