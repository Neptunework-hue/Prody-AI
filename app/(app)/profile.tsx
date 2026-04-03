import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { Text, TextInput, Button, Card, Divider, useTheme, IconButton } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';
import SetupChecker from '../../components/SetupChecker';
import AvatarPicker from '../../components/AvatarPicker';
import BottomNavBar from '../../components/BottomNavBar';
import UserAvatar from '../../components/UserAvatar';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, session, signOut } = useAuth();
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSetupChecker, setShowSetupChecker] = useState(false);
  const [isAvatarPickerVisible, setIsAvatarPickerVisible] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.user_metadata?.username || user.email?.split('@')[0] || '');
      setAvatarUrl(user.user_metadata?.avatar_url || null);
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          username: username,
          avatar_url: avatarUrl,
        }
      });

      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      } else {
        Alert.alert('Success', 'Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAvatar = (selectedAvatarUrl: string) => {
    console.log('Profile: Avatar selected:', selectedAvatarUrl);
    setAvatarUrl(selectedAvatarUrl);
  };

  const handleOpenAvatarPicker = () => {
    console.log('Profile: Opening avatar picker');
    setIsAvatarPickerVisible(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Please log in to view your profile.</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
          </View>
          
          <View style={styles.avatarSection}>
            <UserAvatar
              size={100}
              showBorder={true}
              borderColor="#7B61FF"
              style={styles.profileAvatar}
            />
            <Button
              mode="outlined"
              onPress={handleOpenAvatarPicker}
              style={styles.avatarButton}
              icon="account-edit"
            >
              Choose Avatar
            </Button>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            <TextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
            />

            <TextInput
              label="Email"
              value={user.email || ''}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="email" />}
              disabled
            />

            <TextInput
              label="User ID"
              value={user.id}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="identifier" />}
              disabled
            />
          </View>

          <Divider style={styles.divider} />

          <View style={styles.buttonSection}>
            <Button
              mode="contained"
              onPress={handleUpdateProfile}
              loading={loading}
              disabled={loading}
              style={styles.updateButton}
              icon="content-save"
            >
              Update Profile
            </Button>

            <Button
              mode="outlined"
              onPress={() => setShowSetupChecker(true)}
              style={styles.troubleshootButton}
              icon="wrench"
            >
              Troubleshoot
            </Button>

            <Button
              mode="outlined"
              onPress={handleSignOut}
              style={styles.signOutButton}
              icon="logout"
              textColor={theme.colors.error}
            >
              Sign Out
            </Button>
          </View>
        </Card.Content>
      </Card>

      <AvatarPicker
        selectedAvatar={avatarUrl}
        onSelectAvatar={handleSelectAvatar}
        visible={isAvatarPickerVisible}
        onClose={() => {
          console.log('Profile: Closing avatar picker');
          setIsAvatarPickerVisible(false);
        }}
      />

      {showSetupChecker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Storage Setup Checker</Text>
              <IconButton
                icon="close"
                onPress={() => setShowSetupChecker(false)}
                style={styles.closeButton}
              />
            </View>
            <SetupChecker onComplete={() => setShowSetupChecker(false)} />
          </View>
        </View>
      )}
      
      <BottomNavBar />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Account for bottom navigation
  },
  card: {
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarButton: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  input: {
    marginBottom: 16,
  },
  buttonSection: {
    gap: 12,
  },
  updateButton: {
    marginBottom: 8,
  },
  troubleshootButton: {
    marginBottom: 8,
  },
  signOutButton: {
    marginTop: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  closeButton: {
    margin: 0,
  },
  profileAvatar: {
    marginBottom: 16,
  },
}); 