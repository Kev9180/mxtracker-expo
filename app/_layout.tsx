import { useEffect, useRef, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { ProfileProvider } from '../lib/ProfileContext'
import { ThemeProvider } from '../lib/ThemeContext'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()
  const segments = useSegments()
  const notificationListener = useRef<Notifications.EventSubscription>()

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

    // Handle push notification taps — navigate to the reminder detail screen
    notificationListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined
      const recordId = data?.recordId
      const vehicleId = data?.vehicleId
      if (recordId && vehicleId) {
        // Small delay to ensure navigation stack is ready
        setTimeout(() => {
          router.push(`/(app)/reminders/${vehicleId}/${recordId}`)
        }, 300)
      }
    })

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
        <Slot />
      </ProfileProvider>
    </ThemeProvider>
  )
}