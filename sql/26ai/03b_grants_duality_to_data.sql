-- Let the data schema read the duality views it feeds (used by the JSON validity
-- views, which infer their schema from the duality views).
-- Run as ADMIN (saved SQLcl connection: mig26-admin).

set serveroutput on
declare
  l_count pls_integer := 0;
begin
  for r in (select owner, view_name from dba_views where owner = 'MERN26DV') loop
    execute immediate 'grant select on mern26dv."' || r.view_name || '" to mern26';
    l_count := l_count + 1;
  end loop;
  for r in (select owner, table_name from dba_tables where owner = 'MERN26DV') loop
    execute immediate 'grant select on mern26dv."' || r.table_name || '" to mern26';
    l_count := l_count + 1;
  end loop;
  dbms_output.put_line(l_count || ' MERN26DV objects granted to MERN26');
end;
/

select grantee, owner, table_name, privilege
  from dba_tab_privs
 where owner = 'MERN26DV' and grantee = 'MERN26' and privilege = 'SELECT'
 order by table_name
 fetch first 15 rows only;
