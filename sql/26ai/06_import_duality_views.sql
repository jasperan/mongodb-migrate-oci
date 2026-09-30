-- Import the migrated documents into the duality views (Oracle AI Database 26ai).
-- Run as MERN26DV (saved SQLcl connection: mig26-dv).
--
-- IMPORT_ALL (26ai) imports several collections in one call and orders the work so
-- foreign-key relationships are satisfied; documents that cannot be imported are
-- logged instead of failing the whole run.

set echo on
set serveroutput on size unlimited

-- 1) one error log per duality view (created on the view's root table)
declare
  l_exists number;
begin
  for r in (select view_name from user_json_duality_views order by view_name) loop
    begin
      select count(*) into l_exists
        from user_tables
       where table_name = upper(r.view_name) || '_ROOT';
      if l_exists = 1 then
        begin
          dbms_errlog.create_error_log(
            dml_table_name     => upper(r.view_name) || '_ROOT',
            err_log_table_name => substr(upper(r.view_name), 1, 20) || '_ERR',
            skip_unsupported   => true);
        exception
          when others then
            if sqlcode != -955 then  -- already exists
              dbms_output.put_line('error log for ' || r.view_name || ': ' || substr(sqlerrm, 1, 200));
            end if;
        end;
      end if;
    end;
  end loop;
end;
/

-- 2) import every collection into its duality view
declare
  l_config clob := '{
    "tableNames"   : ["users", "merchants", "brands", "categories", "products", "carts",
                      "cartitems", "orders", "reviews", "wishlists", "addresses", "contacts"],
    "viewNames"    : ["USERS_DV", "MERCHANTS_DV", "BRANDS_DV", "CATEGORIES_DV", "PRODUCTS_DV", "CARTS_DV",
                      "CARTITEMS_DV", "ORDERS_DV", "REVIEWS_DV", "WISHLISTS_DV", "ADDRESSES_DV", "CONTACTS_DV"],
    "sourceSchema" : "MERN26",
    "targetSchema" : "MERN26DV",
    "errorLog"     : ["USERS_DV_ERR", "MERCHANTS_DV_ERR", "BRANDS_DV_ERR", "CATEGORIES_DV_ERR",
                      "PRODUCTS_DV_ERR", "CARTS_DV_ERR", "CARTITEMS_DV_ERR", "ORDERS_DV_ERR",
                      "REVIEWS_DV_ERR", "WISHLISTS_DV_ERR", "ADDRESSES_DV_ERR", "CONTACTS_DV_ERR"]
  }';
begin
  dbms_json_duality.import_all(json(l_config));
  dbms_output.put_line('import_all finished');
end;
/

-- 3) verification: source collection vs duality-view document counts
column collection_name format a14
column source_count    format 999999
column view_count      format 999999
column status          format a8
select 'users' collection_name, (select count(*) from mern26.users) source_count,
       (select count(*) from users_dv) view_count,
       case when (select count(*) from mern26.users) = (select count(*) from users_dv) then 'MATCH' else 'DIFF' end status
  from dual
union all select 'merchants', (select count(*) from mern26.merchants), (select count(*) from merchants_dv),
       case when (select count(*) from mern26.merchants) = (select count(*) from merchants_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'brands', (select count(*) from mern26.brands), (select count(*) from brands_dv),
       case when (select count(*) from mern26.brands) = (select count(*) from brands_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'categories', (select count(*) from mern26.categories), (select count(*) from categories_dv),
       case when (select count(*) from mern26.categories) = (select count(*) from categories_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'products', (select count(*) from mern26.products), (select count(*) from products_dv),
       case when (select count(*) from mern26.products) = (select count(*) from products_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'carts', (select count(*) from mern26.carts), (select count(*) from carts_dv),
       case when (select count(*) from mern26.carts) = (select count(*) from carts_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'cartitems', (select count(*) from mern26.cartitems), (select count(*) from cartitems_dv),
       case when (select count(*) from mern26.cartitems) = (select count(*) from cartitems_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'orders', (select count(*) from mern26.orders), (select count(*) from orders_dv),
       case when (select count(*) from mern26.orders) = (select count(*) from orders_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'reviews', (select count(*) from mern26.reviews), (select count(*) from reviews_dv),
       case when (select count(*) from mern26.reviews) = (select count(*) from reviews_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'wishlists', (select count(*) from mern26.wishlists), (select count(*) from wishlists_dv),
       case when (select count(*) from mern26.wishlists) = (select count(*) from wishlists_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'addresses', (select count(*) from mern26.addresses), (select count(*) from addresses_dv),
       case when (select count(*) from mern26.addresses) = (select count(*) from addresses_dv) then 'MATCH' else 'DIFF' end from dual
union all select 'contacts', (select count(*) from mern26.contacts), (select count(*) from contacts_dv),
       case when (select count(*) from mern26.contacts) = (select count(*) from contacts_dv) then 'MATCH' else 'DIFF' end from dual
 order by 1;
