-- as admin
GRANT DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP, CONNECT to ecommerce identified by "password";
GRANT DB_DEVELOPER_ROLE, DWROLE, UNLIMITED TABLESPACE, SODA_APP, CONNECT to ecommercedv identified by "password";

BEGIN
  ORDS.ENABLE_SCHEMA(
    p_enabled => TRUE,
    p_schema => 'ECOMMERCE',
    p_url_mapping_type => 'BASE_PATH',
    p_url_mapping_pattern => 'ecommerce',
    p_auto_rest_auth => FALSE
  );
END;
/

BEGIN
  ORDS.ENABLE_SCHEMA(
    p_enabled => TRUE,
    p_schema => 'ECOMMERCEDV',
    p_url_mapping_type => 'BASE_PATH',
    p_url_mapping_pattern => 'ecommercedv',
    p_auto_rest_auth => FALSE
  );
END;
/




