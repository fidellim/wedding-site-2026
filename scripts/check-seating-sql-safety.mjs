import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const migrationPaths = [
  "supabase/migrations/20261009000100_add_guest_seating_guide.sql",
  "supabase/migrations/20260902000100_create_seating_planner.sql",
  "supabase/migrations/20260902000200_create_seating_planner_functions.sql",
  "supabase/migrations/20260906000100_add_physical_table_layout.sql",
  "supabase/migrations/20261002000100_add_shared_venue_layout.sql",
  "supabase/migrations/20261004000100_add_venue_reconstruction_estimates.sql",
  "supabase/migrations/20261013000100_retire_guest_seating_tokens.sql",
  "supabase/migrations/20261029000100_preserve_guest_table_names.sql",
];

const forbiddenPatterns = [
  {
    label: "row deletion",
    pattern: /\bdelete\s+from\b/giu,
  },
  {
    label: "table truncation",
    pattern: /\btruncate(?:\s+table)?\b/giu,
  },
  {
    label: "database-object removal",
    pattern: /\bdrop\s+(?:table|schema|function|extension|type|policy|index)\b/giu,
  },
  {
    label: "cascading or nullifying deletion",
    pattern: /\bon\s+delete\s+(?:cascade|set\s+null|set\s+default)\b/giu,
  },
  {
    label: "existing production-table alteration",
    pattern: /\balter\s+table\s+public\.(?:invites|registry_items|registry_reservations)\b/giu,
  },
  {
    label: "insertion into an existing production table",
    pattern: /\binsert\s+into\s+public\.(?:invites|registry_items|registry_reservations)\b/giu,
  },
  {
    label: "replacement of an existing production function",
    pattern:
      /\bcreate\s+or\s+replace\s+function\s+public\.(?:lookup_invite|submit_invite_rsvp|get_registry_for_invite)\b/giu,
  },
];

let failed = false;

for (const relativePath of migrationPaths) {
  let sql = await readFile(resolve(projectRoot, relativePath), "utf8");
  // This migration deliberately retires only these three unused objects.
  // All other destructive statements remain subject to the normal checks.
  if (relativePath === "supabase/migrations/20261013000100_retire_guest_seating_tokens.sql") {
    for (const statement of [
      "drop function if exists public.admin_set_guest_seating_token(text, text);",
      "drop function if exists public.get_published_seating_for_invite(text, text);",
      "drop table if exists public.seating_guest_tokens;",
    ]) {
      sql = sql.replace(statement, "");
    }
  }

  for (const { label, pattern } of forbiddenPatterns) {
    const matches = [...sql.matchAll(pattern)];
    if (matches.length === 0) continue;

    failed = true;
    for (const match of matches) {
      const line = sql.slice(0, match.index).split("\n").length;
      console.error(`${relativePath}:${line}: forbidden ${label}: ${match[0]}`);
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    "Seating SQL safety check passed: only approved unused-token removals; no row deletion, truncation, destructive foreign key, or existing production-object alteration found.",
  );
}
