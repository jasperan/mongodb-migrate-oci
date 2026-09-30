-- Select AI: natural-language SQL over the migrated catalogue.
-- Run as MERN26 (saved SQLcl connection: mig26-app), ACL as ADMIN (mig26-admin).
--
-- Select AI keeps the language model inside the database conversation: Oracle
-- sends the schema + question to the configured provider and returns SQL, which
-- the application then executes (see server/routes/api/ai.js -> POST /api/ai/ask).
--
-- The workshop setup points Select AI at OCI Generative AI through its
-- OpenAI-compatible endpoint, using the same API key as the application:
--
--   1. credential   -> DBMS_CLOUD.CREATE_CREDENTIAL (bearer token: the GenAI API key)
--   2. network ACL  -> the endpoint host must be reachable from the schema
--                      (only the native `provider: oci` route skips the ACL)
--   3. profile      -> provider `openai` + provider_endpoint (host/path, no scheme,
--                      without /v1/chat/completions) + the model id
--
-- Substitute your own key / region / compartment before running.

/*
-- 1. credential (run as MERN26)
begin
  dbms_cloud.create_credential(
    credential_name => 'MERN_LLM_CRED',
    username        => 'OPENAI',                     -- ignored by bearer-token gateways
    password        => '<oci-genai-api-key>');       -- sk-…
end;
/

-- 2. network ACL (run as ADMIN)
begin
  dbms_network_acl_admin.append_host_ace(
    host  => 'inference.generativeai.<region>.oci.oraclecloud.com',
    ace   => xs$ace_type(privilege_list => xs$name_list('http'),
                         principal_name => 'MERN26',
                         principal_type => xs_acl.ptype_db));
end;
/

-- 3. profile (run as MERN26)
begin
  dbms_cloud_ai.create_profile(
    profile_name => 'MERN_LLM',
    attributes   => '{
        "provider": "openai",
        "credential_name": "MERN_LLM_CRED",
        "model": "xai.grok-4.3",
        "provider_endpoint": "inference.generativeai.<region>.oci.oraclecloud.com/openai/v1",
        "conversation": "true",
        "object_list": [
            {"owner": "MERN26", "name": "PRODUCT_CATALOG"},
            {"owner": "MERN26", "name": "ORDER_SUMMARY"},
            {"owner": "MERN26", "name": "PRODUCT_REVIEW_STATS"},
            {"owner": "MERN26", "name": "products"},
            {"owner": "MERN26", "name": "orders"},
            {"owner": "MERN26", "name": "reviews"},
            {"owner": "MERN26", "name": "users"}],
        "comments": true}',
    status       => 'ENABLED',
    description  => 'OCI Generative AI (xai.grok-4.3) via the OpenAI-compatible endpoint');
end;
/

-- smoke test: ask for SQL only
select dbms_cloud_ai.generate(
         prompt       => 'Which five products are the most expensive?',
         profile_name => 'MERN_LLM',
         action       => 'showsql') as generated_sql
  from dual;
*/

-- Afterwards set SELECT_AI_PROFILE=MERN_LLM in server/.env to enable /api/ai/ask.

select profile_name, status from user_cloud_ai_profiles order by profile_name;
