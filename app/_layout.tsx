import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar, AppState, View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { useNotifications } from '../utils/useNotifications';
import { db } from '../firebaseConfig';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as SplashScreen from 'expo-splash-screen';

import { useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/theme';

// Load Design System Fonts
import { 
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold 
} from '@expo-google-fonts/plus-jakarta-sans';
import { 
  Manrope_400Regular, 
  Manrope_500Medium, 
  Manrope_600SemiBold, 
  Manrope_700Bold 
} from '@expo-google-fonts/manrope';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { user, profile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  
  // Design System Font Hook
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  // Use our centralized notifications hook
  useNotifications(user?.uid);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (isLoading || !rootNavigationState?.key || !fontsLoaded) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = segments[0] === 'onboarding';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user) {
      if (inAuthGroup) {
        // Allow college-select and college-email even when logged in
        const onCollegeFlow = segments[1] === 'college-select' || segments[1] === 'college-email';
        if (!onCollegeFlow) {
          router.replace('/(tabs)');
        }
      } else if (profile && profile.hasSeenOnboarding === false && !onOnboarding && profile.role !== 'admin') {
        router.replace('/onboarding');
      } else if (profile && !profile.collegeId && !onOnboarding && profile.role !== 'admin') {
        // Must join a college community before accessing the app
        router.replace('/(auth)/college-select');
      }
    }
  }, [user, profile, isLoading, segments, fontsLoaded, rootNavigationState?.key]);

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
    headerStyle: { backgroundColor: Colors.background },
    headerTintColor: Colors.on_background,
    headerTitleStyle: { 
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 18,
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: Colors.background },
  };

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={darkHeader}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="post-item" options={{ presentation: 'modal', title: 'Report Item', ...darkHeader }} />
          <Stack.Screen name="post-skill" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="post-market" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="messages" options={{ headerShown: false, ...darkHeader }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false, ...darkHeader }} />
          <Stack.Screen name="saved-items" options={{ title: 'Saved Items', ...darkHeader }} />
          <Stack.Screen name="my-reviews" options={{ title: 'My Reviews', ...darkHeader }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', ...darkHeader }} />
          <Stack.Screen name="admin/seed-colleges" options={{ title: 'Seed Colleges', ...darkHeader }} />
        </Stack>
      </ThemeProvider>
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
