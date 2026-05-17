import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

export const AUTH_PATHS = {
  login: '/(auth)/login',
  loginConfirmed: '/(auth)/login?confirmed=1',
  /** Deep link target for reset emails (tunnel exp://…/--/(auth)/forgot-password) */
  forgotPassword: '/(auth)/forgot-password',
  forgotPasswordRecovery: '/(auth)/forgot-password?recovery=1',
} as const;

/**
 * Builds an Expo deep link for Supabase auth emails (tunnel, LAN, or prodyai://).
 */
export function getAuthRedirectUrl(routePath: string): string {
  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri?.includes('.exp.direct') || hostUri) {
    const [host, port] = hostUri.split(':');
    const portSuffix = port ? `:${port}` : '';
    return `exp://${host}${portSuffix}/--${routePath}`;
  }

  return Linking.createURL(routePath, { scheme: 'prodyai' });
}

/** Sign-up email confirmation link (opens login with ?confirmed=1). */
export function getEmailConfirmationRedirectUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_EMAIL_CONFIRM_REDIRECT_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return getAuthRedirectUrl(AUTH_PATHS.loginConfirmed);
}

/** Password-reset email link (opens app on forgot-password via tunnel). */
export function getPasswordResetRedirectUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return getAuthRedirectUrl(AUTH_PATHS.forgotPasswordRecovery);
}

/** HTTPS tunnel variant for Supabase redirect allow-list. */
export function getAuthRedirectUrlHttps(routePath: string): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri?.includes('.exp.direct')) {
    return null;
  }

  const [host, port] = hostUri.split(':');
  const portSuffix = port ? `:${port}` : '';
  return `https://${host}${portSuffix}/--${routePath}`;
}

export function getEmailConfirmationRedirectUrlHttps(): string | null {
  return getAuthRedirectUrlHttps(AUTH_PATHS.loginConfirmed);
}

export function getPasswordResetRedirectUrlHttps(): string | null {
  return getAuthRedirectUrlHttps(AUTH_PATHS.forgotPassword);
}

/** Dev helper: log all redirect URLs to add in Supabase Auth settings. */
export function logAuthRedirectUrls(): void {
  if (!__DEV__) {
    return;
  }
  console.log('[auth] Add these to Supabase → Authentication → URL configuration → Redirect URLs:');
  console.log('  Email confirm (exp):', getEmailConfirmationRedirectUrl());
  const confirmHttps = getEmailConfirmationRedirectUrlHttps();
  if (confirmHttps) {
    console.log('  Email confirm (https):', confirmHttps);
  }
  console.log('  Password reset (exp):', getPasswordResetRedirectUrl());
  const resetHttps = getPasswordResetRedirectUrlHttps();
  if (resetHttps) {
    console.log('  Password reset (https):', resetHttps);
  }
}
