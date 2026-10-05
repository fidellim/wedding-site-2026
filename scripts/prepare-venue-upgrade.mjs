import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const migration = (await Promise.all(["20261002000100_add_shared_venue_layout.sql", "20261004000100_add_venue_reconstruction_estimates.sql"].map(name => readFile(resolve(root, "supabase/migrations", name), "utf8")))).join("\n");
const apply = process.argv.includes("--apply");
const tables = ["invites", "registry_items", "registry_reservations", "seating_admins", "seating_keep_together_groups", "seating_invitees", "seating_invitation_rosters", "seating_attendance_roster_changes", "seating_rsvp_amendments", "seating_tables", "seating_seats", "seating_assignments", "seating_plan_revisions", "seating_plan_state", "seating_guest_tokens", "seating_audit_log"];
const sql = `-- Additive upgrade for an already-installed seating planner only.
-- ${apply ? "Applies the upgrade after verifying every existing row is unchanged." : "Validation only: all schema changes are rolled back."}
begin;
-- Serialize planner commands so the preservation baseline cannot race an edit.
select singleton from public.seating_plan_state where singleton for update;
create temporary table venue_upgrade_baseline(table_name text primary key, fingerprint text) on commit drop;
do $baseline$
declare table_name text;
begin
  foreach table_name in array array[${tables.map(t => `'${t}'`).join(", ")}] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('insert into venue_upgrade_baseline select %L, md5(coalesce(jsonb_agg(row_value order by row_value::text)::text, %L)) from (select to_jsonb(t) - %L as row_value from public.%I t) rows', table_name, '[]', 'venue_layout', table_name);
    end if;
  end loop;
end
$baseline$;
${migration}
do $verify$
declare baseline record; fingerprint text;
begin
  for baseline in select * from venue_upgrade_baseline loop
    execute format('select md5(coalesce(jsonb_agg(row_value order by row_value::text)::text, %L)) from (select to_jsonb(t) - %L as row_value from public.%I t) rows', '[]', 'venue_layout', baseline.table_name) into fingerprint;
    if fingerprint is distinct from baseline.fingerprint then
      raise exception 'Existing rows changed in %; venue upgrade aborted', baseline.table_name;
    end if;
  end loop;
end
$verify$;
${apply ? "commit" : "rollback"};
`;
await mkdir(resolve(root, "supabase/.temp"), { recursive: true });
const output = resolve(root, `supabase/.temp/venue-upgrade-${apply ? "apply" : "validate"}.sql`);
await writeFile(output, sql, { encoding: "utf8", mode: 0o600 });
console.log(output);
