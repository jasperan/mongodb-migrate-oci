-- as admin
GRANT DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP to ecommerce identified by "password";
GRANT DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP to ecommercedv identified by "password";
grant select on ecommerce.addresses to ecommercedv;