/**
 * Supabase client credentials from Expo public env (embedded at bundle time).
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in `.env`, then restart Expo.
 *
 * Fallbacks match the project’s default Supabase instance so local dev works before `.env` exists;
 * override via `.env` for your own project.
 */
const FALLBACK_URL = 'https://bdvykloyemssejhxcalz.supabase.co';
const FALLBACK_ANON_KEY = 'sb_publishable_7SvolQ8iEA4-8mX3A7LFtA_XzamAVYD';

export function getSupabaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || FALLBACK_URL;
}

export function getSupabaseAnonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || FALLBACK_ANON_KEY;
}
