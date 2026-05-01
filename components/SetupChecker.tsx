import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, useTheme } from 'react-native-paper';
import { supabase } from '../services/supabase/client';

interface SetupCheckerProps {
  onComplete?: () => void;
}

export default function SetupChecker({ onComplete }: SetupCheckerProps) {
  const theme = useTheme();
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<{
    connection: boolean;
  }>({
    connection: false,
  });

  const runChecks = async () => {
    setChecking(true);
    
    try {
      // Check 1: Connection to Supabase
      console.log('Checking Supabase connection...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      const connectionOk = !authError && !!user;
      console.log('Connection check result:', connectionOk);
      
      setResults({
        connection: connectionOk,
      });
      
      if (connectionOk) {
        Alert.alert('Setup Complete', 'Your Supabase connection is working properly!');
        onComplete?.();
      } else {
        Alert.alert(
          'Connection Issue Found', 
          'Unable to connect to Supabase. Please check your configuration.',
          [
            { text: 'OK' },
            { text: 'View Issues', onPress: () => {
              Alert.alert('Setup Issues', '• Supabase connection failed\n• Check your API keys and configuration');
            }}
          ]
        );
      }
    } catch (error) {
      console.error('Setup check error:', error);
      Alert.alert('Check Failed', 'Failed to run setup checks. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runChecks();
  }, []);

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.title}>Supabase Setup Checker</Text>
        <Text style={styles.subtitle}>Verifying your configuration...</Text>
        
        <View style={styles.checkList}>
          <View style={styles.checkItem}>
            <Text style={[styles.checkText, results.connection && styles.checkPassed]}>
              {results.connection ? '✓' : '○'} Supabase Connection
            </Text>
          </View>
        </View>
        
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Avatar System</Text>
          <Text style={styles.infoText}>
            The app now uses predefined avatars from reliable external services. 
            No storage bucket is required for avatar functionality.
          </Text>
        </View>
        
        <Button
          mode="contained"
          onPress={runChecks}
          loading={checking}
          style={styles.button}
        >
          {checking ? 'Checking...' : 'Re-run Checks'}
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  checkList: {
    marginBottom: 16,
  },
  checkItem: {
    marginBottom: 8,
  },
  checkText: {
    fontSize: 16,
    color: '#666',
  },
  checkPassed: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  button: {
    backgroundColor: '#7B61FF',
  },
}); 