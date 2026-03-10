import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const scheme = useColorScheme()
  const dark = scheme === 'dark'
  const s = styles(dark)

  async function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
            // Root layout watches auth state and redirects to login automatically
          }
        }
      ]
    )
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Dashboard</Text>
      <Text style={s.subtitle}>Coming soon...</Text>

      <TouchableOpacity style={s.logoutButton} onPress={handleLogout}>
        <Text style={s.logoutText}>SIGN OUT</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark ? '#0f0f0f' : '#f5f5f0',
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    color: dark ? '#fff' : '#111',
  },
  subtitle: {
    fontSize: 13,
    letterSpacing: 2,
    color: dark ? '#555' : '#999',
    marginBottom: 48,
  },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: '#e3001b',
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  logoutText: {
    color: '#e3001b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
  },
})