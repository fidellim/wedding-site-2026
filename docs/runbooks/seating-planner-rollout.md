# Roll out the private Seating Studio

This runbook separates code deployment from production database changes. The
seating migrations in this repository are source files only; creating them did
not change the live Supabase project.

Do not apply a seating migration until Hannah and Fidel have reviewed the local
demo, the production schema report, and a successful rollback-only validation.

## 1. Review the local application

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Open `http://localhost:5173/admin/`. Without Supabase environment variables,
the development build uses disposable in-memory demonstration data. Refreshing
the page resets those changes.

Review these flows:

- add an Invitee and reconcile an accepted Invitation Party;
- record an RSVP Amendment and confirm that a decline releases draft Seats;
- create round and rectangular Tables;
- place, move, unassign, and undo Confirmed Attendees;
- review blocking Publishing Errors and warning-only preferences;
- publish a complete revision, restore it to a new draft, and republish; and
- create a party-only secure seating link.

## 2. Verify the production contract

Run the read-only [production schema inspection](../../scripts/inspect-production-schema.sql)
in the Supabase SQL Editor. It must report the existing `invites`,
`registry_items`, and `registry_reservations` structures without querying guest
records.

Compare the report with the migration preflight. The first migration
intentionally stops if the required `code`, `guest_name`,
`max_seats`, `rsvp_status`, `attendees_confirmed`, or `updated_at` columns are
absent. Review any differences before editing the migration; do not weaken the
preflight merely to make it run.

Run the local destructive-SQL guard before generating any validation file:

```bash
npm run seating:check-sql-safety
```

The guard rejects row deletion, truncation, destructive foreign keys, and
changes to the existing production tables or RSVP functions. The seating
migrations may create new seating objects and the audited RSVP Amendment
function may update an existing invitation response; no existing row is
deleted.

## 3. Prepare the two administrator identities

Supabase project-team membership and application authorization are separate:

1. Add Hannah to the Supabase project with the least-privileged dashboard role
   that permits the agreed operational work.
2. In Supabase Auth, create or invite exactly two Auth users: Hannah and Fidel.
   The application sends OTPs with `shouldCreateUser: false`, so unknown email
   addresses cannot create their own accounts.
3. Configure the email template to include the six-digit `{{ .Token }}` value,
   then test delivery to both addresses using the built-in sender.
4. After the seating schema exists, add those two Auth user IDs to the
   `public.seating_admins` allowlist. Use the exact IDs from `auth.users` and
   verify the emails before executing the inserts.

Example allowlist statement—replace every placeholder and review the selected
rows before executing it:

```sql
insert into public.seating_admins (user_id, email, display_name)
select id, lower(email),
  case lower(email)
    when '<HANNAH_EMAIL>' then 'Hannah'
    when '<FIDEL_EMAIL>' then 'Fidel'
  end
from auth.users
where lower(email) in ('<HANNAH_EMAIL>', '<FIDEL_EMAIL>');
```

RLS and every privileged RPC independently call the two-user allowlist. Being a
Supabase project member alone does not grant access to `/admin`.

## 4. Apply the reviewed migrations

The two versioned files are:

- `20260902000100_create_seating_planner.sql`: tables, constraints, RLS, and
  the administrator authorization boundary;
- `20260902000200_create_seating_planner_functions.sql`: atomic commands,
  validation, audit history, publication, realtime, and party-only lookup.

Apply them through the normal Supabase migration workflow only after explicit
approval. Do not paste fragments selectively into production: the functions
depend on the constraints and RLS policies from the first migration.

When Docker is unavailable, generate the rollback-only validation script:

```bash
npm run seating:prepare-validation
```

The command writes an ignored, permission-restricted SQL file beneath
`supabase/.temp/`. Paste the entire generated file into the main project's SQL
Editor. It creates the schema only inside an explicit transaction and ends in
`ROLLBACK`. A successful result must report both `seatingSchemaStillPresent`
and `seatingPublishFunctionStillPresent` as `false`.

If the SQL Editor reports any error, immediately run `ROLLBACK;` in a new query
and stop. Never replace the generated `ROLLBACK` with `COMMIT`.

After the rollback-only validation succeeds, generate the atomic production
installation file:

```bash
npm run seating:prepare-install
```

This writes `supabase/.temp/seating-main-install.sql`. Unlike the validation
file, it ends in `COMMIT` and therefore creates the new seating schema
permanently. Before committing, it verifies that the row counts in all three
existing production tables and the definitions of all three existing public
RSVP/registry functions remain unchanged. If any statement or verification
fails, the transaction cannot commit.

## 5. Configure Netlify

Add these values to the Netlify site environment; never place the real values
in a committed `.env` file:

```text
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<SUPABASE_PUBLISHABLE_KEY>
```

The publishable key is designed for browser use, but it does not authorize
seating data. RLS and the narrow RPC functions enforce access. Never expose a
secret or legacy service-role key to Netlify's browser build.

Deploy the build from `netlify.toml`, then verify:

- `/` still loads a valid personalized invitation;
- `/admin` sends a six-digit OTP only to an existing Auth user;
- an Auth user outside the allowlist cannot load the workspace;
- both administrator sessions receive realtime updates;
- two simultaneous moves to one Seat produce one winner and one refresh;
- the invitation hides seating before publication or with a wrong token; and
- a generated party link reveals only that party's names and Seats.

## 6. Publish safely

Before every publication, review the validation summary and the warning list.
Generate party links only after the revision exists; generating a new link
invalidates the previous seating token for that Invitation Party.

No automatic email or message is sent by publishing. Hannah and Fidel decide
when and how to share the private links.
