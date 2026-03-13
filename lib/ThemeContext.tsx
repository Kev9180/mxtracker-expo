import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeContextValue {
  preference: ThemePreference
  dark: boolean
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  dark: false,
  setPreference: () => {},
})

const STORAGE_KEY = 'mxtracker_theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [ready, setReady] = useState(false)

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setPreferenceState(saved)
      }
      setReady(true)
    })
  }, [])

  async function setPreference(p: ThemePreference) {
    setPreferenceState(p)
    await AsyncStorage.setItem(STORAGE_KEY, p)
  }

  // Resolve actual dark/light from preference + system
  const dark =
    preference === 'dark' ? true :
    preference === 'light' ? false :
    systemScheme === 'dark'

  if (!ready) return null

  return (
    <ThemeContext.Provider value={{ preference, dark, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}