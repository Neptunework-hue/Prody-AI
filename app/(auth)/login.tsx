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
      {/* Background decoration */}
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.glowThree} />

      <Text style={[styles.star, styles.starOne]}>✦</Text>
      <Text style={[styles.star, styles.starTwo]}>✧</Text>
      <Text style={[styles.star, styles.starThree]}>✦</Text>
      <Text style={[styles.star, styles.starFour]}>✧</Text>

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
          outlineColor="#51486b"
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
          outlineColor="#51486b"
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
    backgroundColor: '#090712',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    overflow: 'hidden',
  },

  glowOne: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(245, 166, 35, 0.14)',
    top: -90,
    left: -120,
  },
  glowTwo: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(112, 72, 232, 0.20)',
    bottom: -150,
    right: -130,
  },
  glowThree: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
    top: '45%',
    right: -90,
  },

  star: {
    position: 'absolute',
    color: '#f5a623',
    opacity: 0.8,
  },
  starOne: {
    top: 90,
    left: 48,
    fontSize: 16,
  },
  starTwo: {
    top: 170,
    right: 70,
    fontSize: 12,
  },
  starThree: {
    bottom: 120,
    left: 82,
    fontSize: 14,
  },
  starFour: {
    bottom: 210,
    right: 44,
    fontSize: 18,
  },

  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: 'rgba(23, 21, 31, 0.94)',
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: '#5c5278',
    shadowColor: '#f5a623',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: 'center',
    backgroundColor: '#241b14',
    borderWidth: 1.5,
    borderColor: '#f5a623',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#f5a623',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 8,
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
    shadowColor: '#f5a623',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
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