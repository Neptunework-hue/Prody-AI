import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ybmtsusdltuqlkvzahpm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibXRzdXNkbHR1cWxrdnphaHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTA0NTAsImV4cCI6MjA5MTU4NjQ1MH0.6g7wc3d_0WAhQCckylMw4YlXx551RFor1R6ZE9GyUyc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
}); 