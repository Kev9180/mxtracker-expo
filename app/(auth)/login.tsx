import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const scheme = useColorScheme()
  const dark = scheme === 'dark'
  const s = styles(dark)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      Alert.alert('Login failed', error.message)
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please enter your email address first, then tap Forgot Password.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Check your email', `We sent a password reset link to ${email.trim()}.`)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.inner}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.wordmark}>MX</Text>
          <View style={s.accentBar} />
          <Text style={s.wordmarkSub}>TRACKER</Text>
          <Text style={s.tagline}>VEHICLE MAINTENANCE LOG</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>EMAIL</Text>
          <TextInput
            style={s.input}
            placeholder="your@email.com"
            placeholderTextColor={dark ? '#555' : '#aaa'}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={s.label}>PASSWORD</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••"
            placeholderTextColor={dark ? '#555' : '#aaa'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#e3001b', letterSpacing: 1 }}>
              FORGOT PASSWORD?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.buttonText}>SIGN IN</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={s.footerLink}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark ? '#0f0f0f' : '#f5f5f0',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    gap: 40,
  },

  // Header
  header: {
    alignItems: 'flex-start',
    gap: 4,
  },
  wordmark: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
    color: '#e3001b',
    lineHeight: 64,
  },
  accentBar: {
    width: 48,
    height: 3,
    backgroundColor: '#e3001b',
    marginVertical: 6,
  },
  wordmarkSub: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    color: dark ? '#fff' : '#111',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 4,
    color: dark ? '#555' : '#999',
    marginTop: 4,
  },

  // Form
  form: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    color: dark ? '#666' : '#888',
    marginTop: 8,
    marginBottom: 2,
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: dark ? '#2a2a2a' : '#ddd',
    backgroundColor: dark ? '#1a1a1a' : '#fff',
    color: dark ? '#fff' : '#111',
    paddingHorizontal: 16,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  button: {
    height: 52,
    backgroundColor: '#e3001b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: dark ? '#555' : '#999',
    fontSize: 13,
  },
  footerLink: {
    color: '#e3001b',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
})