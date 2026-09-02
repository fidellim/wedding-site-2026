# Archived: optional Supabase Free-tier backup notes

This is not part of the current Seating Studio rollout. Hannah and Fidel chose
to proceed without a manual backup workflow and instead require rollback-only
validation, non-destructive migrations, restrictive foreign keys, and retained
production records. Keep these notes only in case that decision changes later.

Use this runbook before every database schema migration and after every Seating
Plan publication. Retain at least the latest three encrypted backups.

## Safety boundary

The `db dump` commands in this runbook read the remote database and write SQL
files to the local backup directory. They do not change remote database data or
schema.

Do not run `db reset`, `db push`, `migration up`, `psql`, or any restore command
as part of a routine backup. Never test a restore against the production
project.

Backup files contain private guest information. Keep them outside this Git
repository, do not commit them, and store them on encrypted storage.

## Free-tier limitations

Supabase does not provide Free projects with managed, downloadable daily
backups in the dashboard. Supabase recommends creating manual logical backups
with the CLI instead.

A logical database backup covers the Postgres schema and selected database
data. It does not back up:

- files uploaded to Supabase Storage;
- Supabase dashboard settings and email templates;
- secrets or database passwords; or
- a complete copy of the managed Auth system.

When the later visual Floor Plan stores uploaded images, back up those Storage
objects separately.

## Prerequisites

- Access to the Supabase project as an owner or authorized team member.
- The project's database password.
- Node.js 20 or newer and the Supabase CLI, or another supported CLI install.
- A Docker-compatible container runtime, such as Docker Desktop.
- An encrypted backup destination outside this repository.

The Supabase CLI is not currently installed in this workspace. Docker Desktop
is installed, but its Docker engine must be started before CLI commands that
depend on it can run.

## One-time setup

Install the CLI as a pinned development dependency when the React admin project
is initialized:

```bash
npm install supabase --save-dev
npx supabase --version
```

Initialize and authenticate the local Supabase configuration:

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

Find `<PROJECT_REF>` in the Supabase dashboard URL. `link` prompts for the
database password; do not put the password directly in the command or commit it
to a file.

`init`, `login`, and `link` establish local CLI configuration. They do not alter
remote application data.

## Create a backup

Replace the example date and destination with a new, explicit directory for the
current backup. Do not use a directory inside this repository.

```bash
mkdir -p /path/to/encrypted-backups/2026-09-02
```

Dump custom roles, schema, and application data into separate files:

```bash
npx supabase db dump \
  --linked \
  --role-only \
  -f /path/to/encrypted-backups/2026-09-02/roles.sql

npx supabase db dump \
  --linked \
  -f /path/to/encrypted-backups/2026-09-02/schema.sql

npx supabase db dump \
  --linked \
  --data-only \
  --use-copy \
  -f /path/to/encrypted-backups/2026-09-02/data.sql
```

Expected files:

- `roles.sql`: custom database roles;
- `schema.sql`: tables, functions, triggers, and policies; and
- `data.sql`: application rows such as invitations, Invitees, RSVPs, and
  seating data.

## Verify the backup

Confirm that all three files exist and are non-empty:

```bash
ls -lh /path/to/encrypted-backups/2026-09-02
```

Create checksums so later corruption can be detected:

```bash
cd /path/to/encrypted-backups/2026-09-02
shasum -a 256 roles.sql schema.sql data.sql > SHA256SUMS
shasum -a 256 -c SHA256SUMS
```

A successful checksum verifies that the files have not changed since the
checksums were created. It does not prove that a restore will succeed.

Periodically test restoration into a disposable local or separate test project
using Supabase's official restore guide. Never restore into production merely
to test a backup.

## Protect and rotate backups

1. Store the dated directory in an encrypted disk, vault, or encrypted archive.
2. Keep at least the three most recent verified backups.
3. Keep one additional copy in a separate secure location.
4. Remove older copies only after verifying the retained copies.
5. Never send an unencrypted backup over email or messaging applications.

## Restore only when necessary

Restoration writes database state and is intentionally outside this routine
runbook. Before restoring, identify the exact target project, preserve its
current state, calculate acceptable data loss, and follow the official Supabase
restore procedure.

## Official references

- [Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Install and run the Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase CLI `db dump` reference](https://supabase.com/docs/reference/cli/supabase-start#supabase-db-dump)
