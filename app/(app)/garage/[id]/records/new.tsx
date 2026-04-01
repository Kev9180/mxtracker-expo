import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from 'react-native'
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../../../lib/supabase'
import { useTheme } from '../../../../../lib/ThemeContext'
import { useProfile } from '../../../../../lib/ProfileContext'
import { registerForPushNotificationsAsync } from '../../../../../lib/notifications'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// ── Sub-components ─────────────────────────────────────────────

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, multiline, dark }: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad'
  autoCapitalize?: 'none' | 'words' | 'sentences'
  maxLength?: number; multiline?: boolean; dark: boolean
}) {
  const s = styles(dark)
  return (
    <View style={s.fieldContainer}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={dark ? '#444' : '#999'}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  )
}

function DatePickerModal({ visible, value, onConfirm, onCancel, dark }: {
  visible: boolean; value: string; onConfirm: (date: string) => void
  onCancel: () => void; dark: boolean
}) {
  const s = styles(dark)
  const now = new Date()
  const parsed = value ? new Date(value + 'T12:00:00') : now
  const [month, setMonth] = useState(parsed.getMonth())
  const [day, setDay] = useState(parsed.getDate())
  const [year, setYear] = useState(parsed.getFullYear())

  const currentYear = now.getFullYear()
  const years = Array.from({ length: currentYear - 1885 + 1 }, (_, i) => currentYear - i)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const clampedDay = Math.min(day, daysInMonth)

  function handleConfirm() {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(clampedDay).padStart(2, '0')
    onConfirm(`${year}-${mm}-${dd}`)
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={s.modalContainer}>
          <Text style={s.modalTitle}>SERVICE DATE</Text>
          <View style={s.accentBarSmall} />
          <View style={s.pickerRow}>
            <View style={s.pickerColumn}>
              <Text style={s.pickerLabel}>MONTH</Text>
              <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={[s.pickerItem, month === i && s.pickerItemActive]} onPress={() => setMonth(i)}>
                    <Text style={[s.pickerItemText, month === i && s.pickerItemTextActive]}>{m.slice(0, 3).toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={s.pickerColumnSmall}>
              <Text style={s.pickerLabel}>DAY</Text>
              <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
                {days.map(d => (
                  <TouchableOpacity key={d} style={[s.pickerItem, clampedDay === d && s.pickerItemActive]} onPress={() => setDay(d)}>
                    <Text style={[s.pickerItemText, clampedDay === d && s.pickerItemTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={s.pickerColumnSmall}>
              <Text style={s.pickerLabel}>YEAR</Text>
              <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
                {years.map(y => (
                  <TouchableOpacity key={y} style={[s.pickerItem, year === y && s.pickerItemActive]} onPress={() => setYear(y)}>
                    <Text style={[s.pickerItemText, year === y && s.pickerItemTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={s.modalButtons}>
            <TouchableOpacity style={s.modalCancelButton} onPress={onCancel}>
              <Text style={s.modalCancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalConfirmButton} onPress={handleConfirm}>
              <Text style={s.modalConfirmText}>CONFIRM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Main Component ─────────────────────────────────────────────

export default function NewRecord() {
  const { id, prefillTaskName, prefillDate, fromReminderId } =
    useLocalSearchParams<{
      id: string
      prefillTaskName?: string
      prefillDate?: string
      fromReminderId?: string
    }>()
  const { dark } = useTheme()
  const s = styles(dark)
  const { profile } = useProfile()

  const [taskName, setTaskName] = useState(prefillTaskName ?? '')
  const [completedDate, setCompletedDate] = useState(prefillDate ?? '')
  const [mileage, setMileage] = useState('')
  const [performedBy, setPerformedBy] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [intervalYears, setIntervalYears] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('')
  const [intervalDays, setIntervalDays] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleReminderToggle(enabled: boolean) {
    if (enabled) {
      // Request push permission if push is enabled in profile but token not yet granted
      if (profile?.push_notifications_enabled) {
        const token = await registerForPushNotificationsAsync()
        if (!token) {
          Alert.alert(
            'Push Notifications Blocked',
            'You have push notifications enabled in Settings but this device hasn\'t granted permission. You can still receive email reminders, or go to your device Settings to allow notifications for MXTracker.',
            [{ text: 'OK' }]
          )
        }
      }
    }
    setReminderEnabled(enabled)
  }

  // Summary of which channels will deliver this reminder
  function getReminderChannelHint(): string | null {
    if (!reminderEnabled) return null
    const email = profile?.reminders_enabled
    const push = profile?.push_notifications_enabled
    if (email && push) return 'Reminder will be sent via push notification and email'
    if (push) return 'Reminder will be sent via push notification'
    if (email) return 'Reminder will be sent via email'
    return 'All notifications are off — enable them in Settings'
  }

  // Calculate next due date preview
  function getNextDuePreview(): string | null {
    if (!completedDate) return null
    const y = parseInt(intervalYears) || 0
    const m = parseInt(intervalMonths) || 0
    const d = parseInt(intervalDays) || 0
    if (y === 0 && m === 0 && d === 0) return null

    const date = new Date(completedDate + 'T12:00:00')
    date.setFullYear(date.getFullYear() + y)
    date.setMonth(date.getMonth() + m)
    date.setDate(date.getDate() + d)

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }

  async function handleSubmit() {
    if (!taskName.trim()) {
      Alert.alert('Missing field', 'Task name is required.')
      return
    }
    if (!completedDate) {
      Alert.alert('Missing field', 'Service date is required.')
      return
    }
    if (reminderEnabled) {
      const y = parseInt(intervalYears) || 0
      const m = parseInt(intervalMonths) || 0
      const d = parseInt(intervalDays) || 0
      if (y === 0 && m === 0 && d === 0) {
        Alert.alert('Missing interval', 'Please set a reminder interval (years, months, or days).')
        return
      }
    }
    if (cost && isNaN(parseFloat(cost))) {
      Alert.alert('Invalid cost', 'Please enter a valid cost amount.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert('Error', 'Not logged in.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('maintenance_records').insert({
      vehicle_id: id,
      user_id: user.id,
      task_name: taskName.trim(),
      completed_date: completedDate,
      mileage_at_service: mileage ? parseInt(mileage) : null,
      performed_by: performedBy.trim() || null,
      cost: cost ? parseFloat(cost) : null,
      notes: notes.trim() || null,
      reminder_enabled: reminderEnabled,
      is_recurring: reminderEnabled,
      interval_years: reminderEnabled && intervalYears ? parseInt(intervalYears) : null,
      interval_months: reminderEnabled && intervalMonths ? parseInt(intervalMonths) : null,
      interval_days: reminderEnabled && intervalDays ? parseInt(intervalDays) : null,
    })

    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    // If this record was created by completing a reminder, disable that old reminder
    // (it will be replaced by the new record's own reminder if enabled above)
    if (fromReminderId) {
      await supabase
        .from('maintenance_records')
        .update({ reminder_enabled: false })
        .eq('id', fromReminderId)
    }

    router.back()
  }

  const nextDue = getNextDuePreview()

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <DatePickerModal
        visible={showDatePicker}
        value={completedDate}
        onConfirm={(date) => { setCompletedDate(date); setShowDatePicker(false) }}
        onCancel={() => setShowDatePicker(false)}
        dark={dark}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{fromReminderId ? 'LOG SERVICE' : 'ADD RECORD'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.accentBar} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Prefilled from reminder banner */}
        {fromReminderId && (
          <View style={s.reminderBanner}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
            <Text style={s.reminderBannerText}>
              Logging completion of reminder — task and date are pre-filled.
            </Text>
          </View>
        )}

        {/* Task Name */}
        <Field
          label="TASK NAME *"
          value={taskName}
          onChangeText={setTaskName}
          placeholder="e.g. Oil Change, Tire Rotation"
          dark={dark}
        />

        {/* Service Date */}
        <View style={s.fieldContainer}>
          <Text style={s.label}>SERVICE DATE *</Text>
          <TouchableOpacity
            style={[s.input, s.dateButton]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: completedDate ? (dark ? '#fff' : '#111') : (dark ? '#444' : '#999'), fontSize: 15 }}>
              {completedDate ? (() => {
                const [y, m, d] = completedDate.split('-')
                return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
              })() : 'Select service date'}
            </Text>
            <Ionicons name="calendar-outline" size={16} color={dark ? '#777' : '#555'} />
          </TouchableOpacity>
        </View>

        {/* Mileage */}
        <Field
          label="MILEAGE AT SERVICE"
          value={mileage}
          onChangeText={v => setMileage(v.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 85000"
          keyboardType="numeric"
          autoCapitalize="none"
          dark={dark}
        />

        {/* Performed By */}
        <Field
          label="PERFORMED BY"
          value={performedBy}
          onChangeText={setPerformedBy}
          placeholder="e.g. Self, Jiffy Lube, Toyota Dealer"
          dark={dark}
        />

        {/* Cost */}
        <Field
          label="COST ($)"
          value={cost}
          onChangeText={v => setCost(v.replace(/[^0-9.]/g, ''))}
          placeholder="e.g. 49.99"
          keyboardType="decimal-pad"
          autoCapitalize="none"
          dark={dark}
        />

        {/* Notes */}
        <Field
          label="NOTES"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional notes..."
          multiline
          dark={dark}
        />

        {/* Divider */}
        <View style={s.divider} />

        {/* Reminder toggle */}
        <View style={s.reminderHeader}>
          <View>
            <Text style={s.reminderTitle}>REMINDER</Text>
            <Text style={s.reminderSubtitle}>Get notified when this is due again</Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={handleReminderToggle}
            trackColor={{ false: dark ? '#2a2a2a' : '#c0c0c0', true: '#e3001b' }}
            thumbColor="#fff"
          />
        </View>
        {reminderEnabled && getReminderChannelHint() && (
          <View style={s.channelHint}>
            <Ionicons
              name={profile?.push_notifications_enabled || profile?.reminders_enabled ? 'checkmark-circle-outline' : 'warning-outline'}
              size={13}
              color={profile?.push_notifications_enabled || profile?.reminders_enabled ? '#22c55e' : '#f0a500'}
            />
            <Text style={[
              s.channelHintText,
              { color: profile?.push_notifications_enabled || profile?.reminders_enabled ? (dark ? '#777' : '#555') : '#f0a500' }
            ]}>{getReminderChannelHint()}</Text>
          </View>
        )}

        {/* Interval fields — only shown when reminder is on */}
        {reminderEnabled && (
          <View style={s.intervalContainer}>
            <Text style={s.intervalTitle}>REMIND ME IN...</Text>
            <View style={s.intervalRow}>
              <View style={s.intervalField}>
                <TextInput
                  style={s.intervalInput}
                  value={intervalYears}
                  onChangeText={v => setIntervalYears(v.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={dark ? '#444' : '#999'}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={s.intervalLabel}>YEARS</Text>
              </View>
              <View style={s.intervalField}>
                <TextInput
                  style={s.intervalInput}
                  value={intervalMonths}
                  onChangeText={v => setIntervalMonths(v.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={dark ? '#444' : '#999'}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={s.intervalLabel}>MONTHS</Text>
              </View>
              <View style={s.intervalField}>
                <TextInput
                  style={s.intervalInput}
                  value={intervalDays}
                  onChangeText={v => setIntervalDays(v.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={dark ? '#444' : '#999'}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={s.intervalLabel}>DAYS</Text>
              </View>
            </View>

            {/* Next due preview */}
            {nextDue && (
              <View style={s.nextDueContainer}>
                <Ionicons name="calendar-outline" size={14} color="#e3001b" />
                <Text style={s.nextDueText}>Next due: <Text style={s.nextDueDate}>{nextDue}</Text></Text>
              </View>
            )}
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitButton, loading && s.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitButtonText}>ADD RECORD</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 4, color: dark ? '#fff' : '#111' },
  accentBar: { height: 2, backgroundColor: '#e3001b', marginHorizontal: 24, marginBottom: 24 },
  accentBarSmall: { height: 2, backgroundColor: '#e3001b', marginBottom: 20 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48, gap: 16 },

  // Fields
  fieldContainer: { gap: 6 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#777' : '#666' },
  input: {
    height: 48, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#111' : '#fafafa', color: dark ? '#fff' : '#111',
    paddingHorizontal: 14, fontSize: 15,
  },
  inputMultiline: {
    height: 100, paddingTop: 12, textAlignVertical: 'top',
  },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Divider
  divider: { height: 1, backgroundColor: dark ? '#2a2a2a' : '#e8e8e8' },

  // Reminder
  reminderHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderTitle: {
    fontSize: 13, fontWeight: '800', letterSpacing: 3,
    color: dark ? '#fff' : '#111',
  },
  reminderSubtitle: {
    fontSize: 11, color: dark ? '#888' : '#555',
    letterSpacing: 0.5, marginTop: 2,
  },
  channelHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8,
  },
  channelHintText: {
    fontSize: 11, letterSpacing: 0.3, flex: 1,
  },
  intervalContainer: {
    borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#1a1a1a' : '#fff',
    padding: 16, gap: 16,
  },
  intervalTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    color: dark ? '#777' : '#666',
  },
  intervalRow: { flexDirection: 'row', gap: 12 },
  intervalField: { flex: 1, gap: 6, alignItems: 'center' },
  intervalInput: {
    width: '100%', height: 52, borderWidth: 1.5,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#111' : '#fafafa',
    color: dark ? '#fff' : '#111',
    fontSize: 22, fontWeight: '700', textAlign: 'center',
  },
  intervalLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 2,
    color: dark ? '#888' : '#555',
  },
  nextDueContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 4,
  },
  nextDueText: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.5,
    color: dark ? '#777' : '#555',
  },
  nextDueDate: { color: '#e3001b', fontWeight: '800' },

  // Submit
  submitButton: {
    height: 52, backgroundColor: '#e3001b',
    alignItems: 'center', justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: dark ? '#1a1a1a' : '#ffffff', padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 4, color: dark ? '#fff' : '#111', marginBottom: 12 },
  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  pickerColumn: { flex: 2 },
  pickerColumnSmall: { flex: 1 },
  pickerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#777' : '#666', marginBottom: 8 },
  pickerScroll: { height: 200, borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8' },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: dark ? '#2a2a2a' : '#f0f0f0' },
  pickerItemActive: { backgroundColor: '#e3001b' },
  pickerItemText: { fontSize: 13, fontWeight: '600', color: dark ? '#888' : '#666' },
  pickerItemTextActive: { color: '#fff', fontWeight: '800' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelButton: { flex: 1, height: 48, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 12, fontWeight: '800', letterSpacing: 3, color: dark ? '#888' : '#666' },
  modalConfirmButton: { flex: 1, height: 48, backgroundColor: '#e3001b', alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontSize: 12, fontWeight: '800', letterSpacing: 3, color: '#fff' },

  // Reminder completion banner
  reminderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: dark ? '#0a1a0a' : '#f0fdf4',
    borderWidth: 1, borderColor: '#22c55e30',
    padding: 14, marginBottom: 8,
  },
  reminderBannerText: {
    flex: 1, fontSize: 12, color: dark ? '#22c55e' : '#15803d', lineHeight: 17,
  },
})