import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses an image and returns a Base64 string.
 * This avoids the need for Firebase Storage subscriptions!
 * 
 * @param uri - The local URI of the image to process.
 * @returns A promise that resolves to a Base64 data URI string.
 */
export const uploadImage = async (uri: string, path: string): Promise<string> => {
  console.log(`Starting Base64 processing: URI=${uri}, Path=${path}`);
  
  try {
    // 1. Resize and compress the image
    // We limit max dimension to 400px to keep Base64 strings small (<100KB)
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }], // Auto-scales height
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!result.base64) {
      throw new Error("Failed to generate Base64 string from image.");
    }

    const base64String = `data:image/jpeg;base64,${result.base64}`;
    console.log(`Image processed successfully. String length: ${base64String.length}`);
    
    // Safety check for Firestore document limit (1MB)
    if (base64String.length > 800000) {
      throw new Error("Image is still too large for the database. Try a smaller photo.");
    }

    return base64String;
  } catch (error: any) {
    console.error("Image Processing Error: ", error);
    throw new Error(`Failed to process photo: ${error.message}`);
  }
};
