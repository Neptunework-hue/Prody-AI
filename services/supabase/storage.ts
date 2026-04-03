import { supabase } from './client';

export const storageService = {
  // Upload avatar image
  uploadAvatar: async (file: File | Blob, fileName: string): Promise<string | null> => {
    try {
      console.log('Starting avatar upload for file:', fileName);
      console.log('File size:', file.size, 'bytes');
      
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return null;
      }

      console.log('File uploaded successfully, getting public URL...');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL generated:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error in uploadAvatar:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return null;
    }
  },

  // Delete avatar image
  deleteAvatar: async (fileName: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('avatars')
        .remove([fileName]);

      if (error) {
        console.error('Error deleting avatar:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteAvatar:', error);
      return false;
    }
  },

  // Get avatar URL
  getAvatarUrl: (fileName: string): string => {
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    return publicUrl;
  },

  // Check if storage bucket exists
  checkBucketExists: async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        console.error('Error checking buckets:', error);
        return false;
      }
      
      const avatarsBucket = data?.find(bucket => bucket.name === 'avatars');
      console.log('Avatars bucket exists:', !!avatarsBucket);
      return !!avatarsBucket;
    } catch (error) {
      console.error('Error checking bucket existence:', error);
      return false;
    }
  }
}; 