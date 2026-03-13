import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../lib/ThemeContext'

export default function Signup() {
  const { dark } = useTheme()
  const s = styles(dark)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  async function handleSignup() {
    if (!displayName || !email || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill out all fields.')
      return
    }
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.')
      return
    }
    
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: 'mxtracker://login'
      }
    })
    setLoading(false)

    if (error) {
      Alert.alert('Signup failed', error.message)
      return
    }

    Alert.alert(
      'Verify your email',
      'We sent a confirmation link to ' + email + '. Please verify before signing in.',
      [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
    )
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backText}>← BACK</Text>
          </TouchableOpacity>
          <Text style={s.wordmark}>MX</Text>
          <View style={s.accentBar} />
          <Text style={s.wordmarkSub}>TRACKER</Text>
          <Text style={s.tagline}>CREATE YOUR ACCOUNT</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>DISPLAY NAME</Text>
          <TextInput
            style={s.input}
            placeholder="Kevin"
            placeholderTextColor={dark ? '#555' : '#aaa'}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
          />

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
            placeholder="Min. 8 characters"
            placeholderTextColor={dark ? '#555' : '#aaa'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            passwordRules="minlength: 8;"
          />

          <Text style={s.label}>CONFIRM PASSWORD</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••"
            placeholderTextColor={dark ? '#555' : '#aaa'}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.buttonText}>CREATE ACCOUNT</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.footerLink}>SIGN IN</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark ? '#0f0f0f' : '#f5f5f0',
  },
  inner: {
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
    gap: 40,
  },

  // Header
  header: {
    alignItems: 'flex-start',
    gap: 4,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#e3001b',
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