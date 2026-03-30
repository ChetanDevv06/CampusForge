import { collection, query, where, getDocs, addDoc, serverTimestamp, getDoc, doc } from "firebase/firestore";
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
      // Fetch current user profile to get full name and avatar
      const currentUserDoc = await getDoc(doc(db, 'users', currentUserId!));
      const currentUserData = currentUserDoc.data();
      const currentUserName = currentUserData?.name || auth.currentUser?.email?.split('@')[0] || 'Student';
      const currentUserAvatar = currentUserData?.avatarUrl || null;

      // Create new conversation with enhanced metadata
      const newConv = await addDoc(collection(db, 'conversations'), {
        participants: [currentUserId, otherUserId],
        participantNames: {
          [currentUserId!]: currentUserName,
          [otherUserId]: otherUserName || 'Campus Student'
        },
        participantAvatars: {
          [currentUserId!]: currentUserAvatar,
          [otherUserId]: null // Will be updated on first message if not provided
        },
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        lastSenderId: '',
        unreadCount: {
          [currentUserId!]: 0,
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
