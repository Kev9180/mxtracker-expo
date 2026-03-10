import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function AppLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/(auth)/login')
      }
    })
  }, [])

  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}