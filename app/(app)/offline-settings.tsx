import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text } from 'react-native';
import { Button } from 'react-native-paper';
import { useOffline } from '../../hooks/useOffline';
import OfflineIndicator from '../../components/OfflineIndicator';
import Sidebar from '../../components/Sidebar';
import QuestLogScreenHeader from '../../components/QuestLogScreenHeader';
import { FONT_SERIF, type ThemeColors } from '../../constants/lifeTrackerDesign';
import { useAppTheme } from '../../contexts/AppThemeContext';

function createOfflineSettingsStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    panel: {
      backgroundColor: c.surf,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderDefault,
      padding: 16,
      marginBottom: 14,
    },
    sectionTitle: {
      fontFamily: FONT_SERIF,
      fontSize: 17,
      fontWeight: '600',
      color: c.tx,
      marginBottom: 10,
    },
    rowTitle: {
      fontFamily: FONT_SERIF,
      fontSize: 17,
      fontWeight: '600',
      color: c.tx,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 10,
      borderWidth: 1,
    },
    statusPillOnline: {
      backgroundColor: c.tealBg,
      borderColor: c.tealBorder,
    },
    statusPillOffline: {
      backgroundColor: c.pinkBg,
      borderColor: c.pinkBorder,
    },
    statusPillText: {
      fontFamily: FONT_SERIF,
      fontSize: 12,
      fontWeight: '700',
    },
    statusTextOnline: {
      color: c.teal,
    },
    statusTextOffline: {
      color: c.pink,
    },
    body: {
      fontFamily: FONT_SERIF,
      fontSize: 14,
      lineHeight: 21,
      color: c.tx2,
    },
    kvRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    label: {
      fontFamily: FONT_SERIF,
      fontSize: 14,
      color: c.tx2,
    },
    value: {
      fontFamily: FONT_SERIF,
      fontSize: 14,
      fontWeight: '600',
      color: c.tx,
    },
    primaryBtn: {
      marginTop: 8,
      borderRadius: 10,
    },
    featureRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    featureLabel: {
      fontFamily: FONT_SERIF,
      fontSize: 14,
      color: c.tx,
    },
    featureOk: {
      fontFamily: FONT_SERIF,
      fontSize: 13,
      fontWeight: '600',
      color: c.teal,
    },
    featureWarn: {
      fontFamily: FONT_SERIF,
      fontSize: 13,
      fontWeight: '600',
      color: c.amber,
    },
    dangerBtn: {
      marginTop: 12,
      borderColor: 'rgba(229,115,115,0.45)',
      borderRadius: 10,
    },
    dangerBtnLabel: {
      fontFamily: FONT_SERIF,
    },
    tipLine: {
      fontFamily: FONT_SERIF,
      fontSize: 14,
      lineHeight: 22,
      color: c.tx2,
      marginBottom: 8,
    },
  });
}

export default function OfflineSettingsScreen() {
  const { isOnline, pendingOperationsCount, lastSync, syncData, clearOfflineData } = useOffline();
  const [syncing, setSyncing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createOfflineSettingsStyles(c), [c]);

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline. Please check your internet connection.');
      return;
    }

    setSyncing(true);
    try {
      await syncData();
      Alert.alert('Success', 'Data synchronized successfully!');
    } catch {
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
            } catch {
              Alert.alert('Error', 'Failed to clear offline data.');
            }
          },
        },
      ],
    );
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    return new Date(lastSync).toLocaleString();
  };

  return (
    <View style={styles.root}>
      <QuestLogScreenHeader
        title="Settings"
        sidebarVisible={sidebarVisible}
        onOpenSidebar={() => setSidebarVisible(true)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.panel}>
          <View style={styles.statusRow}>
            <Text style={styles.rowTitle}>Connection</Text>
            <View
              style={[
                styles.statusPill,
                isOnline ? styles.statusPillOnline : styles.statusPillOffline,
              ]}
            >
              <Text style={[styles.statusPillText, isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <Text style={styles.body}>
            {isOnline
              ? 'Your device is connected. Changes sync when possible.'
              : 'You are offline. Changes are saved locally and will sync when you reconnect.'}
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Sync</Text>
          <View style={styles.kvRow}>
            <Text style={styles.label}>Last sync</Text>
            <Text style={styles.value}>{formatLastSync()}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.label}>Pending changes</Text>
            <Text style={styles.value}>{pendingOperationsCount}</Text>
          </View>
          <Button
            mode="contained"
            onPress={handleSync}
            loading={syncing}
            disabled={!isOnline || syncing}
            style={styles.primaryBtn}
            buttonColor={c.amber}
            textColor={c.onAccent}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Offline support</Text>
          <View style={styles.featureRow}>
            <Text style={styles.featureLabel}>Create tasks</Text>
            <Text style={styles.featureOk}>Available</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureLabel}>Edit tasks</Text>
            <Text style={styles.featureOk}>Available</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureLabel}>Delete tasks</Text>
            <Text style={styles.featureOk}>Available</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureLabel}>Focus sessions</Text>
            <Text style={styles.featureOk}>Available</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureLabel}>AI chat</Text>
            <Text style={styles.featureWarn}>Limited</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Local data</Text>
          <Text style={styles.body}>Remove cached data on this device. Your account on the server is unchanged.</Text>
          <Button
            mode="outlined"
            onPress={handleClearData}
            style={styles.dangerBtn}
            textColor="#e57373"
            labelStyle={styles.dangerBtnLabel}
          >
            Clear offline data
          </Button>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Tips</Text>
          <Text style={styles.tipLine}>Tasks you add offline sync when you are back online.</Text>
          <Text style={styles.tipLine}>Focus sessions work fully offline.</Text>
          <Text style={styles.tipLine}>AI features need a network connection.</Text>
          <Text style={styles.tipLine}>Use “Sync now” if something looks out of date.</Text>
        </View>
      </ScrollView>

      <OfflineIndicator />

      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
}
