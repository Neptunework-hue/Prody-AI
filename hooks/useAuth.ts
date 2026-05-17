import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase/supabase';
import { Session, User } from '@supabase/supabase-js';
import {
  getEmailConfirmationRedirectUrl,
  getPasswordResetRedirectUrl,
} from '../utils/authRedirect';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

interface Profile {
  id: string;
  email: string;
  username: string;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));
    });

    // Optional dev check — skip noisy logs when API is unreachable (521, offline, etc.)
    verifyProfilesTable();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const verifyProfilesTable = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .select('id, email, username')
        .limit(1);

      if (error) {
        const msg = String((error as { message?: string }).message ?? '');
        const isUnreachable =
          msg.includes('521') ||
          msg.includes('Network') ||
          msg.includes('fetch') ||
          msg.includes('Failed to fetch');
        if (isUnreachable) {
          if (__DEV__) {
            console.warn(
              '[useAuth] Skipping profiles check: API unreachable (network or server).',
            );
          }
          return;
        }
        if (__DEV__) {
          console.warn('Error verifying profiles table:', error);
        }
        if (error.code === '42P01') {
          console.warn('Profiles table does not exist. Run your Supabase SQL migrations.');
        }
      } else if (__DEV__) {
        console.log('Profiles table verified successfully');
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('Unexpected error verifying profiles table:', error);
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting login with email:', email);
      // Only allow login with email
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) {
        console.log('Email login successful');
        return { error: null };
      } else {
        console.log('Email login failed:', error);
      return { error };
      }
    } catch (error) {
      console.log('Unexpected error during login:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    try {
      console.log('Starting registration for:', { email, username });
      
      // First check if username is already taken
      const { data: existingProfiles, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username);

      if (checkError) {
        console.log('Error checking username:', checkError);
        return { error: new Error('Error checking username availability') };
      }

      if (existingProfiles && existingProfiles.length > 0) {
        console.log('Username already taken:', username);
        return { error: new Error('Username is already taken') };
      }

      const emailRedirectTo = getEmailConfirmationRedirectUrl();
      if (__DEV__) {
        console.log('[useAuth] Sign-up emailRedirectTo:', emailRedirectTo);
      }

      // Create auth user
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo,
        },
      });

      if (signUpError) {
        console.log('Error during auth signup:', signUpError);
        return { error: signUpError };
      }

      if (!user) {
        console.log('No user returned from signup');
        return { error: new Error('Failed to create user') };
      }

      console.log('Auth user created with ID:', user.id);
      
      // Wait a moment to ensure the auth user is fully created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create profile via RPC (bypasses RLS safely)
      const { error: profileError } = await supabase.rpc('create_profile', {
        user_id: user.id,
        user_email: email,
        user_username: username,
      });

      if (profileError) {
        console.warn('Error creating profile via RPC:', profileError);
        return { error: profileError };
      }

      console.log('Profile created successfully');
      return { error: null };
    } catch (error) {
      console.log('Unexpected error during registration:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  /**
   * Whether this email can reset a password (checks auth.users + profiles via RPC).
   * If RPC is not deployed yet, falls back without blocking auth-only accounts.
   */
  const checkEmailRegistered = async (email: string) => {
    try {
      const normalized = normalizeEmail(email);

      const { data: rpcExists, error: rpcError } = await supabase.rpc(
        'email_exists_for_reset',
        { check_email: normalized },
      );

      if (!rpcError && rpcExists === true) {
        return { exists: true, error: null };
      }
      if (!rpcError && rpcExists === false) {
        return { exists: false, error: null };
      }

      if (__DEV__ && rpcError) {
        console.warn(
          '[useAuth] email_exists_for_reset RPC missing — run docs/password_reset_email_check.sql',
          rpcError,
        );
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', normalized)
        .limit(1);

      if (!profileError && (profiles?.length ?? 0) > 0) {
        return { exists: true, error: null };
      }

      // Account may exist in auth.users without a profiles row — still allow reset email
      return { exists: true, error: null, uncertain: true as const };
    } catch (error) {
      return { exists: true, error, uncertain: true as const };
    }
  };

  /**
   * Sends password-reset email with tunnel deep link + 6-digit code ({{ .Token }} in Supabase template).
   * See docs/supabase_password_reset_email_template.md
   */
  const sendPasswordResetEmail = async (email: string) => {
    try {
      const redirectTo = getPasswordResetRedirectUrl();
      if (__DEV__) {
        console.log('[useAuth] Password reset redirectTo (tunnel):', redirectTo);
        console.log(
          '[useAuth] Ensure Supabase → Auth → Email Templates → Reset password includes {{ .Token }}',
        );
      }
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
        redirectTo,
      });
      return { error, redirectTo };
    } catch (error) {
      return { error, redirectTo: getPasswordResetRedirectUrl() };
    }
  };

  /** Verifies the 6-digit recovery code from the reset email (fallback when link fails). */
  const verifyPasswordResetCode = async (email: string, otp: string) => {
    try {
      const normalized = normalizeEmail(email);
      const token = otp.trim();

      const { error } = await supabase.auth.verifyOtp({
        email: normalized,
        token,
        type: 'recovery',
      });

      return { error };
    } catch (error) {
      return { error };
    }
  };

  /** Sets a new password after the user opened the reset link (recovery session). */
  const updatePasswordAfterRecovery = async (newPassword: string) => {
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return { error: updateError };
      }

      await supabase.auth.signOut();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  /** Verifies recovery code (if needed) then sets the new password. */
  const completePasswordResetWithOtp = async (
    email: string,
    otp: string,
    newPassword: string,
  ) => {
    try {
      const { error: verifyError } = await verifyPasswordResetCode(email, otp);
      if (verifyError) {
        return { error: verifyError };
      }
      return updatePasswordAfterRecovery(newPassword);
    } catch (error) {
      return { error };
    }
  };

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    checkEmailRegistered,
    sendPasswordResetEmail,
    verifyPasswordResetCode,
    updatePasswordAfterRecovery,
    completePasswordResetWithOtp,
    getPasswordResetRedirectUrl,
  };
}; 