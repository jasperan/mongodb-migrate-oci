begin
	for c in (
		select table_name
		  from all_tables
		 where owner = 'ECOMMERCE'
	) loop
		begin
			dbms_errlog.create_error_log(
			                            dml_table_name => c.table_name,
			                            err_log_table_name => c.table_name || '_ERR_LOG',
			                            skip_unsupported => true
			);
		exception
			when others then
				null;
		end;
		begin
			dbms_json_duality.import(
			                        table_owner_name => 'ECOMMERCE',
			                        table_name => c.table_name,
			                        view_owner_name => 'ECOMMERCEDV',
			                        view_name => lower(
					      c.table_name
				      ),
			                        err_log_name => c.table_name || '_ERR_LOG'
			);
		exception
			when others then
				null;
		end;
	end loop;
end;
/