import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot as onSnapshotColl, limit, orderBy } from 'firebase/firestore';
import { registerForPushNotificationsAsync, sendLocalNotification } from '../utils/notifications';
import { useRef } from 'react';

interface UserProfile {
  uid: string;
  name: string;
  college: string;
  email: string;
  avatarUrl?: string;
  rating?: number;
  reviewCount?: number;
  hasSeenOnboarding?: boolean;
  role?: 'admin' | 'user';
  createdAt: string;
  // College community fields
  collegeId?: string;
  collegeName?: string;
  colDomain?: string;
  collegeShortName?: string;
  collegeEmail?: string;
  collegeEmailVerified?: boolean;
  major?: string;
  gradYear?: string;
  bio?: string;
  socials?: {
    instagram?: string;
    linkedin?: string;
  };
}

interface AuthContextType {
  user: User | any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  signOutUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const convsRef = useRef<Record<string, number>>({}); // Track lastMessageAt as millis for each chatId
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (!authUser) setProfile(null);
      setIsLoading(false);
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for Firestore profile updates
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    });

    // Request Notification Permissions
    registerForPushNotificationsAsync().catch(e => console.error("Notification permission error:", e));

    // Monitor all conversations for new messages (global listener)
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribeMessages = onSnapshotColl(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        // We only care about MODIFIED or ADDED conversations with a new message
        if (change.type === 'modified' || change.type === 'added') {
          const data = change.doc.data();
          const chatId = change.doc.id;
          const lastMsgAt = data.lastMessageAt?.toMillis?.() || 0;
          const prevLastMsgAt = convsRef.current[chatId] || 0;

          // Trigger notification if:
          // 1. lastMessageAt is newer than what we last saw
          // 2. The sender is NOT the current user
          // 3. The lastMessage is not empty
          // 4. This isn't the first time the app is loading existing data
          if (lastMsgAt > prevLastMsgAt && data.lastSenderId !== user.uid && data.lastMessage && !isFirstRun.current) {
            const senderName = data.participantNames?.[data.lastSenderId] || 'CampusForge Student';
            sendLocalNotification(
              `New message from ${senderName}`,
              data.lastMessage,
              { chatId, senderName } // Pass data for navigation
            );
          }

          // Update ref with latest timestamp
          if (lastMsgAt > 0) {
            convsRef.current[chatId] = lastMsgAt;
          }
        }
      });

      // Mark first run as complete after processing the first snapshot
      isFirstRun.current = false;
    });

    return () => {
      unsubscribeProfile();
      unsubscribeMessages();
    };
  }, [user]);

  const signOutUser = async () => {
    try {
      setUser(null);
      setProfile(null);
      await auth.signOut();
    } catch (e) {
      console.log('Firebase signOut error', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

