import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Converts a local image URI to a compressed Base64 string for direct Firestore storage.
 * This bypasses Firebase Storage (Standard/Premium plans) by embedding image data
 * directly in document fields.
 * 
 * @param uri - The local URI of the image to process.
 * @returns A promise that resolves to a data-uri string (base64).
 */
export const uploadImage = async (uri: string, path: string): Promise<string> => {
  console.log(`Starting Local Base64 Conversion: URI=${uri.substring(0, 50)}...`);
  
  try {
    // 1. COMPRESS HEAVILY (Firestore has a 1MB per document limit)
    // We resize to a small thumbnail size to ensure we stay well under the 1MB limit
    const processed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 300 } }], // Small size for Firestore storage
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    const base64Data = `data:image/jpeg;base64,${processed.base64}`;
    
    // Check approximate size (Base64 is ~33% larger than binary)
    const sizeInBytes = base64Data.length;
    console.log(`Image converted to Base64. Size: ${(sizeInBytes / 1024).toFixed(2)} KB`);

    if (sizeInBytes > 800000) {
       throw new Error("Image too large for local storage workaround. Try a smaller photo.");
    }

    return base64Data;

  } catch (error: any) {
    console.error("Base64 Conversion Error: ", error);
    throw new Error(`Failed to process photo: ${error.message}`);
  }
};
