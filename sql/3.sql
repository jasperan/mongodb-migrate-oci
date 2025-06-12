-- run as ecommercedv
-- this will perform the migration from `ecommerce` to `ecommercedv`
-- output of this procedure: run script_fixed with your output but put drop tables so you
-- can run it again and again without errors
create or replace procedure print_clob_to_output (
  p_clob in clob
) is
  l_offset int := 1;
begin
  loop
    exit when l_offset > dbms_lob.getlength(p_clob);
    dbms_output.put_line(dbms_lob.substr(
      p_clob,
      255,
      l_offset
    ));
    l_offset := l_offset + 255;
  end loop;
end print_clob_to_output;
/

declare
  schema_sql clob;
begin
  for c in (
    select table_name
      from all_tables
      -- here, I take out this table present in autonomous automatically - we only want our collections.
     where owner = 'ECOMMERCE' and table_name in ('addresses', 'brands', 'carts', 'categories', 'contacts', 'merchants', 'orders', 'products', 'reviews', 'users', 'wishlists')
     order by 1
  ) loop
    begin
      schema_sql := dbms_json_duality.infer_and_generate_schema(
        json(
          '{
                        "sourceSchema": "ECOMMERCE",
                        "tableNames" : ["'
          || lower(c.table_name)
          || '"],
                        "viewNames" : ["'
          || lower(c.table_name)
        || '"],
                        "useFlexFields" : true,
                        "updatability" : true,
                        "outputFormat" : "standalone",
                        "normalize": false,
                        "softnessThreshold": 0,
                        "hints": [{"type" : "normalize", "table" : "' || c.table_name || '",  "path" : "$", "value" : false}]
                }'
        )
      );
      print_clob_to_output(schema_sql);
           -- execute immediate schema_sql;
    exception
      when others then
        dbms_output.put_line('Error raised for '
                             || c.table_name
                             || ': '
                             || dbms_utility.format_error_backtrace
                             || ' - '
                             || sqlerrm);
    end;
  end loop;
exception
  when others then
    dbms_output.put_line('Error raised: '
                         || dbms_utility.format_error_backtrace
                         || ' - '
                         || sqlerrm);
    raise;
end;
/