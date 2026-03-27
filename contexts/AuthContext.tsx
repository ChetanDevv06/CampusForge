import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

interface UserProfile {
  uid: string;
  name: string;
  college: string;
  email: string;
  avatarUrl?: string;
  rating?: number;
  reviewCount?: number;
  hasSeenOnboarding?: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | any | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signInAsGuest: () => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  signInAsGuest: () => {},
  signOutUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        // Do not overwrite the user state if they are currently a guest
        setUser((prevUser: any) => (prevUser?.uid === 'guest-user-123' ? prevUser : null));
        if (user?.uid !== 'guest-user-123') setProfile(null);
      }
      setIsLoading(false);
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user || user.uid === 'guest-user-123') {
      if (user?.uid === 'guest-user-123') {
        setProfile({
          uid: 'guest-user-123',
          name: 'Guest Student',
          college: 'Demo University',
          email: 'guest@college.edu',
          createdAt: new Date().toISOString(),
          hasSeenOnboarding: true,
        });
      }
      return;
    }

    // Listen for Firestore profile updates
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    });

    return unsubscribeProfile;
  }, [user]);

  const signInAsGuest = () => {
    setUser({
      uid: 'guest-user-123',
      email: 'guest@college.edu',
      displayName: 'Guest Student',
    });
  };

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
    <AuthContext.Provider value={{ user, profile, isLoading, signInAsGuest, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

