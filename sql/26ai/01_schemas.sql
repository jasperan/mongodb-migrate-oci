-- 26ai migration setup: schemas for migrated JSON collections and duality views.
-- Run as ADMIN (saved SQLcl connection: mig26-admin).
-- Idempotent: safe to re-run.
--
-- Naming: <target> gets the MongoDB collections via mongorestore (MongoDB API);
--         <target>DV owns the JSON Relational Duality Views built on top of it.
-- Note: Oracle default profile rejects passwords containing the user name.

set echo on

-- 1) Schema that receives the MongoDB collections via mongorestore (MongoDB API).
declare
  l_exists number;
begin
  select count(*) into l_exists from dba_users where username = 'MERN26';
  if l_exists = 0 then
    execute immediate 'create user mern26 identified by "REDACTED-PASSWORD"';
  end if;
end;
/

grant DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP, CONNECT to mern26;

begin
  ords.enable_schema(
    p_enabled             => true,
    p_schema              => 'MERN26',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'mern26',
    p_auto_rest_auth      => false
  );
end;
/

-- 2) Schema that owns the JSON Relational Duality Views built on top of MERN26.
declare
  l_exists number;
begin
  select count(*) into l_exists from dba_users where username = 'MERN26DV';
  if l_exists = 0 then
    execute immediate 'create user mern26dv identified by "REDACTED-PASSWORD"';
  end if;
end;
/

grant DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP, CONNECT to mern26dv;

begin
  ords.enable_schema(
    p_enabled             => true,
    p_schema              => 'MERN26DV',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'mern26dv',
    p_auto_rest_auth      => false
  );
end;
/

-- 3) Let MERN26DV read the MERN26 collections (needed to build duality views).
--    Run sql/26ai/03_grants_after_restore.sql once the collections exist.

select username, account_status from dba_users where username in ('MERN26','MERN26DV');
