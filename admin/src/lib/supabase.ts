import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfiguration {
  client: SupabaseClient | null;
  missing: string[];
}

export function getSupabaseConfiguration(): SupabaseConfiguration {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const publishableKey = String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      import.meta.env.VITE_SUPABASE_ANON_KEY ??
      "",
  ).trim();
  const missing = [
    ...(url ? [] : ["VITE_SUPABASE_URL"]),
    ...(publishableKey ? [] : ["VITE_SUPABASE_PUBLISHABLE_KEY"]),
  ];

  return {
    client: missing.length ? null : createClient(url, publishableKey),
    missing,
  };
}
