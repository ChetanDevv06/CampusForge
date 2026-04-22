import * as ImageManipulator from 'expo-image-manipulator';
import { storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';export const uploadImage = async (uri: string, path: string): Promise<string> => {
  console.log(`Starting Image Upload to Firebase Storage: URI=${uri.substring(0, 50)}...`);
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, `${path}/${filename}`);
    
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    console.log(`Image uploaded successfully. URL: ${downloadURL}`);
    return downloadURL;
  } catch (error: any) {
    console.error("Image Upload Error: ", error);
    throw new Error(`Failed to upload photo: ${error.message}`);
  }
};

export const uploadVideoToStorage = async (uri: string, path: string): Promise<string> => {
  console.log(`Starting Video Upload to Firebase Storage: URI=${uri.substring(0, 50)}...`);
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
    const storageRef = ref(storage, `${path}/${filename}`);
    
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    console.log(`Video uploaded successfully. URL: ${downloadURL}`);
    return downloadURL;
  } catch (error: any) {
    console.error("Video Upload Error: ", error);
    throw new Error(`Failed to upload video: ${error.message}`);
  }
};
