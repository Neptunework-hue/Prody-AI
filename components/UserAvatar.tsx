import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Avatar, useTheme } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';

// Avatar mapping for local images
const AVATAR_IMAGES = {
  avatar1: require('../assets/avatar-pics/avatar1.png'),
  avatar2: require('../assets/avatar-pics/avatar2.png'),
  avatar3: require('../assets/avatar-pics/avatar3.png'),
  avatar4: require('../assets/avatar-pics/avatar4.png'),
  avatar5: require('../assets/avatar-pics/avatar5.png'),
  avatar6: require('../assets/avatar-pics/avatar6.png'),
  avatar7: require('../assets/avatar-pics/avatar7.png'),
  avatar8: require('../assets/avatar-pics/avatar8.png'),
  avatar9: require('../assets/avatar-pics/avatar9.png'),
  avatar10: require('../assets/avatar-pics/avatar10.png'),
  avatar11: require('../assets/avatar-pics/avatar11.png'),
  avatar12: require('../assets/avatar-pics/avatar12.png'),
  avatar13: require('../assets/avatar-pics/avatar13.png'),
  avatar14: require('../assets/avatar-pics/avatar14.png'),
  avatar15: require('../assets/avatar-pics/avatar15.png'),
  avatar16: require('../assets/avatar-pics/avatar16.png'),
  avatar17: require('../assets/avatar-pics/avatar17.png'),
};

interface UserAvatarProps {
  size?: number;
  style?: any;
  showBorder?: boolean;
  borderColor?: string;
}

export default function UserAvatar({ 
  size = 40, 
  style, 
  showBorder = false, 
  borderColor = '#2196F3' 
}: UserAvatarProps) {
  const theme = useTheme();
  const { user, session } = useAuth();
  
  const avatarUrl = user?.user_metadata?.avatar_url || session?.user?.user_metadata?.avatar_url;

  const renderAvatar = () => {
    if (!avatarUrl) {
      // Default avatar with user initials or emoji
      const userName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'U';
      const initials = userName.substring(0, 2).toUpperCase();
      
      return (
        <View style={[styles.defaultAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
          <Avatar.Text 
            size={size} 
            label={initials}
            style={styles.avatarText}
            color="#fff"
          />
        </View>
      );
    }

    // Check if it's a valid avatar ID with local image
    if (AVATAR_IMAGES[avatarUrl]) {
      return (
        <View style={[
          styles.avatarContainer, 
          { 
            width: size, 
            height: size, 
            borderRadius: size / 2,
            borderWidth: showBorder ? 3 : 0,
            borderColor: borderColor
          },
          style
        ]}>
          <Image
            source={AVATAR_IMAGES[avatarUrl]}
            style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
            resizeMode="cover"
          />
        </View>
      );
    }

    // Fallback to default avatar
    const userName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'U';
    const initials = userName.substring(0, 2).toUpperCase();
    
    return (
      <View style={[styles.defaultAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Avatar.Text 
          size={size} 
          label={initials}
          style={styles.avatarText}
          color="#fff"
        />
      </View>
    );
  };

  return renderAvatar();
}

const styles = StyleSheet.create({
  avatarContainer: {
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  avatarText: {
    // Removed invalid properties
  },
}); 