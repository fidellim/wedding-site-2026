import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20261013000100_retire_guest_seating_tokens.sql"), "utf8");
const apply = process.argv.includes("--apply");
const sql = `-- ${apply ? "Apply" : "Rollback-only rehearsal of"} the unused seating-token cleanup.
begin;
select singleton from public.seating_plan_state where singleton for update;
create temporary table access_upgrade_baseline(table_name text primary key, fingerprint text) on commit drop;
create temporary table access_upgrade_guide on commit drop as
select pg_get_functiondef(to_regprocedure('public.get_seating_guide_for_invite(text)')) as definition;
do $baseline$
declare table_name text;
begin
  for table_name in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'seating_guest_tokens'
  loop
    execute format('insert into access_upgrade_baseline select %L, md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, %L)) from public.%I t', table_name, '[]', table_name);
  end loop;
end
$baseline$;
${migration}
do $verify$
declare baseline record; fingerprint text;
begin
  for baseline in select * from access_upgrade_baseline loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, %L)) from public.%I t', '[]', baseline.table_name) into fingerprint;
    if fingerprint is distinct from baseline.fingerprint then
      raise exception 'Existing rows changed in %; cleanup aborted', baseline.table_name;
    end if;
  end loop;
  if (select definition from access_upgrade_guide) is distinct from
    pg_get_functiondef(to_regprocedure('public.get_seating_guide_for_invite(text)')) then
    raise exception 'Code-based guide changed; cleanup aborted';
  end if;
  if to_regclass('public.seating_guest_tokens') is not null
    or to_regprocedure('public.admin_set_guest_seating_token(text,text)') is not null
    or to_regprocedure('public.get_published_seating_for_invite(text,text)') is not null then
    raise exception 'Unused token objects remain; cleanup aborted';
  end if;
end
$verify$;
${apply ? "commit" : "rollback"};
`;
await mkdir(resolve(root, "supabase/.temp"), { recursive: true });
const output = resolve(root, `supabase/.temp/seating-access-upgrade-${apply ? "apply" : "validate"}.sql`);
await writeFile(output, sql, { encoding: "utf8", mode: 0o600 });
console.log(output);
