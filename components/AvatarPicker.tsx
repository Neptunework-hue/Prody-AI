import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, Alert, Dimensions } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';

interface AvatarPickerProps {
  selectedAvatar: string | null;
  onSelectAvatar: (avatarUrl: string) => void;
  visible: boolean;
  onClose: () => void;
}

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Avatar options with both images and fallback colors
const AVATAR_OPTIONS = [
  { id: 'avatar1', name: 'Avatar 1', source: require('../assets/avatar-pics/avatar1.png'), color: '#FF6B6B' },
  { id: 'avatar2', name: 'Avatar 2', source: require('../assets/avatar-pics/avatar2.png'), color: '#4ECDC4' },
  { id: 'avatar3', name: 'Avatar 3', source: require('../assets/avatar-pics/avatar3.png'), color: '#45B7D1' },
  { id: 'avatar4', name: 'Avatar 4', source: require('../assets/avatar-pics/avatar4.png'), color: '#96CEB4' },
  { id: 'avatar5', name: 'Avatar 5', source: require('../assets/avatar-pics/avatar5.png'), color: '#FFEAA7' },
  { id: 'avatar6', name: 'Avatar 6', source: require('../assets/avatar-pics/avatar6.png'), color: '#DDA0DD' },
  { id: 'avatar7', name: 'Avatar 7', source: require('../assets/avatar-pics/avatar7.png'), color: '#FFB6C1' },
  { id: 'avatar8', name: 'Avatar 8', source: require('../assets/avatar-pics/avatar8.png'), color: '#F4A460' },
  { id: 'avatar9', name: 'Avatar 9', source: require('../assets/avatar-pics/avatar9.png'), color: '#98FB98' },
  { id: 'avatar10', name: 'Avatar 10', source: require('../assets/avatar-pics/avatar10.png'), color: '#87CEEB' },
  { id: 'avatar11', name: 'Avatar 11', source: require('../assets/avatar-pics/avatar11.png'), color: '#F0E68C' },
  { id: 'avatar12', name: 'Avatar 12', source: require('../assets/avatar-pics/avatar12.png'), color: '#FF69B4' },
  { id: 'avatar13', name: 'Avatar 13', source: require('../assets/avatar-pics/avatar13.png'), color: '#FF6B6B' },
  { id: 'avatar14', name: 'Avatar 14', source: require('../assets/avatar-pics/avatar14.png'), color: '#4ECDC4' },
  { id: 'avatar15', name: 'Avatar 15', source: require('../assets/avatar-pics/avatar15.png'), color: '#45B7D1' },
  { id: 'avatar16', name: 'Avatar 16', source: require('../assets/avatar-pics/avatar16.png'), color: '#96CEB4' },
  { id: 'avatar17', name: 'Avatar 17', source: require('../assets/avatar-pics/avatar17.png'), color: '#FFEAA7' },
];

export default function AvatarPicker({ selectedAvatar, onSelectAvatar, visible, onClose }: AvatarPickerProps) {
  const theme = useTheme();
  const [failedImages, setFailedImages] = useState<{ [key: string]: boolean }>({});

  const handleSelectAvatar = (avatar: any) => {
    console.log('Avatar selected:', avatar.id);
    onSelectAvatar(avatar.id);
    onClose();
  };

  const handleImageError = (avatarId: string) => {
    console.log('Image failed to load for:', avatarId);
    setFailedImages(prev => ({ ...prev, [avatarId]: true }));
  };

  const renderAvatar = (avatar: any, index: number) => {
    const isSelected = selectedAvatar === avatar.id;
    const imageFailed = failedImages[avatar.id];

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.avatarItem,
          isSelected && styles.selectedAvatar
        ]}
        onPress={() => handleSelectAvatar(avatar)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarContainer, isSelected && styles.selectedAvatarBorder]}>
          {imageFailed ? (
            // Fallback colored circle
            <View style={[styles.fallbackAvatar, { backgroundColor: avatar.color }]}>
              <Text style={styles.fallbackText}>{index + 1}</Text>
            </View>
          ) : (
            // Actual image
            <Image
              source={avatar.source}
              style={styles.avatarImage}
              resizeMode="cover"
              onError={() => handleImageError(avatar.id)}
            />
          )}
        </View>
        
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <IconButton
              icon="check"
              size={16}
              iconColor="#fff"
              style={styles.checkIcon}
            />
          </View>
        )}
        <Text style={styles.avatarName}>{avatar.name}</Text>
      </TouchableOpacity>
    );
  };

  console.log('AvatarPicker render - visible:', visible, 'avatars count:', AVATAR_OPTIONS.length);

  if (!visible) {
    console.log('AvatarPicker: Modal not visible');
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Avatar</Text>
            <IconButton
              icon="close"
              onPress={onClose}
              style={styles.closeButton}
            />
          </View>
          
          <View style={styles.contentContainer}>
            <Text style={styles.subtitle}>Available Avatars: {AVATAR_OPTIONS.length}</Text>
            
            <ScrollView 
              style={styles.avatarGrid}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.scrollContent}
              bounces={true}
            >
              <View style={styles.gridContainer}>
                {AVATAR_OPTIONS.map((avatar, index) => renderAvatar(avatar, index))}
              </View>
            </ScrollView>
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Choose from your avatar collection
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: screenWidth - 20,
    height: screenHeight * 0.85,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
  closeButton: {
    margin: 0,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  contentContainer: {
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  avatarGrid: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  avatarItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 24,
    padding: 8,
    borderRadius: 16,
    position: 'relative',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedAvatar: {
    backgroundColor: '#E3F2FD',
    borderWidth: 3,
    borderColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOpacity: 0.3,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#e0e0e0',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  fallbackAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  selectedAvatarBorder: {
    borderWidth: 4,
    borderColor: '#2196F3',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  checkIcon: {
    margin: 0,
  },
  avatarName: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
}); 