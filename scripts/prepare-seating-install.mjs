import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const migrationPaths = [
  "supabase/migrations/20260902000100_create_seating_planner.sql",
  "supabase/migrations/20260902000200_create_seating_planner_functions.sql",
  "supabase/migrations/20260906000100_add_physical_table_layout.sql",
];
const outputPath = resolve(
  projectRoot,
  "supabase/.temp/seating-main-install.sql",
);

const migrations = await Promise.all(
  migrationPaths.map(async (relativePath) => ({
    relativePath,
    sql: await readFile(resolve(projectRoot, relativePath), "utf8"),
  })),
);

const transactionBody = migrations
  .map(
    ({ relativePath, sql }) =>
      `\n-- BEGIN ${relativePath}\n${sql.trim()}\n-- END ${relativePath}\n`,
  )
  .join("\n");

const installSql = `-- Generated production installation file.
-- Unlike the rollback-only validation, this file ends in COMMIT.
-- It creates new seating objects but must not alter or delete existing records.
begin;

create temporary table seating_install_baseline on commit drop as
select
  (select count(*) from public.invites) as invite_count,
  (select count(*) from public.registry_items) as registry_item_count,
  (select count(*) from public.registry_reservations) as registry_reservation_count,
  md5(pg_catalog.pg_get_functiondef(
    to_regprocedure('public.lookup_invite(text)')
  )) as lookup_invite_definition,
  md5(pg_catalog.pg_get_functiondef(
    to_regprocedure('public.submit_invite_rsvp(text,text,text,text,integer,text)')
  )) as submit_rsvp_definition,
  md5(pg_catalog.pg_get_functiondef(
    to_regprocedure('public.get_registry_for_invite(text)')
  )) as registry_lookup_definition;

${transactionBody}

do $seating_install_validation$
declare
  baseline seating_install_baseline%rowtype;
begin
  select * into baseline from seating_install_baseline;

  if baseline.invite_count is distinct from (select count(*) from public.invites)
    or baseline.registry_item_count is distinct from (select count(*) from public.registry_items)
    or baseline.registry_reservation_count is distinct from (
      select count(*) from public.registry_reservations
    ) then
    raise exception 'Existing production row counts changed; installation aborted';
  end if;

  if baseline.lookup_invite_definition is distinct from md5(pg_catalog.pg_get_functiondef(
      to_regprocedure('public.lookup_invite(text)')
    ))
    or baseline.submit_rsvp_definition is distinct from md5(pg_catalog.pg_get_functiondef(
      to_regprocedure('public.submit_invite_rsvp(text,text,text,text,integer,text)')
    ))
    or baseline.registry_lookup_definition is distinct from md5(pg_catalog.pg_get_functiondef(
      to_regprocedure('public.get_registry_for_invite(text)')
    )) then
    raise exception 'Existing production RSVP function changed; installation aborted';
  end if;

  if to_regclass('public.seating_plan_state') is null
    or to_regprocedure('public.admin_publish_seating_plan(bigint)') is null then
    raise exception 'Seating installation is incomplete; installation aborted';
  end if;
end
$seating_install_validation$;

commit;

select jsonb_pretty(jsonb_build_object(
  'result', 'Seating schema installed successfully',
  'existingProductionRowCountsUnchanged', true,
  'existingRsvpFunctionsUnchanged', true,
  'seatingSchemaPresent', to_regclass('public.seating_plan_state') is not null,
  'seatingPublishFunctionPresent',
    to_regprocedure('public.admin_publish_seating_plan(bigint)') is not null
)) as seating_install_result;
`;

await mkdir(resolve(projectRoot, "supabase/.temp"), { recursive: true });
await writeFile(outputPath, installSql, { encoding: "utf8", mode: 0o600 });

console.log(outputPath);
