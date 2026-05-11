// js/supabase-client.js
// Lazy initialization of the Supabase JS client. Returns null until both the
// CDN script has loaded AND the config has real values, so the rest of the
// app can call isSupabaseEnabled() and branch cleanly.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (typeof window === "undefined" || !window.supabase?.createClient) return null;
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

export function isSupabaseEnabled() {
  return getSupabase() !== null;
}
