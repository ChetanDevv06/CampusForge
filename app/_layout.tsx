import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar, AppState } from 'react-native';
import 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { useNotifications } from '../utils/useNotifications';
import { db } from '../firebaseConfig';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Root configuration for Expo Router
function RootLayoutNav() {
  const { user, profile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  
  // Use our centralized notifications hook
  useNotifications(user?.uid);

  useEffect(() => {
    if (isLoading || !rootNavigationState?.key) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = segments[0] === 'onboarding';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user) {
      if (inAuthGroup) {
        router.replace('/(tabs)');
      } else if (profile && profile.hasSeenOnboarding === false && !onOnboarding) {
        router.replace('/onboarding');
      }
    }
  }, [user, profile, isLoading, segments]);

  // Online Status Heartbeat
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    if (!user?.uid) return;

    const updateStatus = async (online: boolean) => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          online,
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        console.error("Error updating status:", e);
      }
    };

    // Initial online status
    updateStatus(true);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        updateStatus(true);
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        updateStatus(false);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      updateStatus(false);
    };
  }, [user]);


  const darkHeader = {
    headerStyle: { backgroundColor: '#13131F' },
    headerTintColor: '#F0F0FF',
    headerTitleStyle: { fontWeight: '700' as const },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: '#0A0A12' },
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A12" />
      <Stack screenOptions={darkHeader}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="post-item" options={{ presentation: 'modal', title: 'Report Item', ...darkHeader }} />
        <Stack.Screen name="post-skill" options={{ presentation: 'modal', title: 'Post Skill', ...darkHeader }} />
        <Stack.Screen name="post-market" options={{ presentation: 'modal', title: 'List Item', ...darkHeader }} />
        <Stack.Screen name="messages" options={{ headerShown: false, ...darkHeader }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false, ...darkHeader }} />
        <Stack.Screen name="saved-items" options={{ title: 'Saved Items', ...darkHeader }} />
        <Stack.Screen name="my-reviews" options={{ title: 'My Reviews', ...darkHeader }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', ...darkHeader }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', ...darkHeader }} />
        <Stack.Screen name="search" options={{ title: 'Global Search', ...darkHeader }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', ...darkHeader }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
