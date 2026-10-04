-- Refresh API metadata after the venue upgrade. No application records change.
-- Supabase: https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema
notify pgrst, 'reload schema';
