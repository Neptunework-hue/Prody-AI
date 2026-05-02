import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError('Login failed');
      setLoading(false);
      return;
    }

    router.replace('/(app)/dashboard');
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>✦</Text>
        </View>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          Sign in to continue your productivity journey with ProdyAI.
        </Text>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          mode="outlined"
          style={styles.input}
          outlineColor="#3a3548"
          activeOutlineColor="#f5a623"
          textColor="#f4ead8"
          theme={{
            colors: {
              onSurfaceVariant: '#b8a98f',
              background: '#17151f',
            },
          }}
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          mode="outlined"
          style={styles.input}
          outlineColor="#3a3548"
          activeOutlineColor="#f5a623"
          textColor="#f4ead8"
          theme={{
            colors: {
              onSurfaceVariant: '#b8a98f',
              background: '#17151f',
            },
          }}
        />

        {error ? (
          <HelperText type="error" visible={!!error} style={styles.errorText}>
            {error}
          </HelperText>
        ) : null}

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.loginButton}
          buttonColor="#f5a623"
          textColor="#15121a"
          labelStyle={styles.loginLabel}
        >
          Login
        </Button>

        <View style={styles.links}>
          <Link href="/(auth)/register" asChild>
            <Button mode="text" textColor="#f5a623" labelStyle={styles.linkText}>
              Create Account
            </Button>
          </Link>

          <Link href="/(auth)/forgot-password" asChild>
            <Button mode="text" textColor="#b8a98f" labelStyle={styles.linkText}>
              Forgot Password?
            </Button>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0d14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#17151f',
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: '#3a3548',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    backgroundColor: '#241b14',
    borderWidth: 1,
    borderColor: '#f5a623',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  logoText: {
    color: '#f5a623',
    fontSize: 34,
    fontWeight: '700',
  },
  title: {
    color: '#f4ead8',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#b8a98f',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    marginBottom: 14,
    backgroundColor: '#17151f',
  },
  errorText: {
    marginBottom: 4,
  },
  loginButton: {
    borderRadius: 18,
    paddingVertical: 6,
    marginTop: 8,
  },
  loginLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  links: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});