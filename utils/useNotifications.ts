import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { registerNotificationHandler, registerForPushNotificationsAsync, getNotifications } from './notifications';

/**
 * Custom hook to handle all notification-related logic (permissions, listeners, etc.)
 */
export function useNotifications(uid?: string) {
  const router = useRouter();

  useEffect(() => {
    // 1. Register the global handler (foreground behavior)
    registerNotificationHandler();

    // 2. Request permissions on mount (when the user is logged in)
    const setupNotifications = async () => {
      if (!uid) return;
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          console.log("Saving push token to Firestore:", token);
          const { db } = require('../firebaseConfig');
          const { doc, updateDoc } = require('firebase/firestore');
          await updateDoc(doc(db, 'users', uid), { 
            expoPushToken: token,
            notificationsEnabled: true
          });
        }
      } catch (e) {
        console.log("Note: Notification setup skipped (SDK 53+).");
      }
    };

    setupNotifications();

    // 3. Listen for notification responses (interaction)
    let subscription: any;
    try {
      const Notifications = getNotifications();
      if (Notifications?.addNotificationResponseReceivedListener) {
        subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response.notification?.request?.content?.data;
          if (data?.chatId) {
            // Use a small timeout to ensure the router is ready and the app has loaded
            setTimeout(() => {
              router.push({ 
                pathname: '/chat/[id]', 
                params: { id: data.chatId, name: data.senderName } 
              } as any);
            }, 500);
          }
        });
      }
    } catch (e) {
      console.log('Notification listener setup skipped.');
    }

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);
}
