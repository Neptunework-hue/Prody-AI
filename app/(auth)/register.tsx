import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import {
  TextInput,
  Button,
  Text,
  HelperText,
} from 'react-native-paper';

import { Link, router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signUp } = useAuth();

  const validateForm = () => {
    if (!email || !username || !password || !confirmPassword) {
      setError('All fields are required');
      return false;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    const { error: signUpError } = await signUp(
      email,
      password,
      username
    );

    if (signUpError) {
      setError('Registration failed');
    } else {
      router.replace('/(auth)/login');
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Background */}
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.glowThree} />

      <Text style={[styles.star, styles.starOne]}>✦</Text>
      <Text style={[styles.star, styles.starTwo]}>✧</Text>
      <Text style={[styles.star, styles.starThree]}>✦</Text>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>✦</Text>
        </View>

        <Text style={styles.title}>Create Account</Text>

        <Text style={styles.subtitle}>
          Join ProdyAI and start your productivity journey.
        </Text>

        <TextInput
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
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

        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
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
          <HelperText
            type="error"
            visible={!!error}
            style={styles.errorText}
          >
            {error}
          </HelperText>
        ) : null}

        <Button
          mode="contained"
          onPress={handleRegister}
          loading={loading}
          disabled={loading}
          style={styles.registerButton}
          buttonColor="#f5a623"
          textColor="#15121a"
          labelStyle={styles.registerLabel}
        >
          Register
        </Button>

        <View style={styles.links}>
          <Link href="/(auth)/login" asChild>
            <Button
              mode="text"
              textColor="#f5a623"
              labelStyle={styles.linkText}
            >
              Already have an account? Login
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
    backgroundColor: 'rgba(245,166,35,0.12)',
    top: -100,
    left: -120,
  },

  glowTwo: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(112,72,232,0.20)',
    bottom: -160,
    right: -130,
  },

  glowThree: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245,166,35,0.08)',
    top: '40%',
    right: -90,
  },

  star: {
    position: 'absolute',
    color: '#f5a623',
    opacity: 0.8,
  },

  starOne: {
    top: 90,
    left: 40,
    fontSize: 16,
  },

  starTwo: {
    top: 180,
    right: 70,
    fontSize: 12,
  },

  starThree: {
    bottom: 130,
    left: 70,
    fontSize: 14,
  },

  card: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: 'rgba(23,21,31,0.95)',
    borderRadius: 30,
    padding: 26,
    borderWidth: 1,
    borderColor: '#5c5278',
    shadowColor: '#f5a623',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10,
    },
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

  registerButton: {
    borderRadius: 18,
    paddingVertical: 6,
    marginTop: 8,
    shadowColor: '#f5a623',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },

  registerLabel: {
    fontSize: 16,
    fontWeight: '700',
  },

  links: {
    marginTop: 18,
    alignItems: 'center',
  },

  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});