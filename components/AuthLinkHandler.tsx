import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useEffect } from 'react';
import { supabase } from '../services/supabase/supabase';
import { logAuthRedirectUrls } from '../utils/authRedirect';
import {
  createSessionFromAuthUrl,
  isAuthCallbackUrl,
} from '../utils/authSessionFromUrl';

function goToPasswordResetScreen() {
  router.replace('/(auth)/forgot-password?recovery=1');
}

function goAfterEmailConfirmation() {
  void supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      router.replace('/(app)/dashboard');
    } else {
      router.replace('/(auth)/login?confirmed=1');
    }
  });
}

async function handleAuthUrl(url: string | null) {
  if (!url || !isAuthCallbackUrl(url)) {
    return;
  }

  try {
    const result = await createSessionFromAuthUrl(url);
    if (result === 'recovery') {
      goToPasswordResetScreen();
    } else if (result === 'signed_in') {
      goAfterEmailConfirmation();
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[AuthLinkHandler] Failed to handle auth URL:', error);
    }
  }
}

/**
 * Handles Supabase auth deep links: email confirmation + password reset (tunnel exp://).
 */
export default function AuthLinkHandler() {
  useEffect(() => {
    logAuthRedirectUrls();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        goToPasswordResetScreen();
      }
    });

    void Linking.getInitialURL().then(handleAuthUrl);

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      authSubscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  return null;
}
