import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from './supabase'
import { Database } from '../types/database.types'

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

    if (data) {
      // Auto-detect timezone if not set or still on default
      const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!data.timezone || data.timezone === 'UTC') {
        await supabase
          .from('profiles')
          .update({ timezone: deviceTimezone })
          .eq('id', user.id)
        setProfile({ ...data, timezone: deviceTimezone })
      } else {
        setProfile(data)
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
      if (newProfile) setProfile(newProfile)
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