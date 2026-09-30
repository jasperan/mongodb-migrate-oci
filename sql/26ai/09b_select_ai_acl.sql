-- Select AI: one-time network ACL so the MERN26 schema can reach the model endpoint.
-- Run as ADMIN (saved SQLcl connection: mig26-admin), once per environment.
--
-- Only needed for the OpenAI-compatible route (`provider: openai`); the native
-- `provider: oci` route keeps the traffic inside Oracle and skips the ACL.
-- Re-runnable: appending the same host ACE twice is harmless.
--
--   define mern_llm_region = us-phoenix-1     -- default below
--   @sql/26ai/09b_select_ai_acl.sql

set define on
set serveroutput on

define mern_llm_region = us-phoenix-1

begin
  dbms_network_acl_admin.append_host_ace(
    host  => 'inference.generativeai.&mern_llm_region.oci.oraclecloud.com',
    ace   => xs$ace_type(privilege_list => xs$name_list('http'),
                         principal_name => 'MERN26',
                         principal_type => xs_acl.ptype_db));
  dbms_output.put_line('host ACE present for inference.generativeai.&mern_llm_region.oci.oraclecloud.com');
end;
/

commit;

-- Verify: the host must appear in the host ACEs for the MERN26 principal.
select host, lower_port, upper_port, principal
  from dba_host_aces
 where host like 'inference.generativeai.%'
 order by host, principal;
