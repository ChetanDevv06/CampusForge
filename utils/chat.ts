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
    // Check if conversation already exists for this specific item (if provided)
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUserId),
      ...(reference?.itemId ? [where('itemId', '==', reference.itemId)] : [where('itemId', '==', null)])
    );

    const querySnapshot = await getDocs(q);
    let conversationId: string | null = null;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.participants.includes(otherUserId)) {
        conversationId = doc.id;
      }
    });

    if (!conversationId) {
      // Navigate to 'new' chat without creating doc yet
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: 'new',
          name: otherUserName,
          itemMetadata: reference ? JSON.stringify({
          type: reference.type,
          title: reference.title,
          image: reference.image || null,
          ownerId: otherUserId // Since startChat is called by the prospective buyer
        }) : null,
          refId: reference?.itemId
        }
      } as any);
      return;
    }

    // Existing conversation: Find the name from the existing doc for accurate display
    const snap = querySnapshot.docs.find(d => d.id === conversationId);
    const data = snap?.data();
    const displayOtherName = data?.participantNames?.[otherUserId] || otherUserName;

    // Navigate to the existing chat
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: conversationId,
        name: displayOtherName,
        otherUserId,
        refType: reference?.type,
        refTitle: reference?.title,
        refImage: reference?.image,
        refId: reference?.itemId
      }
    } as any);

  } catch (error) {
    console.error("Error starting chat:", error);
  }
};
