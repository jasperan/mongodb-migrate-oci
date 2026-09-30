-- Select AI: natural-language SQL over the migrated catalogue.
-- Run as MERN26 (saved SQLcl connection: mig26-app), after the one-time ACL step in
-- sql/26ai/09b_select_ai_acl.sql has been run as ADMIN.
--
-- Select AI keeps the language model inside the database conversation: Oracle
-- sends the schema + question to the configured provider and returns SQL, which
-- the application then executes (see server/routes/api/ai.js -> POST /api/ai/ask).
--
-- The workshop setup points Select AI at OCI Generative AI through its
-- OpenAI-compatible endpoint, using the same API key as the application:
--
--   0. key          -> sql/26ai/09_select_ai_key.sql (gitignored; copy the .example)
--   1. credential   -> DBMS_CLOUD.CREATE_CREDENTIAL (bearer token: the GenAI API key)
--   2. network ACL  -> the endpoint host must be reachable from the schema
--                      (only the native `provider: oci` route skips the ACL)
--   3. profile      -> provider `openai` + provider_endpoint (host/path, no scheme,
--                      without /v1/chat/completions) + the model id
--
-- Re-runnable: the credential and the profile are dropped and re-created, so the
-- script can be re-run after every migration - and after editing `object_list`,
-- e.g. when a new view or collection must become visible to Select AI.
--
--   cp sql/26ai/09_select_ai_key.sql.example sql/26ai/09_select_ai_key.sql  # put the key in it
--   bash _scratch/sqlrun.sh mig26-app sql/26ai/09_select_ai.sql            # run from the repo root

set define on
set echo on
set serveroutput on size unlimited

-- 0) the key, kept out of version control
@@sql/26ai/09_select_ai_key.sql

-- 0b) refuse to run on the placeholder (an empty password would create a
--     credential that only fails later, inside a model call)
declare
  l_key varchar2(4000) := trim('&mern_llm_key');
begin
  if l_key is null or substr(l_key, 1, 1) = '<' then
    raise_application_error(-20001, 'mern_llm_key is not set - put your key in sql/26ai/09_select_ai_key.sql');
  end if;
  dbms_output.put_line('key     : ' || substr(l_key, 1, 6) || '...' || substr(l_key, -4));
end;
/

-- 1) credential (run as MERN26) - dropped first, so re-runs do not hit ORA-20022
declare
  l_exists number;
begin
  select count(*) into l_exists
    from user_objects
   where object_type = 'CREDENTIAL' and object_name = 'MERN_LLM_CRED';
  if l_exists = 1 then
    execute immediate q'[begin dbms_cloud.drop_credential(credential_name => 'MERN_LLM_CRED'); end;]';
    dbms_output.put_line('dropped credential MERN_LLM_CRED');
  end if;
  dbms_cloud.create_credential(
    credential_name => 'MERN_LLM_CRED',
    username        => 'OPENAI',                     -- ignored by bearer-token gateways
    password        => '&mern_llm_key');             -- sk-...
  dbms_output.put_line('created credential MERN_LLM_CRED');
end;
/

-- 2) profile (run as MERN26) - re-created; `force` drops what depends on it
begin
  dbms_cloud_ai.drop_profile(profile_name => 'MERN_LLM', force => true);
  dbms_output.put_line('dropped profile MERN_LLM');
exception
  when others then
    dbms_output.put_line('no previous profile to drop');
end;
/

begin
  dbms_cloud_ai.create_profile(
    profile_name => 'MERN_LLM',
    attributes   => '{
        "provider": "openai",
        "credential_name": "MERN_LLM_CRED",
        "model": "xai.grok-4.3",
        "provider_endpoint": "inference.generativeai.us-phoenix-1.oci.oraclecloud.com/openai/v1",
        "conversation": "true",
        "object_list": [
            {"owner": "MERN26", "name": "PRODUCT_CATALOG"},
            {"owner": "MERN26", "name": "ORDER_SUMMARY"},
            {"owner": "MERN26", "name": "PRODUCT_REVIEW_STATS"},
            {"owner": "MERN26", "name": "products"},
            {"owner": "MERN26", "name": "orders"},
            {"owner": "MERN26", "name": "reviews"},
            {"owner": "MERN26", "name": "users"},
            {"owner": "MERN26", "name": "categories"}],
        "comments": true}',
    status       => 'ENABLED',
    description  => 'OCI Generative AI (xai.grok-4.3) via the OpenAI-compatible endpoint');
  dbms_output.put_line('created profile MERN_LLM');
end;
/

select profile_name, status, description from user_cloud_ai_profiles order by profile_name;

-- 3) smoke tests: showsql (SQL only) then runsql (SQL + result) against the
--    migrated catalogue, including a question the `categories` object answers.
column generated_sql format a110
select dbms_cloud_ai.generate(
         prompt       => 'Which five products are the most expensive?',
         profile_name => 'MERN_LLM',
         action       => 'showsql') as generated_sql
  from dual;

select dbms_cloud_ai.generate(
         prompt       => 'How many products are in each category?',
         profile_name => 'MERN_LLM',
         action       => 'showsql') as generated_sql
  from dual;

column answer format a90
select dbms_cloud_ai.generate(
         prompt       => 'How many products are in each category?',
         profile_name => 'MERN_LLM',
         action       => 'runsql') as answer
  from dual;

-- Afterwards set SELECT_AI_PROFILE=MERN_LLM in server/.env to enable /api/ai/ask.
