import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

// Configure how notifications appear while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Requests permission and returns the Expo push token, or null if unavailable
 * (simulator, permission denied, web, etc.).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on native mobile platforms
  if (Platform.OS === 'web') return null
  if (!Device.isDevice) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Maintenance Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '91f9bfd6-1623-4764-92b5-0535787c1538',
    })
    return tokenData.data
  } catch (error) {
    console.warn('Failed to get push token:', error)
    return null
  }
}
