import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, useTheme, IconButton, Switch, Divider } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useOffline } from '../../hooks/useOffline';
import { offlineService } from '../../services/offline/offlineService';
import { useRouter } from 'expo-router';
import OfflineIndicator from '../../components/OfflineIndicator';
import HamburgerMenu from '../../components/HamburgerMenu';
import Sidebar from '../../components/Sidebar';

export default function OfflineSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline, pendingOperationsCount, lastSync, syncData, clearOfflineData } = useOffline();
  const [syncing, setSyncing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please check your internet connection.');
      return;
    }

    setSyncing(true);
    try {
      await syncData();
      Alert.alert('Success', 'Data synchronized successfully!');
    } catch (error) {
      Alert.alert('Sync Failed', 'Failed to sync data. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear Offline Data',
      'This will delete all locally stored data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearOfflineData();
              Alert.alert('Success', 'Offline data cleared successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear offline data.');
            }
          }
        }
      ]
    );
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    return new Date(lastSync).toLocaleString();
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <HamburgerMenu onPress={() => setSidebarVisible(true)} isOpen={sidebarVisible} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Offline Settings</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Connection Status */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statusRow}>
              <Text style={styles.cardTitle}>Connection Status</Text>
              <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }]}>
                <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
            <Text style={styles.statusDescription}>
              {isOnline 
                ? 'Your device is connected to the internet. All changes will be synced automatically.'
                : 'Your device is offline. Changes will be saved locally and synced when you reconnect.'
              }
            </Text>
          </Card.Content>
        </Card>

        {/* Sync Status */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Sync Status</Text>
            <View style={styles.syncInfo}>
              <Text style={styles.syncLabel}>Last Sync:</Text>
              <Text style={styles.syncValue}>{formatLastSync()}</Text>
            </View>
            <View style={styles.syncInfo}>
              <Text style={styles.syncLabel}>Pending Changes:</Text>
              <Text style={styles.syncValue}>{pendingOperationsCount}</Text>
            </View>
            <Button
              mode="contained"
              onPress={handleSync}
              loading={syncing}
              disabled={!isOnline || syncing}
              style={styles.syncButton}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </Card.Content>
        </Card>

        {/* Offline Features */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Offline Features</Text>
            <View style={styles.featureRow}>
              <Text style={styles.featureText}>Create Tasks</Text>
              <Text style={styles.featureStatus}>✓ Available</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureText}>Edit Tasks</Text>
              <Text style={styles.featureStatus}>✓ Available</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureText}>Delete Tasks</Text>
              <Text style={styles.featureStatus}>✓ Available</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureText}>Focus Sessions</Text>
              <Text style={styles.featureStatus}>✓ Available</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureText}>AI Chat</Text>
              <Text style={styles.featureStatus}>⚠ Limited</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Data Management */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Data Management</Text>
            <Text style={styles.dataDescription}>
              Manage your locally stored data and sync settings.
            </Text>
            <Button
              mode="outlined"
              onPress={handleClearData}
              style={styles.clearButton}
              textColor="#F44336"
            >
              Clear Offline Data
            </Button>
          </Card.Content>
        </Card>

        {/* Tips */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Offline Tips</Text>
            <Text style={styles.tipText}>• Create tasks while offline - they'll sync when you reconnect</Text>
            <Text style={styles.tipText}>• Focus sessions work completely offline</Text>
            <Text style={styles.tipText}>• AI features require internet connection</Text>
            <Text style={styles.tipText}>• Sync manually if automatic sync fails</Text>
          </Card.Content>
        </Card>
      </ScrollView>

      <OfflineIndicator />
      
      {/* Settings Sidebar */}
      <Sidebar 
        isVisible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  syncInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  syncLabel: {
    fontSize: 14,
    color: '#666',
  },
  syncValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  syncButton: {
    marginTop: 12,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  featureText: {
    fontSize: 14,
    color: '#222',
  },
  featureStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  dataDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  clearButton: {
    borderColor: '#F44336',
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
}); 