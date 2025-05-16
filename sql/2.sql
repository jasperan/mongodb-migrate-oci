-- run as ecommercedv
-- output of this procedure: run script_fixed with your output but put drop tables and also
-- at the end of the script, copy the last 2 lines.
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

set serveroutput on size UNLIMITED
set linesize 10000
set long 10000
spool script.sql;
declare
  schema_sql clob;
begin
  for c in (
    select table_name
      from all_tables
     where owner = 'ECOMMERCE'
     order by 1
  ) loop
    begin
      schema_sql := dbms_json_duality.infer_and_generate_schema(
        json(
          '{
                        "sourceSchema": "ECOMMERCE",
                        "tableNames" : ["'
          || c.table_name
          || '"],
                        "viewNames" : ["'
          || lower(c.table_name)
          || '"],
                        "useFlexFields" : true,
                        "updatability" : true,
                        "outputFormat" : "standalone",
                        "normalize": false
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
spool off;