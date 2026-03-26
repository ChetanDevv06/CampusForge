import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';

interface AuthContextType {
  user: User | any | null;
  isLoading: boolean;
  signInAsGuest: () => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signInAsGuest: () => {},
  signOutUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        // Do not overwrite the user state if they are currently a guest
        setUser((prevUser: any) => (prevUser?.uid === 'guest-user-123' ? prevUser : null));
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInAsGuest = () => {
    setUser({
      uid: 'guest-user-123',
      email: 'guest@college.edu',
      displayName: 'Guest Student',
      name: 'Guest Student',
      college: 'Demo University'
    });
  };

  const signOutUser = async () => {
    try {
      setUser(null);
      await auth.signOut();
    } catch (e) {
      console.log('Firebase signOut error', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signInAsGuest, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};
