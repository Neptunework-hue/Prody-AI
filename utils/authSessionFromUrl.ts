import { supabase } from '../services/supabase/supabase';

export type AuthUrlResult = 'recovery' | 'signed_in' | null;

function parseAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  if (queryIndex >= 0) {
    const end = hashIndex >= 0 ? hashIndex : url.length;
    const query = url.slice(queryIndex + 1, end);
    new URLSearchParams(query).forEach((value, key) => {
      params[key] = value;
    });
  }

  if (hashIndex >= 0) {
    const hash = url.slice(hashIndex + 1);
    new URLSearchParams(hash).forEach((value, key) => {
      params[key] = value;
    });
  }

  return params;
}

function isRecoveryUrl(url: string, type: string | undefined): boolean {
  const lower = url.toLowerCase();
  return (
    type === 'recovery' ||
    lower.includes('forgot-password') ||
    lower.includes('type=recovery')
  );
}

function isEmailConfirmationUrl(url: string, type: string | undefined): boolean {
  const lower = url.toLowerCase();
  return (
    type === 'signup' ||
    type === 'email' ||
    type === 'magiclink' ||
    lower.includes('confirmed=1') ||
    lower.includes('type=signup') ||
    lower.includes('type=email')
  );
}

/** Establishes a Supabase session from an auth email deep link. */
export async function createSessionFromAuthUrl(url: string): Promise<AuthUrlResult> {
  const params = parseAuthParams(url);
  const type = params.type;
  const recovery = isRecoveryUrl(url, type);
  const emailConfirm = isEmailConfirmationUrl(url, type);

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      throw error;
    }
    return recovery ? 'recovery' : 'signed_in';
  }

  const code = params.code;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }
    if (data.session) {
      return recovery ? 'recovery' : 'signed_in';
    }
  }

  const tokenHash = params.token_hash;
  if (tokenHash) {
    if (recovery || type === 'recovery') {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });
      if (error) {
        throw error;
      }
      return 'recovery';
    }

    if (emailConfirm || type === 'signup' || type === 'email') {
      const otpType = type === 'email' ? 'email' : 'signup';
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (error) {
        throw error;
      }
      return 'signed_in';
    }
  }

  const otpToken = params.token;
  if (otpToken && params.email) {
    if (type === 'recovery' || recovery) {
      const { error } = await supabase.auth.verifyOtp({
        email: params.email,
        token: otpToken,
        type: 'recovery',
      });
      if (error) {
        throw error;
      }
      return 'recovery';
    }

    if (type === 'signup' || type === 'email' || emailConfirm) {
      const otpType = type === 'email' ? 'email' : 'signup';
      const { error } = await supabase.auth.verifyOtp({
        email: params.email,
        token: otpToken,
        type: otpType,
      });
      if (error) {
        throw error;
      }
      return 'signed_in';
    }
  }

  return null;
}

export function isAuthCallbackUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('access_token') ||
    lower.includes('refresh_token') ||
    lower.includes('token_hash') ||
    lower.includes('code=') ||
    lower.includes('type=recovery') ||
    lower.includes('type=signup') ||
    lower.includes('type=email') ||
    lower.includes('forgot-password') ||
    lower.includes('/(auth)/login') ||
    lower.includes('confirmed=1')
  );
}

/** @deprecated Use isAuthCallbackUrl */
export function isPasswordResetUrl(url: string): boolean {
  return isAuthCallbackUrl(url);
}
