/**
 * Supabase client credentials from Expo public env (embedded at bundle time).
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in `.env`, then restart Expo.
 */
export function getSupabaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new Error(‘Missing EXPO_PUBLIC_SUPABASE_URL — add it to your .env file.’);
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error(‘Missing EXPO_PUBLIC_SUPABASE_ANON_KEY — add it to your .env file.’);
  return key;
}
