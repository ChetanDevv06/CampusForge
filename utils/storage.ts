import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

/**
 * Uploads an image to Firebase Storage and returns the public download URL.
 * 
 * @param uri - The local URI of the image to process.
 * @param path - The destination path in Firebase Storage (e.g. 'users/123/avatar').
 * @returns A promise that resolves to the download URL string.
 */
export const uploadImage = async (uri: string, path: string): Promise<string> => {
  console.log(`Starting Cloud upload: URI=${uri}, Path=${path}`);
  
  try {
    // 1. Process and compress the image locally first to optimize upload
    // We use a larger max dimension of 1200px for high resolution
    const processed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }], // High resolution
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 2. Convert the processed image URI to a Blob for Firebase Storage
    const response = await fetch(processed.uri);
    const blob = await response.blob();

    // 3. Upload to Firebase Storage
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, blob);

    // 4. Get the public download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`Image uploaded successfully. URL: ${downloadURL}`);
    return downloadURL;

  } catch (error: any) {
    console.error("Cloud Upload Error: ", error);
    throw new Error(`Failed to upload photo: ${error.message}`);
  }
};
