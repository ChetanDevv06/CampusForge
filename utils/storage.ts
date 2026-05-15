import * as ImageManipulator from 'expo-image-manipulator';

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/**
 * Uploads an image to Cloudinary.
 * This replaces the legacy Base64-in-Firestore approach for better performance and CDN delivery.
 */
export const uploadImage = async (uri: string, path: string): Promise<string> => {
  console.log(`☁️ [Cloudinary] Preparing upload for: ${uri.substring(0, 50)}...`);
  
  try {
    // 1. Optional: Optimize locally before upload to save user data
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }], // High quality but reasonable size
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 2. Prepare the form data
    const data = new FormData();
    // @ts-ignore - React Native FormData requires this structure
    data.append('file', {
      uri: manipResult.uri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    });
    data.append('upload_preset', UPLOAD_PRESET || '');
    data.append('cloud_name', process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '');
    data.append('moderation', 'aws_rek');

    // 3. Execute the upload
    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      body: data,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    console.log(`✅ [Cloudinary] Upload success: ${result.secure_url}`);
    return result.secure_url;
  } catch (error: any) {
    console.error("❌ [Cloudinary] Error: ", error);
    throw new Error(`Cloudinary Upload Failed: ${error.message}`);
  }
};

/**
 * Videos can also be uploaded to Cloudinary.
 */
export const uploadVideoToStorage = async (uri: string, path: string): Promise<string> => {
  console.log(`☁️ [Cloudinary] Preparing video upload...`);
  
  try {
    const CLOUDINARY_VIDEO_URL = `https://api.cloudinary.com/v1_1/${process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`;
    
    const data = new FormData();
    // @ts-ignore
    data.append('file', {
      uri: uri,
      type: 'video/mp4',
      name: 'video.mp4',
    });
    data.append('upload_preset', UPLOAD_PRESET || '');

    const response = await fetch(CLOUDINARY_VIDEO_URL, {
      method: 'POST',
      body: data,
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error.message);

    return result.secure_url;
  } catch (error: any) {
    console.error("❌ [Cloudinary] Video Error: ", error);
    throw new Error(`Video Upload Failed: ${error.message}`);
  }
};
