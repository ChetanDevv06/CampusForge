import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeFirestore, memoryLocalCache, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from 'react-native';

// Suppress verbose Firestore warning logs like connection drops
setLogLevel('error');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const isNew = !getApps().length;
const app = isNew ? initializeApp(firebaseConfig) : getApp();

// Guard against double-init on hot-reload and platform errors during local export
let auth: Auth;
if (isNew) {
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  }
} else {
  auth = getAuth(app);
}

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: memoryLocalCache({}),
});
const storage = getStorage(app);

export { app, auth, db, storage };
