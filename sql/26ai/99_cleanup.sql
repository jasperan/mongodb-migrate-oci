-- Workshop clean-up: remove everything the sql/26ai scripts created.
-- Run as ADMIN. Stop the storefront API first: it holds pooled MERN26 sessions, and
-- DROP USER fails while a user has a connected session (the script itself disconnects the
-- idle sessions of the MongoDB API).
--
--   export MERN_LLM_REGION=<region>        # only if you gave 09b a region other than us-phoenix-1
--   bash scripts/workshop/run-sql.sh ADMIN sql/26ai/99_cleanup.sql
--
-- Dropping MERN26 with CASCADE also removes its tables, views, vector store, ONNX model,
-- Select AI credential and profile; dropping MERN26DV removes the duality views.
-- Safe to re-run: every step checks first.

set define on
set verify off
set serveroutput on

-- keep a region the caller already defined; otherwise default it
set termout off
column mern_llm_region new_value mern_llm_region noprint
select null mern_llm_region from dual where 1 = 0;
column mern_llm_region_default new_value mern_llm_region noprint
select nvl('&mern_llm_region', 'us-phoenix-1') mern_llm_region_default from dual;
set termout on

-- 1) network ACL entry created by 09b_select_ai_acl.sql
begin
  dbms_network_acl_admin.remove_host_ace(
    host => 'inference.generativeai.&mern_llm_region..oci.oraclecloud.com',
    ace  => xs$ace_type(privilege_list => xs$name_list('http'),
                        principal_name => 'MERN26', principal_type => xs_acl.ptype_db));
  dbms_output.put_line('removed host ACE for inference.generativeai.&mern_llm_region..oci.oraclecloud.com');
exception
  when others then
    dbms_output.put_line('host ACE not removed (already gone?): ' || sqlerrm);
end;
/

-- 2) schemas (duality views first, then the collections they sit on)
declare
  procedure drop_schema(p_user varchar2) is
    l_exists number;
  begin
    select count(*) into l_exists from dba_users where username = p_user;
    if l_exists = 0 then
      dbms_output.put_line(p_user || ': not present');
      return;
    end if;
    -- the MongoDB API (ORDS) keeps idle pooled sessions open for the schema; DROP USER needs them gone
    for l_sess in (select sid, serial# from v$session where username = p_user) loop
      begin
        execute immediate 'alter system kill session ''' || l_sess.sid || ',' || l_sess.serial# || ''' immediate';
      exception when others then
        dbms_output.put_line(p_user || ': session ' || l_sess.sid || ' not killed: ' || sqlerrm);
      end;
    end loop;
    for i in 1 .. 15 loop   -- killed sessions need a moment to disappear
      select count(*) into l_exists from v$session where username = p_user;
      exit when l_exists = 0;
      dbms_session.sleep(2);
    end loop;
    begin
      ords_admin.drop_rest_for_schema(p_schema => p_user);
    exception when others then
      dbms_output.put_line(p_user || ': ORDS metadata not removed: ' || sqlerrm);
    end;
    execute immediate 'drop user ' || p_user || ' cascade';
    dbms_output.put_line(p_user || ': dropped');
  end;
begin
  drop_schema('MERN26DV');
  drop_schema('MERN26');
end;
/

select username from dba_users where username in ('MERN26', 'MERN26DV');
