-- Showcase helper: expose the duality-view catalogue to the application schema.
-- Run as MERN26DV (saved SQLcl connection: mig26-dv) after 06_import_duality_views.sql.
--
-- ALL_JSON_DUALITY_VIEWS only lists duality views owned by the connected user, and a
-- view over that dictionary view cannot be re-granted (ORA-01720). A small manifest
-- table is the portable way to publish the list to the data schema.

begin
  execute immediate 'create table duality_view_manifest (
                       view_name       varchar2(128) primary key,
                       root_table_name varchar2(128),
                       root_table_owner varchar2(128),
                       allow_insert    varchar2(3),
                       allow_update    varchar2(3),
                       allow_delete    varchar2(3),
                       noted_at        timestamp default systimestamp)';
exception
  when others then
    if sqlcode != -955 then raise; end if;
end;
/

delete from duality_view_manifest;

insert into duality_view_manifest (view_name, root_table_name, root_table_owner, allow_insert, allow_update, allow_delete)
select view_name, root_table_name, root_table_owner,
       case when allow_insert = 'YES' then 'YES' else 'NO' end,
       case when allow_update = 'YES' then 'YES' else 'NO' end,
       case when allow_delete = 'YES' then 'YES' else 'NO' end
  from user_json_duality_views;

commit;

grant select on duality_view_manifest to mern26;

select view_name, root_table_name, allow_insert, allow_update, allow_delete
  from duality_view_manifest
 order by view_name;
