import { Router } from "expo-router";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

/**
 * Initiates or retrieves an existing conversation between the current user and another user.
 * 
 * @param otherUserId - The UID of the other participant.
 * @param otherUserName - The name of the other participant.
 * @param router - The expo-router instance for navigation.
 */
export const startChat = async (
  otherUserId: string,
  otherUserName: string,
  router: Router,
  reference?: {
    type: "lost" | "found" | "market" | "skill"
    title: string
    image?: string
    itemId: string
  }
) => {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId || currentUserId === otherUserId) return;

  try {
    // Check if conversation already exists between these two users for this specific item
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUserId)
    );

    const querySnapshot = await getDocs(q);
    let conversationId: string | null = null;
    let existingConvData: any = null;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Check if both users are in this chat AND it's for the same item (or same lack of item)
      const isSamePair = data.participants.includes(otherUserId);
      const isSameItem = reference?.itemId ? data.itemId === reference.itemId : !data.itemId;
      
      if (isSamePair && isSameItem) {
        conversationId = doc.id;
        existingConvData = data;
      }
    });

    if (!conversationId) {
      // Navigate to 'new' chat
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: 'new',
          name: otherUserName,
          otherUserId: otherUserId, // CRITICAL: Pass the recipient ID
          refType: reference?.type,
          refTitle: reference?.title,
          refImage: reference?.image,
          refId: reference?.itemId
        }
      } as any);
      return;
    }

    // Navigate to existing chat
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: conversationId,
        name: existingConvData?.participantNames?.[otherUserId] || otherUserName,
        otherUserId,
        refType: reference?.type || existingConvData?.itemMetadata?.type,
        refTitle: reference?.title || existingConvData?.itemMetadata?.title,
        refImage: reference?.image || existingConvData?.itemMetadata?.image,
        refId: reference?.itemId || existingConvData?.itemId
      }
    } as any);

  } catch (error) {
    console.error("Error starting chat:", error);
  }
};
