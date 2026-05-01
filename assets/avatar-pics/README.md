# Avatar Pics Folder

This folder contains avatar images that users can choose from in the app.

## How to Add Avatar Images

1. **Image Requirements:**
   - Format: PNG or JPG
   - Size: 200x200 pixels (recommended)
   - Shape: Square (will be cropped to circle in the app)
   - File naming: `avatar1.png`, `avatar2.png`, etc.

2. **Adding New Avatars:**
   - Place your image files in this folder
   - Name them `avatar1.png`, `avatar2.png`, etc.
   - Update the `AVATAR_OPTIONS` array in `components/AvatarPicker.tsx`
   - Update the `AVATAR_IMAGES` object in `app/(app)/profile.tsx`

3. **Current Avatars:**
   - avatar1.png - Default avatar 1
   - avatar2.png - Default avatar 2
   - avatar3.png - Default avatar 3
   - avatar4.png - Default avatar 4
   - avatar5.png - Default avatar 5
   - avatar6.png - Default avatar 6
   - avatar7.png - Default avatar 7
   - avatar8.png - Default avatar 8
   - avatar9.png - Default avatar 9
   - avatar10.png - Default avatar 10
   - avatar11.png - Default avatar 11
   - avatar12.png - Default avatar 12

## Note

If you don't have actual avatar images yet, the app will show placeholder avatars. You can replace these with your own custom avatar images by following the steps above. 