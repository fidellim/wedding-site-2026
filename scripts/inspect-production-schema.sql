-- READ-ONLY PRODUCTION SCHEMA INSPECTION
--
-- Run this in Supabase Dashboard > SQL Editor. It reads PostgreSQL metadata
-- only. It does not read guest rows and does not change any database object.
--
-- Copy the single JSON result back to the project owner for review before any
-- seating-planner migration is applied.

with
public_tables as (
  select
    c.oid as table_oid,
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as row_level_security_enabled,
    c.relforcerowsecurity as row_level_security_forced
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
),
table_details as (
  select jsonb_agg(
    jsonb_build_object(
      'schema', t.schema_name,
      'name', t.table_name,
      'rowLevelSecurityEnabled', t.row_level_security_enabled,
      'rowLevelSecurityForced', t.row_level_security_forced,
      'columns', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'position', a.attnum,
            'name', a.attname,
            'postgresType', pg_catalog.format_type(a.atttypid, a.atttypmod),
            'nullable', not a.attnotnull,
            'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
            'identity', nullif(a.attidentity, ''),
            'generated', nullif(a.attgenerated, '')
          ) order by a.attnum
        )
        from pg_catalog.pg_attribute a
        left join pg_catalog.pg_attrdef d
          on d.adrelid = a.attrelid
         and d.adnum = a.attnum
        where a.attrelid = t.table_oid
          and a.attnum > 0
          and not a.attisdropped
      ), '[]'::jsonb),
      'constraints', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', con.conname,
            'type', case con.contype
              when 'p' then 'PRIMARY KEY'
              when 'f' then 'FOREIGN KEY'
              when 'u' then 'UNIQUE'
              when 'c' then 'CHECK'
              when 'x' then 'EXCLUSION'
              else con.contype::text
            end,
            'definition', pg_catalog.pg_get_constraintdef(con.oid, true)
          ) order by con.conname
        )
        from pg_catalog.pg_constraint con
        where con.conrelid = t.table_oid
      ), '[]'::jsonb),
      'indexes', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', index_class.relname,
            'definition', pg_catalog.pg_get_indexdef(index_class.oid)
          ) order by index_class.relname
        )
        from pg_catalog.pg_index idx
        join pg_catalog.pg_class index_class on index_class.oid = idx.indexrelid
        where idx.indrelid = t.table_oid
      ), '[]'::jsonb),
      'triggers', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', trg.tgname,
            'enabled', trg.tgenabled,
            'definition', pg_catalog.pg_get_triggerdef(trg.oid, true)
          ) order by trg.tgname
        )
        from pg_catalog.pg_trigger trg
        where trg.tgrelid = t.table_oid
          and not trg.tgisinternal
      ), '[]'::jsonb),
      'policies', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', p.policyname,
            'command', p.cmd,
            'permissive', p.permissive,
            'roles', p.roles,
            'using', p.qual,
            'withCheck', p.with_check
          ) order by p.policyname
        )
        from pg_catalog.pg_policies p
        where p.schemaname = t.schema_name
          and p.tablename = t.table_name
      ), '[]'::jsonb),
      'grants', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'grantee', g.grantee,
            'privilege', g.privilege_type,
            'grantable', g.is_grantable
          ) order by g.grantee, g.privilege_type
        )
        from information_schema.role_table_grants g
        where g.table_schema = t.schema_name
          and g.table_name = t.table_name
      ), '[]'::jsonb)
    ) order by t.table_name
  ) as value
  from public_tables t
),
target_functions as (
  select
    p.oid,
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_catalog.pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer,
    p.provolatile as volatility_code,
    p.proconfig as runtime_configuration,
    pg_catalog.pg_get_userbyid(p.proowner) as owner,
    pg_catalog.pg_get_functiondef(p.oid) as definition
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_registry_for_invite',
      'lookup_invite',
      'submit_invite_rsvp'
    )
),
function_details as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', f.schema_name,
      'name', f.function_name,
      'identityArguments', f.identity_arguments,
      'resultType', f.result_type,
      'securityDefiner', f.security_definer,
      'volatility', case f.volatility_code
        when 'i' then 'IMMUTABLE'
        when 's' then 'STABLE'
        when 'v' then 'VOLATILE'
      end,
      'runtimeConfiguration', f.runtime_configuration,
      'owner', f.owner,
      'definition', f.definition,
      'grants', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'grantee', g.grantee,
            'privilege', g.privilege_type,
            'grantable', g.is_grantable
          ) order by g.grantee, g.privilege_type
        )
        from information_schema.role_routine_grants g
        where g.routine_schema = f.schema_name
          and g.routine_name = f.function_name
      ), '[]'::jsonb)
    ) order by f.function_name, f.identity_arguments
  ), '[]'::jsonb) as value
  from target_functions f
),
view_details as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema', v.schemaname,
      'name', v.viewname,
      'owner', v.viewowner,
      'definition', v.definition
    ) order by v.viewname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_views v
  where v.schemaname = 'public'
),
extension_details as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', e.extname,
      'version', e.extversion,
      'schema', n.nspname
    ) order by e.extname
  ), '[]'::jsonb) as value
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid = e.extnamespace
)
select jsonb_pretty(jsonb_build_object(
  'inspection', 'read-only schema metadata; no guest records included',
  'databaseVersion', current_setting('server_version'),
  'tables', coalesce((select value from table_details), '[]'::jsonb),
  'views', (select value from view_details),
  'existingRsvpFunctions', (select value from function_details),
  'extensions', (select value from extension_details)
)) as production_schema_report;
