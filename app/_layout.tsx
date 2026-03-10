import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()
  const segments = useSegments()

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

    return () => subscription.unsubscribe()
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

  return <Slot />
}