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
  /*
  // UNCOMMENT FOR PRODUCTION BUILD
  try {
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
  */
  return null; 
};

/**
 * Configure how notifications are handled when the app is in the foreground.
 */
export const registerNotificationHandler = () => {
  const Notifications = getNotifications();
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
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
  if (!Device.isDevice) return false;

  const Notifications = getNotifications();
  if (!Notifications || !Notifications.getPermissionsAsync) return false;

  try {
    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance?.MAX || 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C6FFF',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    return false;
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
