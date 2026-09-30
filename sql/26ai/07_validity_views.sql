-- JSON validity views over the migrated collections (Oracle AI Database 26ai).
-- Run as MERN26 (saved SQLcl connection: mig26-app).
--
-- A JSON schema is inferred from each collection's duality view
-- (DBMS_JSON_SCHEMA.DESCRIBE), stored in JSON_SCHEMAS, and every document is
-- validated against it with DBMS_JSON_SCHEMA.IS_VALID. That gives SQL visibility
-- into structural drift of the schemaless store, document by document, without
-- changing the documents themselves.

set echo on
set serveroutput on size unlimited

begin
  execute immediate 'create table json_schemas (
                       collection_name varchar2(128) primary key,
                       inferred_at     timestamp default systimestamp,
                       schema_json     json)';
exception
  when others then
    if sqlcode != -955 then raise; end if;
end;
/

declare
  c_collections sys.odcivarchar2list := sys.odcivarchar2list(
    'users', 'merchants', 'brands', 'categories', 'products', 'carts',
    'cartitems', 'orders', 'reviews', 'wishlists', 'addresses', 'contacts');
  l_schema json;
begin
  delete from json_schemas;
  for i in 1 .. c_collections.count loop
    begin
      -- document schema of the duality view that mirrors this collection
      l_schema := dbms_json_schema.describe(upper(c_collections(i)) || '_DV', 'MERN26DV');
      insert into json_schemas (collection_name, schema_json)
      values (lower(c_collections(i)), l_schema);
      dbms_output.put_line('schema inferred: ' || c_collections(i)
                           || ' (' || length(json_serialize(l_schema returning clob)) || ' chars)');
    exception
      when others then
        dbms_output.put_line('schema FAILED: ' || c_collections(i) || ' -> ' || substr(sqlerrm, 1, 200));
    end;
  end loop;
  commit;
end;
/

-- One validity row per document in the collection, validated against the
-- inferred schema. DOCUMENT_VALIDITY rolls the whole store up per collection.
create or replace view users_validity as
  select json_value(u.data, '$._id') as doc_id,
         dbms_json_schema.is_valid(u.data, s.schema_json) as is_valid,
         dbms_json_schema.validate_report(json_serialize(u.data returning varchar2(32000)),
                                          json_serialize(s.schema_json returning varchar2(32000))) as report
    from users u cross join json_schemas s
   where s.collection_name = 'users';

create or replace view products_validity as
  select json_value(p.data, '$._id')   as doc_id,
         json_value(p.data, '$.name')  as name,
         dbms_json_schema.is_valid(p.data, s.schema_json) as is_valid,
         dbms_json_schema.validate_report(json_serialize(p.data returning varchar2(32000)),
                                          json_serialize(s.schema_json returning varchar2(32000))) as report
    from products p cross join json_schemas s
   where s.collection_name = 'products';

create or replace view orders_validity as
  select json_value(o.data, '$._id') as doc_id,
         dbms_json_schema.is_valid(o.data, s.schema_json) as is_valid,
         dbms_json_schema.validate_report(json_serialize(o.data returning varchar2(32000)),
                                          json_serialize(s.schema_json returning varchar2(32000))) as report
    from orders o cross join json_schemas s
   where s.collection_name = 'orders';

create or replace view carts_validity as
  select json_value(c.data, '$._id') as doc_id,
         dbms_json_schema.is_valid(c.data, s.schema_json) as is_valid,
         dbms_json_schema.validate_report(json_serialize(c.data returning varchar2(32000)),
                                          json_serialize(s.schema_json returning varchar2(32000))) as report
    from carts c cross join json_schemas s
   where s.collection_name = 'carts';

-- Store-wide rollup: how many documents are valid per collection.
create or replace view document_validity as
  select 'users' as collection_name, count(*) as documents,
         sum(case when is_valid = 1 then 1 else 0 end) as valid_documents
    from users_validity
  union all
  select 'products', count(*), sum(case when is_valid = 1 then 1 else 0 end) from products_validity
  union all
  select 'orders', count(*), sum(case when is_valid = 1 then 1 else 0 end) from orders_validity
  union all
  select 'carts', count(*), sum(case when is_valid = 1 then 1 else 0 end) from carts_validity;

select collection_name, documents, valid_documents from document_validity order by 1;

-- Documents that drifted from the inferred schema (expected to be empty right
-- after a migration; rows appear as the schemaless application evolves).
select collection_name, doc_id, report
  from (
    select 'products' collection_name, doc_id, report from products_validity where is_valid = 0
    union all
    select 'users', doc_id, report from users_validity where is_valid = 0
    union all
    select 'orders', doc_id, report from orders_validity where is_valid = 0
    union all
    select 'carts', doc_id, report from carts_validity where is_valid = 0
  );
