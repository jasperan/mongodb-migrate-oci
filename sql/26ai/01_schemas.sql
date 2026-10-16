-- 26ai migration setup: schemas for migrated JSON collections and duality views.
-- Run as ADMIN (saved SQLcl connection: mig26-admin).
-- Idempotent: safe to re-run.
--
-- Naming: <target> gets the MongoDB collections via mongorestore (MongoDB API);
--         <target>DV owns the JSON Relational Duality Views built on top of it.
-- Note: Oracle default profile rejects passwords containing the user name.
--
-- The schema passwords are never stored in this file. Define them before running
-- (the same values go into mern-ecommerce/server/.env):
--   accept mern26_password   char hide prompt 'MERN26 password: '
--   accept mern26dv_password char hide prompt 'MERN26DV password: '
--   @sql/26ai/01_schemas.sql
-- or `define mern26_password = ...` / `define mern26dv_password = ...` for a
-- non-interactive run. An undefined or empty variable stops the script.

set echo on
set verify off

column mern26_password   new_value mern26_password   noprint
column mern26dv_password new_value mern26dv_password noprint
select null mern26_password   from dual where 1 = 0;
select null mern26dv_password from dual where 1 = 0;

whenever sqlerror exit failure
begin
  if '&mern26_password' is null or '&mern26dv_password' is null then
    raise_application_error(-20001, 'define mern26_password and mern26dv_password first (see the header of this script)');
  end if;
end;
/
whenever sqlerror continue

-- 1) Schema that receives the MongoDB collections via mongorestore (MongoDB API).
declare
  l_exists number;
begin
  select count(*) into l_exists from dba_users where username = 'MERN26';
  if l_exists = 0 then
    execute immediate 'create user mern26 identified by "&mern26_password"';
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
    execute immediate 'create user mern26dv identified by "&mern26dv_password"';
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

set linesize 120
column username format a12
column account_status format a16
select username, account_status from dba_users where username in ('MERN26','MERN26DV');
