import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleReset = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    const { error: resetError } = await resetPassword(email);
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          A password reset link has been sent to {email}
        </Text>
        <Button mode="contained" onPress={() => router.replace('/(auth)/login')} style={styles.button}>
          Back to Login
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Reset Password</Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      {error ? <HelperText type="error" visible={!!error}>{error}</HelperText> : null}
      <Button mode="contained" onPress={handleReset} loading={loading} disabled={loading} style={styles.button}>
        Send Reset Link
      </Button>
      <Button mode="text" onPress={() => router.replace('/(auth)/login')} style={styles.button}>
        Back to Login
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { textAlign: 'center', marginBottom: 10 },
  subtitle: { textAlign: 'center', marginBottom: 30, opacity: 0.7 },
  input: { marginBottom: 15 },
  button: { marginTop: 10 },
});
