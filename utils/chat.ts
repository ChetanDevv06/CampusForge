import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { Router } from "expo-router";

/**
 * Initiates or retrieves an existing conversation between the current user and another user.
 * 
 * @param otherUserId - The UID of the other participant.
 * @param otherUserName - The name of the other participant.
 * @param router - The expo-router instance for navigation.
 */
export const startChat = async (otherUserId: string, otherUserName: string, router: Router) => {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId || currentUserId === otherUserId) return;

  try {
    // Check if conversation already exists
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUserId)
    );
    
    const querySnapshot = await getDocs(q);
    let conversationId = null;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.participants.includes(otherUserId)) {
        conversationId = doc.id;
      }
    });

    if (!conversationId) {
      // Create new conversation
      const currentUserName = auth.currentUser?.email?.split('@')[0] || 'Student';
      const newConv = await addDoc(collection(db, 'conversations'), {
        participants: [currentUserId, otherUserId],
        participantNames: {
          [currentUserId]: currentUserName,
          [otherUserId]: otherUserName || 'Campus Student'
        },
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        unreadCount: {
          [currentUserId]: 0,
          [otherUserId]: 0
        }
      });
      conversationId = newConv.id;
    }

    // Navigate to the chat screen
    router.push({ 
      pathname: '/chat/[id]', 
      params: { id: conversationId, name: otherUserName, otherUserId } 
    } as any);


  } catch (error) {
    console.error("Error starting chat:", error);
  }
};
