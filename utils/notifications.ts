import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * =========================================================================
 * NOTIFICATION STUB (Stealth Mode for Expo Go SDK 53+)
 * =========================================================================
 * 
 * In Android Expo Go (SDK 53+), the expo-notifications library physically
 * blocks remote registration and throws a Call Stack Error at boot.
 * 
 * We have COMMENTED OUT the Notifications logic below to ensure a clean 
 * development environment. 
 * 
 * TO ENABLE FOR PRODUCTION/APK:
 * 1. Uncomment the 'require' and logic inside the functions below.
 * 2. Ensure your EAS build has the expo-notifications plugin configured.
 * =========================================================================
 */

const getNotifications = (): any => {
  // Expo Go (SDK 53+) physically blocks remote notification registration and triggers a crash.
  // We only load the library if we are NOT in the Expo Go (StoreClient) environment.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return null;
  }
  
  try {
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
};

/**
 * Configure how notifications are handled when the app is in the foreground.
 */
export const registerNotificationHandler = () => {
  const Notifications = getNotifications();
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
};

/**
 * Requests permissions for push notifications and configures Android channels.
 */
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;

  const Notifications = getNotifications();
  if (!Notifications || !Notifications.getPermissionsAsync) return null;

  try {
    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance?.MAX || 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C6FFF',
      });
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance?.MAX || 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C6FFF',
        sound: 'default'
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // Fetch the token
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId
    })).data;

    return token;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

/**
 * Schedules a local notification immediately.
 */
export async function sendLocalNotification(title: string, body: string, data = {}) {
  const Notifications = getNotifications();
  if (Notifications?.scheduleNotificationAsync) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: null,
    });
  }
}

// Export the getter for the hook to use
export { getNotifications };

/**
 * Sends a remote push notification via Expo Push API.
 * This can be used from the client to notify other users.
 */
export async function sendRemoteNotification(to: string, title: string, body: string, data = {}) {
  try {
    const message = {
      to,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'messages',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const resData = await response.json();
    return resData;
  } catch (error) {
    console.error("Error sending remote notification:", error);
    return null;
  }
}
/**
 * Broadcasts a notification for a new post.
 */
export async function broadcastNewPostNotification(collegeId: string, title: string, category: string, userId: string) {
  const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
  await sendLocalNotification(
    "CampusLoop Update 🚀",
    `A new ${categoryName} post just landed: "${title}"`
  );
}
