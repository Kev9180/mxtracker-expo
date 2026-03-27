import * as Sentry from '@sentry/react-native'
import { useEffect, useRef, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { View, StyleSheet, Platform } from 'react-native'
import { Session } from '@supabase/supabase-js'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { ProfileProvider } from '../lib/ProfileContext'
import { ThemeProvider, useTheme } from '../lib/ThemeContext'
import { supportsNativePushNotifications } from '../lib/notifications'

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],
  _experiments: {
    enableLogs: true,
  },
})

function WebWrapper({ children }: { children: React.ReactNode }) {
  const { dark } = useTheme()
  return (
    <View style={[s.webOuter, { backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' }]}>
      <View style={s.webInner}>
        {children}
      </View>
    </View>
  )
}

export default Sentry.wrap(function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()
  const segments = useSegments()
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitialized(true)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    // Handle push notification taps — navigate to the reminder detail screen.
    // expo-notifications is not supported on macOS ("Designed for iPhone" on Mac),
    // so skip the listener registration there to avoid a TurboModule crash.
    if (supportsNativePushNotifications()) {
      notificationListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data as Record<string, string> | undefined
        const recordId = data?.recordId
        const vehicleId = data?.vehicleId
        if (recordId && vehicleId) {
          // Small delay to ensure navigation stack is ready
          setTimeout(() => {
            router.push(`/(app)/garage/${vehicleId}/reminders/${recordId}`)
          }, 300)
        }
      })
    }

    return () => {
      subscription.unsubscribe()
      notificationListener.current?.remove()
    }
  }, [])

  // Handle navigation based on auth state
  useEffect(() => {
    if (!initialized) return

    const inAuthGroup = segments[0] === '(auth)'

    if (session && inAuthGroup) {
      // Logged in but on auth screen — go to app
      router.replace('/(app)')
    } else if (!session && !inAuthGroup) {
      // Logged out but on app screen — go to login
      router.replace('/(auth)/login')
    }
  }, [session, initialized, segments])

  if (!initialized) return null

  return (
    <ThemeProvider>
      <ProfileProvider>
        {Platform.OS === 'web' ? (
          <WebWrapper>
            <Slot />
          </WebWrapper>
        ) : (
          <Slot />
        )}
      </ProfileProvider>
    </ThemeProvider>
  )
});

const s = StyleSheet.create({
  webOuter: {
    flex: 1,
    alignItems: 'center',
  },
  webInner: {
    flex: 1,
    width: '100%',
    maxWidth: 768,
    overflow: 'hidden',
  },
})