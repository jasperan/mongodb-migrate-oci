-- JSON-To-Duality converter (Oracle AI Database 26ai).
-- Infers the relational schema of every migrated collection and generates the
-- duality-view DDL; results are stored in dv_generated_ddl for review/export.
--
-- Run as MERN26 (saved SQLcl connection: mig26-app) - the converter must see the
-- source collections - with targetSchema pointed at the duality schema.
--
-- Output is "standalone" DDL: it is reviewed, then executed in the target schema
-- (see sql/26ai/generated/duality_ddl/*.sql and sql/26ai/06_import_duality_views.sql,
-- which loads the migrated documents into the views once they exist).

set echo on
set serveroutput on size unlimited

begin
  execute immediate 'create table dv_generated_ddl (
                       collection_name varchar2(128) primary key,
                       view_name       varchar2(128),
                       generated_at    timestamp default systimestamp,
                       ddl             clob)';
exception
  when others then
    if sqlcode != -955 then raise; end if;
end;
/

declare
  c_collections sys.odcivarchar2list := sys.odcivarchar2list(
    'users', 'merchants', 'brands', 'categories', 'products', 'carts',
    'cartitems', 'orders', 'reviews', 'wishlists', 'addresses', 'contacts');
  l_ddl clob;
  l_err varchar2(900);
begin
  delete from dv_generated_ddl;
  for i in 1 .. c_collections.count loop
    begin
      l_ddl := dbms_json_duality.infer_and_generate_schema(
                 json('{
                   "tableNames"    : ["' || c_collections(i) || '"],
                   "viewNames"     : ["' || c_collections(i) || '_dv"],
                   "sourceSchema"  : "MERN26",
                   "targetSchema"  : "MERN26DV",
                   "useFlexFields" : true,
                   "updatability"  : true,
                   "normalize"     : false,
                   "minFieldFrequency" : 1,
                   "minTypeFrequency"  : 1,
                   "enableUnnestedAttributes" : false,
                   "enableNestedAttributes"   : false,
                   "outputFormat"  : "standalone"
                 }'));
      insert into dv_generated_ddl (collection_name, view_name, ddl)
      values (lower(c_collections(i)), lower(c_collections(i)) || '_dv', l_ddl);
      dbms_output.put_line('generated: ' || lower(c_collections(i)) || ' -> ' ||
                           lower(c_collections(i)) || '_dv (' || dbms_lob.getlength(l_ddl) || ' bytes)');
    exception
      when others then
        l_err := substr(sqlerrm, 1, 300);
        dbms_output.put_line('FAILED: ' || c_collections(i) || ' -> ' || l_err);
        insert into dv_generated_ddl (collection_name, view_name, ddl)
        values (lower(c_collections(i)), null, '--ERROR: ' || l_err);
    end;
  end loop;
  commit;
end;
/

select collection_name, view_name, dbms_lob.getlength(ddl) as ddl_bytes,
       case when dbms_lob.substr(ddl, 8, 1) = '--ERROR:' then 'ERROR' else 'OK' end as status
  from dv_generated_ddl
 order by collection_name;
