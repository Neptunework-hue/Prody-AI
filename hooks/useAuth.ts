import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase/supabase';
import { Session, User } from '@supabase/supabase-js';

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

      // Create auth user
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          },
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

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error };
    } catch (error) {
      return { error };
    }
  };

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}; 