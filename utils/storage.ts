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
    data.append('folder', path); // Route upload into the correct Cloudinary subfolder
    // NOTE: Explicit Cloudinary moderation (like 'aws_rek') is removed because it requires an enabled
    // AWS Rekognition add-on on the specific Cloudinary account. Smart visual moderation is already
    // performed client-side using moderateWithGemini in the post forms (e.g., post-item, post-market).

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
 * Uploads an image to Cloudinary and returns both the secure URL and the delete token.
 * The delete token allows secure client-side deletion without exposing API secrets.
 */
export const uploadImageDetailed = async (uri: string, path: string): Promise<{ secure_url: string; delete_token?: string }> => {
  console.log(`☁️ [Cloudinary] Preparing detailed upload for: ${uri.substring(0, 50)}...`);
  
  try {
    // 1. Optimize locally before upload
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 2. Prepare the form data
    const data = new FormData();
    // @ts-ignore
    data.append('file', {
      uri: manipResult.uri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    });
    data.append('upload_preset', UPLOAD_PRESET || '');
    data.append('cloud_name', process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '');
    data.append('folder', path); // Route upload into the correct Cloudinary subfolder

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

    console.log(`✅ [Cloudinary] Detailed upload success: ${result.secure_url}`);
    return {
      secure_url: result.secure_url,
      delete_token: result.delete_token,
    };
  } catch (error: any) {
    console.error("❌ [Cloudinary] Detailed Error: ", error);
    throw new Error(`Cloudinary Upload Failed: ${error.message}`);
  }
};

/**
 * Deletes an image from Cloudinary client-side using its unsigned delete token.
 */
export const deleteImageFromCloudinary = async (deleteToken: string): Promise<boolean> => {
  if (!deleteToken) return false;
  console.log(`☁️ [Cloudinary] Deleting image using token...`);
  try {
    const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/delete_by_token`;
    
    const data = new FormData();
    data.append('token', deleteToken);

    const response = await fetch(url, {
      method: 'POST',
      body: data,
      headers: {
        'Accept': 'application/json',
      }
    });

    const result = await response.json();
    if (result.result === 'ok') {
      console.log(`✅ [Cloudinary] Image deleted successfully from Cloudinary`);
      return true;
    } else {
      console.warn(`⚠️ [Cloudinary] Cloudinary deletion response not ok:`, result);
      return false;
    }
  } catch (error) {
    console.error(`❌ [Cloudinary] Failed to delete image from Cloudinary:`, error);
    return false;
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
