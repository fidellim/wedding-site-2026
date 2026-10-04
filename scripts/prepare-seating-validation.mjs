import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const migrationPaths = [
  "supabase/migrations/20260902000100_create_seating_planner.sql",
  "supabase/migrations/20260902000200_create_seating_planner_functions.sql",
  "supabase/migrations/20260906000100_add_physical_table_layout.sql",
  "supabase/migrations/20261002000100_add_shared_venue_layout.sql",
];
const outputPath = resolve(
  projectRoot,
  "supabase/.temp/seating-main-rollback-validation.sql",
);

const migrations = await Promise.all(
  migrationPaths.map(async (relativePath) => ({
    relativePath,
    sql: await readFile(resolve(projectRoot, relativePath), "utf8"),
  })),
);

const transactionBody = migrations
  .map(({ relativePath, sql }) => `\n-- BEGIN ${relativePath}\n${sql.trim()}\n-- END ${relativePath}\n`)
  .join("\n");

const validationSql = `-- Generated file. This script must end in ROLLBACK, never COMMIT.
begin;

${transactionBody}

do $seating_validation$
declare
  sample_code text;
  resolved_code text;
begin
  select code into sample_code
  from public.invites
  order by code
  limit 1;

  resolved_code := public.resolve_seating_invite_code(lower(sample_code));
  if resolved_code is distinct from sample_code then
    raise exception 'Case-insensitive invitation-code resolution failed';
  end if;

  if to_regclass('public.seating_plan_state') is null then
    raise exception 'Seating schema was not created inside the validation transaction';
  end if;

  if to_regprocedure('public.admin_publish_seating_plan(bigint)') is null then
    raise exception 'Seating functions were not created inside the validation transaction';
  end if;
end
$seating_validation$;

rollback;

select jsonb_pretty(jsonb_build_object(
  'result', 'Validation compiled successfully and was rolled back',
  'seatingSchemaStillPresent', to_regclass('public.seating_plan_state') is not null,
  'seatingPublishFunctionStillPresent',
    to_regprocedure('public.admin_publish_seating_plan(bigint)') is not null,
  'anySeatingRelationsStillPresent', exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname like 'seating\\_%' escape '\\'
  ),
  'anySeatingFunctionsStillPresent', exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and (
        procedure.proname like 'seating\\_%' escape '\\'
        or procedure.proname like '%\\_seating\\_%' escape '\\'
      )
  )
)) as seating_validation_result;
`;

await mkdir(resolve(projectRoot, "supabase/.temp"), { recursive: true });
await writeFile(outputPath, validationSql, { encoding: "utf8", mode: 0o600 });

console.log(outputPath);
