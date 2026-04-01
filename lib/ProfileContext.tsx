import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from './supabase'
import { Database } from '../types/database.types'
import { registerForPushNotificationsAsync } from './notifications'

type Profile = Database['public']['Tables']['profiles']['Row']

interface ProfileContextValue {
  profile: Profile | null
  refreshProfile: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  refreshProfile: async () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    fetchProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') fetchProfile()
      if (event === 'SIGNED_OUT') setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    let resolvedProfile = data

    if (data) {
      // Auto-detect timezone if not set or still on default
      const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!data.timezone || data.timezone === 'UTC') {
        await supabase
          .from('profiles')
          .update({ timezone: deviceTimezone })
          .eq('id', user.id)
        resolvedProfile = { ...data, timezone: deviceTimezone }
      }
    } else {
      const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          reminder_email: user.email,
          reminders_enabled: true,
          remind_days_before: 7,
          odometer_unit: 'miles',
          timezone: deviceTimezone,
        })
        .select()
        .single()
      if (newProfile) resolvedProfile = newProfile
    }

    if (resolvedProfile) {
      // Register for push notifications and persist the token if it changed.
      // Wrapped in try/catch so a timeout or permission error never blocks
      // the profile from being set (prevents ANR on no-network start).
      try {
        const token = await registerForPushNotificationsAsync()
        if (token && token !== resolvedProfile.push_token) {
          await supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', user.id)
          resolvedProfile = { ...resolvedProfile, push_token: token }
        }
      } catch (error) {
        console.warn('Push notification registration failed:', error)
      }
      setProfile(resolvedProfile)
    }
  }

  return (
    <ProfileContext.Provider value={{ profile, refreshProfile: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}