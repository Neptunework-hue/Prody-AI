import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import 'react-native-url-polyfill/auto';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Or a loading spinner
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Always redirect to dashboard after login
  return <Redirect href="/(app)/dashboard" />;
} 