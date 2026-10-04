-- Read-only inspection. Does not query guest details or modify production data.
with checks as (
  select
    exists(select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'seating_plan_state'
        and column_name = 'venue_layout') as layout_column_exists,
    to_regprocedure('public.admin_save_venue_layout(bigint,jsonb)') is not null as save_function_exists,
    to_regprocedure('public.admin_publish_seating_plan(bigint,boolean)') is not null as publish_function_exists
)
select *,
  case
    when layout_column_exists and save_function_exists and publish_function_exists
      then 'Upgrade installed. Run venue-refresh-schema.sql, refresh the studio, and retry.'
    when not layout_column_exists and not save_function_exists and not publish_function_exists
      then 'Upgrade missing. Run venue-upgrade-validate.sql, then venue-upgrade-apply.sql after validation succeeds.'
    else 'Upgrade is incomplete. Share these inspection results before running the upgrade again.'
  end as next_step
from checks;
