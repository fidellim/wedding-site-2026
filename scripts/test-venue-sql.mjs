// Entirely ephemeral PostgreSQL; no URL, credentials, or production connection.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const db = new PGlite({ extensions: { pgcrypto } });
const adminId = "00000000-0000-0000-0000-000000000001";
const migrations = ["20260902000100_create_seating_planner.sql", "20260902000200_create_seating_planner_functions.sql", "20260906000100_add_physical_table_layout.sql"];
const execFile = async name => db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
const workspace = async () => (await db.query("select public.admin_get_seating_workspace() as value")).rows[0].value;
const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`, args)).rows[0].value;
const rejected = async (name, args, match) => { const before = await workspace(); await assert.rejects(rpc(name, args), match); assert.deepEqual(await workspace(), before); };
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.admin_id', true), '')::uuid $$;
    create publication supabase_realtime;
    create table public.invites(code text primary key, guest_name text, max_seats integer, rsvp_status text, attendees_confirmed integer, updated_at timestamptz);
    insert into auth.users values('${adminId}');
    insert into public.invites values('TEST', 'Test family', 2, 'accepted', 2, now());`);
  for (const file of migrations) await execFile(file);
  await db.query("select set_config('test.admin_id', $1, false)", [adminId]);
  await db.query("insert into public.seating_admins(user_id, email, display_name) values($1, 'test@example.test', 'Test admin')", [adminId]);
  let w = await workspace();
  w = await rpc("admin_upsert_seating_table", [w.draft.version, { name: "Round", number: 1, shape: "round", capacity: 2 }]);
  w = await rpc("admin_upsert_seating_table", [w.draft.version, { name: "Rectangle", number: 2, shape: "rectangular", capacity: 2 }]);
  for (const name of ["A", "B"]) w = await rpc("admin_upsert_seating_invitee", [w.draft.version, { invitationPartyId: "TEST", fullName: name, attendanceStatus: "confirmed" }]);
  for (let i = 0; i < 2; i++) w = await rpc("admin_move_seating_invitee", [w.draft.version, w.draft.invitees[i].id, w.draft.seats.find(s => s.tableId === w.draft.tables[i].id).id]);
  w = await rpc("admin_publish_seating_plan", [w.draft.version]);
  const legacy = structuredClone(w.published), assignments = structuredClone(w.draft.assignments), seats = structuredClone(w.draft.seats);
  const baseline = await db.query("select (select count(*) from public.seating_tables) as tables, (select count(*) from public.seating_seats) as seats, (select count(*) from public.seating_assignments) as assignments, (select count(*) from public.invites) as invites");
  // Reproduce the missing RPC on the pre-upgrade production contract.
  await rejected("admin_save_venue_layout", [w.draft.version, {}], /does not exist/);
  const inspectionSql = await readFile(new URL("./inspect-venue-schema.sql", import.meta.url), "utf8");
  assert.equal((await db.query(inspectionSql)).rows[0].save_function_exists, false);
  await import("./prepare-venue-upgrade.mjs");
  await db.exec(await readFile(new URL("../supabase/.temp/venue-upgrade-validate.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'seating_plan_state' and column_name = 'venue_layout') as present")).rows[0].present, false);
  await execFile("20261002000100_add_shared_venue_layout.sql");
  await execFile("20261004000100_add_venue_reconstruction_estimates.sql");
  assert.deepEqual(await db.query("select (select count(*) from public.seating_tables) as tables, (select count(*) from public.seating_seats) as seats, (select count(*) from public.seating_assignments) as assignments, (select count(*) from public.invites) as invites"), baseline);
  assert.equal((await db.query(inspectionSql)).rows[0].save_function_exists, true);
  w = await workspace(); assert.equal(w.draft.venueLayout, null);
  assert.deepEqual({ ...w.published, venueLayout: undefined }, { ...legacy, venueLayout: undefined });
  await rejected("admin_publish_seating_plan", [w.draft.version, true], /PUBLICATION_BLOCKED/);
  const source = await readFile(new URL("../admin/src/venue/venueModel.ts", import.meta.url), "utf8");
  const parameters = Object.fromEntries([...source.matchAll(/^  (\w+): \{[^\n]*?value: ([.\d]+)/gm)].map(m => [m[1], Number(m[2])]));
  const [a, b] = w.draft.tables;
  const layout = { parameters, led: "center", landmarks: { stage: { x: 13, y: 6 }, danceFloor: { x: 13, y: -.1 }, entrance: { x: 13, y: -44 } }, tables: {
    [a.id]: { x: 2, y: 0, rotation: 0, width: 1.8, depth: 1.8, dimensionsVerified: false },
    [b.id]: { x: 10, y: 0, rotation: 90, width: 4, depth: 1.2, dimensionsVerified: false },
  } };
  await rejected("admin_save_venue_layout", [w.draft.version, {}], /INVALID_VENUE_LAYOUT/);
  // Optional reconstruction fields preserve older immutable layouts; provided values are bounded.
  const legacyLayout = structuredClone(layout);
  for (const key of ["approachLength", "pavilionPlazaGap", "bridgeHeight", "bridgeStepCount", "bridgeTread"]) delete legacyLayout.parameters[key];
  assert.equal((await db.query("select public.valid_seating_venue_layout($1::jsonb) as valid", [legacyLayout])).rows[0].valid, true);
  for (const [key, value] of [["approachLength", 2], ["pavilionPlazaGap", 100], ["bridgeHeight", 999], ["bridgeStepCount", 7], ["bridgeTread", .31]]) {
    const invalid = structuredClone(layout); invalid.parameters[key] = value;
    await rejected("admin_save_venue_layout", [w.draft.version, invalid], /INVALID_VENUE_LAYOUT/);
  }

  w = await rpc("admin_save_venue_layout", [w.draft.version, layout]);
  assert.deepEqual(w.draft.assignments, assignments); assert.deepEqual(w.draft.seats, seats);
  await rejected("admin_save_venue_layout", [w.draft.version - 1, layout], /STALE_VERSION/);
  const bad = structuredClone(layout); bad.tables[b.id].y = 6;
  w = await rpc("admin_save_venue_layout", [w.draft.version, bad]);
  await rejected("admin_publish_seating_plan", [w.draft.version, true], /table_outside_venue/);
  const overlap = structuredClone(layout); overlap.tables[b.id].x = 2;
  w = await rpc("admin_save_venue_layout", [w.draft.version, overlap]);
  await rejected("admin_publish_seating_plan", [w.draft.version], /acknowledge/);
  await rejected("admin_publish_seating_plan", [w.draft.version, null], /acknowledge/);
  w = await rpc("admin_publish_seating_plan", [w.draft.version, true]);
  const published = structuredClone(w.published);
  assert.deepEqual(published.venueLayout, overlap);
  w = await rpc("admin_save_venue_layout", [w.draft.version, layout]);
  assert.deepEqual(w.published, published);
  w = await rpc("admin_restore_seating_revision", [w.draft.version, published.id]);
  assert.deepEqual(w.draft.venueLayout, overlap); assert.deepEqual(w.draft.assignments, assignments);
  w = await rpc("admin_restore_seating_revision", [w.draft.version, legacy.id]);
  assert.equal(w.draft.venueLayout, null); assert.deepEqual(w.draft.assignments, assignments);
  const count = await db.query("select count(*)::integer as n from public.seating_tables"); assert.equal(count.rows[0].n, 2);
  await db.query("select set_config('test.admin_id', '', false)");
  await assert.rejects(rpc("admin_save_venue_layout", [w.draft.version, layout]), /administrator access required/);
  assert.equal((await db.query("select has_function_privilege('anon', 'public.admin_save_venue_layout(bigint,jsonb)', 'execute') as allowed")).rows[0].allowed, false);
  console.log("Venue SQL checks passed: row preservation, legacy revisions, atomic saves, stale versions, rotated boundaries, warning acknowledgement, immutable publication, restore, admin access.");
} finally { await db.close(); }
