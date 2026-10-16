-- Validation step: count the documents of every migrated collection in Oracle.
-- Run as ADMIN; the counts are read live from the MERN26 schema, so this is the SQL
-- counterpart of counting with mongosh through the MongoDB API.
--
-- Compare the COLLECTION / DOCUMENTS table with the "collections" table that
-- ASSESS_MODE=status printed on the source (Lab 4). The authoritative, document-level
-- comparison is scripts/verify_migration.py; this script contains no expected values.

set serveroutput on size unlimited
set feedback off
set linesize 120

declare
  l_count number;
  l_total number := 0;
  l_n     number := 0;
begin
  dbms_output.put_line(rpad('COLLECTION', 24) || lpad('DOCUMENTS', 10));
  dbms_output.put_line(rpad('-', 24, '-') || lpad('-', 10, '-'));
  for t in (select t.table_name
                from all_tables t
               where t.owner = 'MERN26'
                 and exists (select 1 from all_tab_columns c   -- JSON collection tables only
                              where c.owner = t.owner and c.table_name = t.table_name
                                and c.column_name = 'DATA' and c.data_type = 'JSON')
               order by t.table_name) loop
    execute immediate 'select count(*) from mern26."' || t.table_name || '"' into l_count;
    dbms_output.put_line(rpad(lower(t.table_name), 24) || lpad(l_count, 10));
    l_total := l_total + l_count;
    l_n := l_n + 1;
  end loop;
  dbms_output.put_line(rpad('-', 24, '-') || lpad('-', 10, '-'));
  dbms_output.put_line(rpad('TOTAL', 24) || lpad(l_total, 10) || '  (' || l_n || ' collections)');
end;
/
