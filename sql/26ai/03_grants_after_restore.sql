-- Grants that can only be issued once the collections exist (mongorestore creates them).
-- Run as ADMIN (saved SQLcl connection: mig26-admin) after the data import.

set serveroutput on
declare
  l_tables sys.odcivarchar2list;
begin
  select cast(collect(table_name) as sys.odcivarchar2list)
    into l_tables
    from all_tables t
   where t.owner = 'MERN26'
     and exists (select 1 from all_tab_columns c   -- JSON collection tables only
                  where c.owner = t.owner and c.table_name = t.table_name
                    and c.column_name = 'DATA' and c.data_type = 'JSON');

  for i in 1 .. l_tables.count loop
    execute immediate 'grant select, insert, update, delete on mern26."'
                      || l_tables(i) || '" to mern26dv';
  end loop;
  dbms_output.put_line(l_tables.count || ' collections granted to MERN26DV');
end;
/

select grantee, table_name, privilege
  from dba_tab_privs
 where owner = 'MERN26' and grantee = 'MERN26DV'
 order by table_name, privilege;
