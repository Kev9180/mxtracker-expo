import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import { Database } from '../../../types/database.types'
import { useProfile } from '../../../lib/ProfileContext'
import { useTheme } from '../../../lib/ThemeContext'
import { rawTimeZones } from '@vvo/tzdb'

type Profile = Database['public']['Tables']['profiles']['Row']
type ThemePreference = 'system' | 'light' | 'dark'

// Format timezone for display e.g. "UTC" -> "Phoenix (MST)"
function formatTimezone(tz: string): string {
  const found = rawTimeZones.find(t => t.name === tz)
  if (!found) return tz
  const offset = found.rawOffsetInMinutes
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  const minuteStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''
  return `${found.alternativeName} (UTC ${sign}${hours}${minuteStr})`
}

// ── Sub-components ─────────────────────────────────────────────

function SectionHeader({ title, dark }: { title: string; dark: boolean }) {
  const s = styles(dark)
  return <Text style={s.sectionHeader}>{title}</Text>
}

function SettingRow({ label, subtitle, onPress, dark, last = false, destructive = false }: {
  label: string; subtitle?: string; onPress: () => void
  dark: boolean; last?: boolean; destructive?: boolean
}) {
  const s = styles(dark)
  return (
    <TouchableOpacity
      style={[s.row, last && s.rowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, destructive && { color: '#e3001b' }]}>{label}</Text>
        {subtitle ? <Text style={s.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={dark ? '#444' : '#ccc'} />
    </TouchableOpacity>
  )
}

function SettingToggle({ label, subtitle, value, onValueChange, dark, last = false }: {
  label: string; subtitle?: string; value: boolean
  onValueChange: (v: boolean) => void; dark: boolean; last?: boolean
}) {
  const s = styles(dark)
  return (
    <View style={[s.row, last && s.rowLast]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {subtitle ? <Text style={s.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: dark ? '#2a2a2a' : '#e0e0e0', true: '#e3001b' }}
        thumbColor="#fff"
      />
    </View>
  )
}

// ── Edit Modal ─────────────────────────────────────────────────

function EditModal({ visible, title, initialValue, onConfirm, onCancel, dark, placeholder, keyboardType, secureTextEntry }: {
  visible: boolean; title: string; initialValue: string
  onConfirm: (v: string) => void; onCancel: () => void
  dark: boolean; placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'numeric'
  secureTextEntry?: boolean
}) {
  const [text, setText] = useState(initialValue)
  const [confirmText, setConfirmText] = useState('')
  const s = styles(dark)

  // Reset state every time modal opens
  useEffect(() => {
    if (visible) {
      setText(initialValue)
      setConfirmText('')
    }
  }, [visible, initialValue])

  function handleConfirm() {
    if (secureTextEntry) {
      if (text.length < 8) {
        Alert.alert('Too short', 'Password must be at least 8 characters.')
        return
      }
      if (text !== confirmText) {
        Alert.alert('No match', 'Passwords do not match.')
        return
      }
    }
    onConfirm(text.trim())
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={s.modalContainer}>
                <Text style={s.modalTitle}>{title.toUpperCase()}</Text>
                <View style={s.modalAccentBar} />
                <TextInput
                  style={s.modalInput}
                  value={text}
                  onChangeText={setText}
                  placeholder={placeholder}
                  placeholderTextColor={dark ? '#444' : '#bbb'}
                  keyboardType={keyboardType ?? 'default'}
                  autoCapitalize= {secureTextEntry ? 'none' : 'words'}
                  autoFocus
                  secureTextEntry={secureTextEntry}
                />
                {secureTextEntry && (
                  <TextInput
                    style={s.modalInput}
                    value={confirmText}
                    onChangeText={setConfirmText}
                    placeholder="Confirm new password"
                    placeholderTextColor={dark ? '#444' : '#bbb'}
                    autoCapitalize="none"
                    secureTextEntry
                  />
                )}
                <View style={s.modalButtons}>
                  <TouchableOpacity style={s.modalCancelButton} onPress={onCancel}>
                    <Text style={s.modalCancelText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modalConfirmButton} onPress={handleConfirm}>
                    <Text style={s.modalConfirmText}>SAVE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Picker Modal (generic) ─────────────────────────────────────

function PickerModal({ visible, title, options, current, onSelect, onCancel, dark }: {
  visible: boolean; title: string
  options: { value: string; label: string; subtitle?: string }[]
  current: string; onSelect: (v: string) => void
  onCancel: () => void; dark: boolean
}) {
  const s = styles(dark)
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={s.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={s.modalContainer}>
              <Text style={s.modalTitle}>{title}</Text>
              <View style={s.modalAccentBar} />
              {options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.pickerOption, current === opt.value && s.pickerOptionActive]}
                  onPress={() => onSelect(opt.value)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.pickerOptionLabel, current === opt.value && s.pickerOptionLabelActive]}>
                      {opt.label}
                    </Text>
                    {opt.subtitle ? (
                      <Text style={s.pickerOptionSubtitle}>{opt.subtitle}</Text>
                    ) : null}
                  </View>
                  {current === opt.value && (
                    <Ionicons name="checkmark" size={20} color="#e3001b" />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.modalCancelButton, { marginTop: 12 }]} onPress={onCancel}>
                <Text style={s.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

function TimezoneModal({ visible, current, onSelect, onCancel, dark }: {
  visible: boolean; current: string
  onSelect: (tz: string) => void; onCancel: () => void; dark: boolean
}) {
  const [search, setSearch] = useState('')
  const s = styles(dark)

  // Full IANA timezone list grouped by region
  const allTimezones = rawTimeZones.sort((a, b) => a.rawOffsetInMinutes - b.rawOffsetInMinutes)

  const filtered = allTimezones.filter(tz =>
    tz.name.toLowerCase().replace(/_/g, ' ').includes(search.toLowerCase()) ||
    tz.alternativeName.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!visible) setSearch('')
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[s.modalContainer, { maxHeight: '80%' }]}>
                <Text style={s.modalTitle}>TIMEZONE</Text>
                <View style={s.modalAccentBar} />
                <TextInput
                  style={[s.modalInput, { marginBottom: 12 }]}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search timezones..."
                  placeholderTextColor={dark ? '#444' : '#bbb'}
                  autoCapitalize="none"
                />
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ flexGrow: 0 }}
                >
                  {filtered.map(tz => {
                    const offset = tz.rawOffsetInMinutes
                    const sign = offset >= 0 ? '+' : '-'
                    const abs = Math.abs(offset)
                    const hours = Math.floor(abs / 60)
                    const minutes = abs % 60
                    const minuteStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''
                    const label = `${tz.alternativeName} (UTC ${sign}${hours}${minuteStr})`

                    return (
                      <TouchableOpacity
                        key={tz.name}
                        style={[s.pickerOption, current === tz.name && s.pickerOptionActive]}
                        onPress={() => onSelect(tz.name)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.pickerOptionLabel, current === tz.name && s.pickerOptionLabelActive]}>
                            {label}
                          </Text>
                          <Text style={s.pickerOptionSubtitle}>
                            {tz.name.replace(/_/g, ' ')}
                          </Text>
                        </View>
                        {current === tz.name && (
                          <Ionicons name="checkmark" size={20} color="#e3001b" />
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[s.modalCancelButton, { marginTop: 12 }]}
                  onPress={onCancel}
                >
                  <Text style={s.modalCancelText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Main Component ─────────────────────────────────────────────

export default function SettingsScreen() {
  const { dark } = useTheme()
  const s = styles(dark)

  const { profile, refreshProfile } = useProfile()
  const [userEmail, setUserEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { preference: themePreference, setPreference } = useTheme()

  const [editModal, setEditModal] = useState<{
    visible: boolean; field: string; title: string
    initialValue: string; placeholder?: string
    keyboardType?: 'default' | 'email-address' | 'numeric'
    secureTextEntry?: boolean
  }>({ visible: false, field: '', title: '', initialValue: '' })

  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showUnitModal, setShowUnitModal] = useState(false)

  const [showTimezoneModal, setShowTimezoneModal] = useState(false)
  const [timezoneSearch, setTimezoneSearch] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? '')
      setLoading(false)
    })
  }, [])

  async function saveField(field: keyof Profile, value: string | boolean | number) {
    if (!profile) return

    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', profile.id)
      .select()

    if (error) {
      Alert.alert('Error saving', error.message)
    } else {
      await refreshProfile()
    }
  }

  async function handleEditConfirm(value: string) {
    setEditModal(prev => ({ ...prev, visible: false }))
    const { field } = editModal

    if (field === 'password') {
      setSaving(true)
      const { error } = await supabase.auth.updateUser({ password: value })
      setSaving(false)
      if (error) {
        Alert.alert('Error', error.message)
      } else {
        Alert.alert('Password updated', 'Your password has been changed successfully.')
      }
      return
    }

    await saveField(field as keyof Profile, value)
  }

  function openEdit(field: string, title: string, initialValue: string, options?: {
    placeholder?: string
    keyboardType?: 'default' | 'email-address' | 'numeric'
    secureTextEntry?: boolean
  }) {
    setEditModal({ visible: true, field, title, initialValue, ...options })
  }

  async function handleSignOut() {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        await supabase.auth.signOut()
      }
      return
    }
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => { await supabase.auth.signOut() }
        }
      ]
    )
  }

  async function handleDeleteAccount() {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Delete your account? This will permanently erase all your vehicles, records, and reminders. This cannot be undone.')
      : await new Promise<boolean>(resolve =>
          Alert.alert(
            'Delete Account',
            'This will permanently erase all your vehicles, maintenance records, and reminders. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete Forever', style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        )

    if (!confirmed) return

    setDeleting(true)
    try {
      // getUser() validates the token server-side and refreshes it if expired
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to delete account')
      }

      await supabase.auth.signOut()
    } catch (err: any) {
      setDeleting(false)
      Alert.alert('Error', err.message ?? 'Could not delete account. Please try again.')
    }
  }

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e3001b" />
      </View>
    )
  }

  const themeOptions = [
    { value: 'system', label: 'SYSTEM', subtitle: 'Follow device setting' },
    { value: 'light', label: 'LIGHT', subtitle: 'Always use light mode' },
    { value: 'dark', label: 'DARK', subtitle: 'Always use dark mode' },
  ]

  const unitOptions = [
    { value: 'miles', label: 'MILES' },
    { value: 'kilometers', label: 'KILOMETERS' },
  ]

  const themeLabel = themePreference === 'system' ? 'System' : themePreference === 'light' ? 'Light' : 'Dark'
  const unitLabel = profile?.odometer_unit === 'kilometers' ? 'Kilometers' : 'Miles'
  const displayName = profile?.display_name || ''

  return (
    <View style={s.container}>
      <EditModal
        visible={editModal.visible}
        title={editModal.title}
        initialValue={editModal.initialValue}
        onConfirm={handleEditConfirm}
        onCancel={() => setEditModal(prev => ({ ...prev, visible: false }))}
        dark={dark}
        placeholder={editModal.placeholder}
        keyboardType={editModal.keyboardType}
        secureTextEntry={editModal.secureTextEntry}
      />
      <PickerModal
        visible={showThemeModal}
        title="APPEARANCE"
        options={themeOptions}
        current={themePreference}
        onSelect={(v) => { setPreference(v as ThemePreference); setShowThemeModal(false) }}
        onCancel={() => setShowThemeModal(false)}
        dark={dark}
      />
      <PickerModal
        visible={showUnitModal}
        title="ODOMETER UNIT"
        options={unitOptions}
        current={profile?.odometer_unit ?? 'miles'}
        onSelect={(v) => { saveField('odometer_unit', v); setShowUnitModal(false) }}
        onCancel={() => setShowUnitModal(false)}
        dark={dark}
      />
      <TimezoneModal
        visible={showTimezoneModal}
        current={profile?.timezone ?? 'UTC'}
        onSelect={(tz) => { saveField('timezone', tz); setShowTimezoneModal(false) }}
        onCancel={() => setShowTimezoneModal(false)}
        dark={dark}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>SETTINGS</Text>
        <Text style={s.headerSubtitle}>{userEmail}</Text>
      </View>
      <View style={s.accentBar} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* PROFILE */}
        <SectionHeader title="PROFILE" dark={dark} />
        <View style={s.section}>
          <SettingRow
            label="Display Name"
            subtitle={displayName || 'Tap to set your name'}
            onPress={() => openEdit('display_name', 'Display Name', displayName, {
              placeholder: 'Your name'
            })}
            dark={dark}
          />
          <SettingRow
            label="Timezone"
            subtitle={formatTimezone(profile?.timezone ?? 'UTC')}
            onPress={() => setShowTimezoneModal(true)}
            dark={dark}
          />
          <SettingRow
            label="Change Password"
            subtitle="Update your account password"
            onPress={() => openEdit('password', 'New Password', '', {
              placeholder: 'New password (min 8 characters)',
              secureTextEntry: true
            })}
            dark={dark}
            last
          />
        </View>

        {/* NOTIFICATIONS */}
        <SectionHeader title="NOTIFICATIONS" dark={dark} />
        <View style={s.section}>
          <SettingToggle
            label="Push Notifications"
            subtitle={profile?.push_notifications_enabled ? 'Maintenance reminders sent to this device' : 'Push notifications are off'}
            value={profile?.push_notifications_enabled ?? true}
            onValueChange={(v) => saveField('push_notifications_enabled', v)}
            dark={dark}
          />
          <SettingToggle
            label="Email Reminders"
            subtitle={profile?.reminders_enabled ? 'Reminder emails are on' : 'Reminder emails are off'}
            value={profile?.reminders_enabled ?? true}
            onValueChange={(v) => saveField('reminders_enabled', v)}
            dark={dark}
          />
          <SettingRow
            label="Reminder Email"
            subtitle={profile?.reminder_email || userEmail || 'Tap to set'}
            onPress={() => openEdit('reminder_email', 'Reminder Email',
              profile?.reminder_email ?? userEmail, {
              placeholder: 'email@example.com',
              keyboardType: 'email-address'
            })}
            dark={dark}
            last
          />
        </View>

        {/* PREFERENCES */}
        <SectionHeader title="PREFERENCES" dark={dark} />
        <View style={s.section}>
          <SettingRow
            label="Odometer Unit"
            subtitle={unitLabel}
            onPress={() => setShowUnitModal(true)}
            dark={dark}
          />
          <SettingRow
            label="Appearance"
            subtitle={themeLabel}
            onPress={() => setShowThemeModal(true)}
            dark={dark}
            last
          />
        </View>

        {/* APP */}
        <SectionHeader title="APP" dark={dark} />
        <View style={s.section}>
          <SettingRow
            label="Rate MXTracker"
            subtitle="Love the app? Leave us a review"
            onPress={() => Alert.alert('Coming Soon', 'Rating will be available once the app is live on the App Store.')}
            dark={dark}
          />
          <SettingRow
            label="Send Feedback"
            subtitle="Report a bug or suggest a feature"
            onPress={() => Platform.OS === 'web'
              ? Linking.openURL('https://mxtracker.app/support')
              : Linking.openURL('mailto:developer@mxtracker.app?subject=MXTracker Feedback')
            }
            dark={dark}
          />
          <SettingRow
            label="Privacy Policy"
            subtitle="How we handle your data"
            onPress={() => Linking.openURL('https://mxtracker.app/privacy')}
            dark={dark}
            last
          />
        </View>

        <TouchableOpacity style={s.signOutButton} onPress={handleSignOut} disabled={deleting}>
          <Ionicons name="log-out-outline" size={18} color="#e3001b" />
          <Text style={s.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.deleteAccountButton} onPress={handleDeleteAccount} disabled={deleting || saving}>
          {deleting
            ? <ActivityIndicator size="small" color="#e3001b" />
            : <Text style={s.deleteAccountText}>DELETE ACCOUNT</Text>
          }
        </TouchableOpacity>

        {saving && (
          <View style={s.savingIndicator}>
            <ActivityIndicator size="small" color="#e3001b" />
            <Text style={s.savingText}>SAVING...</Text>
          </View>
        )}

      </ScrollView>
    </View>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },
  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16 },
  backButton: { marginBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 4, color: dark ? '#fff' : '#111' },
  headerSubtitle: { fontSize: 11, fontWeight: '600', letterSpacing: 2, color: dark ? '#555' : '#999', marginTop: 4 },
  accentBar: { height: 2, backgroundColor: '#e3001b', marginHorizontal: 24, marginBottom: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48 },

  sectionHeader: {
    fontSize: 10, fontWeight: '800', letterSpacing: 3,
    color: dark ? '#555' : '#aaa', marginTop: 24, marginBottom: 8,
  },
  section: {
    borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#1a1a1a' : '#fff',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: dark ? '#2a2a2a' : '#f0f0f0',
    minHeight: 56,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: dark ? '#fff' : '#111', letterSpacing: 0.3 },
  rowSubtitle: { fontSize: 12, color: dark ? '#555' : '#aaa', marginTop: 2, letterSpacing: 0.3 },

  signOutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, marginTop: 24,
    borderWidth: 1.5, borderColor: '#e3001b',
  },
  signOutText: { color: '#e3001b', fontSize: 13, fontWeight: '800', letterSpacing: 3 },

  deleteAccountButton: {
    alignItems: 'center', justifyContent: 'center',
    height: 44, marginTop: 12,
  },
  deleteAccountText: { color: dark ? '#444' : '#bbb', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  savingIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16,
  },
  savingText: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: dark ? '#555' : '#aaa' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: dark ? '#1a1a1a' : '#fff', padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 4, color: dark ? '#fff' : '#111', marginBottom: 12 },
  modalAccentBar: { height: 2, backgroundColor: '#e3001b', marginBottom: 20 },
  modalInput: {
    height: 48, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#111' : '#fafafa', color: dark ? '#fff' : '#111',
    paddingHorizontal: 14, fontSize: 15, marginBottom: 12,
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelButton: {
    flex: 1, height: 48, borderWidth: 1.5,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: { fontSize: 12, fontWeight: '800', letterSpacing: 3, color: dark ? '#555' : '#999' },
  modalConfirmButton: { flex: 1, height: 48, backgroundColor: '#e3001b', alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontSize: 12, fontWeight: '800', letterSpacing: 3, color: '#fff' },

  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    marginBottom: 8,
  },
  pickerOptionActive: { borderColor: '#e3001b', backgroundColor: dark ? '#1a0a0a' : '#fff5f5' },
  pickerOptionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 2, color: dark ? '#888' : '#aaa' },
  pickerOptionLabelActive: { color: '#e3001b' },
  pickerOptionSubtitle: { fontSize: 11, color: dark ? '#555' : '#bbb', marginTop: 2, letterSpacing: 0.5 },
})