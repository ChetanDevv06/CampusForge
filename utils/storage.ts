import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebaseConfig";

/**
 * Uploads an image to Firebase Storage and returns the download URL.
 * 
 * @param uri - The local URI of the image to upload.
 * @param path - The path in storage where the image should be saved (e.g., "lost_found").
 * @returns A promise that resolves to the download URL.
 */
export const uploadImage = async (uri: string, path: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = uri.split('/').pop() || Date.now().toString();
    const storageRef = ref(storage, `${path}/${Date.now()}_${filename}`);
    
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error uploading image: ", error);
    throw error;
  }
};
