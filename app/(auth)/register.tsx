import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
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

    const { error: signUpError } = await signUp(email, password, username);
    
    if (signUpError) {
      setError(signUpError.message);
    } else {
      // Registration successful, redirect to login
      router.replace('/(auth)/login');
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Create Account</Text>
      
      <TextInput
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TextInput
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        style={styles.input}
      />
      
      {error ? (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      ) : null}
      
      <Button 
        mode="contained" 
        onPress={handleRegister} 
        style={styles.button}
        loading={loading}
        disabled={loading}
      >
        Register
      </Button>
      
      <View style={styles.links}>
        <Link href="/(auth)/login" asChild>
          <Button mode="text">Already have an account? Login</Button>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginTop: 10,
  },
  links: {
    marginTop: 20,
    alignItems: 'center',
  },
}); 