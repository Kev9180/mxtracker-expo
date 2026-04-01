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
import { useCallback, useState } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../../../lib/supabase'
import { Database } from '../../../../../types/database.types'
import { useTheme } from '../../../../../lib/ThemeContext'

type MaintenanceRecord = Database['public']['Tables']['maintenance_records']['Row']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function formatInterval(years: number | null, months: number | null, days: number | null): string {
  const parts = []
  if (years) parts.push(`${years}y`)
  if (months) parts.push(`${months}mo`)
  if (days) parts.push(`${days}d`)
  return parts.length > 0 ? parts.join(' ') : '—'
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return new Date(dateStr + 'T12:00:00') < new Date()
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const due = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

interface ReminderForm {
  task_name: string
  completed_date: string
  next_due_date: string
  interval_years: string
  interval_months: string
  interval_days: string
}

function recordToForm(r: MaintenanceRecord): ReminderForm {
  return {
    task_name: r.task_name,
    completed_date: r.completed_date ?? '',
    next_due_date: r.next_due_date ?? '',
    interval_years: r.interval_years != null ? String(r.interval_years) : '',
    interval_months: r.interval_months != null ? String(r.interval_months) : '',
    interval_days: r.interval_days != null ? String(r.interval_days) : '',
  }
}

// ── Sub-components ─────────────────────────────────────────────

function ReadRow({ label, value, dark }: { label: string; value: string | null | undefined; dark: boolean }) {
  if (!value) return null
  const s = styles(dark)
  return (
    <View style={s.readRow}>
      <Text style={s.readLabel}>{label}</Text>
      <Text style={s.readValue}>{value}</Text>
    </View>
  )
}

function EditField({ label, value, onChangeText, placeholder, keyboardType, maxLength, dark }: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; keyboardType?: 'default' | 'numeric'
  maxLength?: number; dark: boolean
}) {
  const s = styles(dark)
  return (
    <View style={s.fieldContainer}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={dark ? '#444' : '#999'}
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
          <Text style={s.modalTitle}>DUE DATE</Text>
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

export default function ReminderDetailScreen() {
  const { id, recordId } = useLocalSearchParams<{ id: string; recordId: string }>()
  const { dark } = useTheme()
  const s = styles(dark)

  const [record, setRecord] = useState<MaintenanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ReminderForm | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  useFocusEffect(
    useCallback(() => {
      fetchRecord()
    }, [recordId, id])
  )

  async function fetchRecord() {
    const { data, error } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('id', recordId)
      .single()
    if (!error && data) {
      setRecord(data)
      setForm(recordToForm(data))
    }
    setLoading(false)
  }

  function setField(field: keyof ReminderForm, value: string) {
    setForm(prev => prev ? { ...prev, [field]: value } : prev)
  }

  function handleEditPress() {
    if (editing) {
      if (record) setForm(recordToForm(record))
      setEditing(false)
    } else {
      setEditing(true)
    }
  }

  function getNextDuePreview(f: ReminderForm): string | null {
    if (!f.next_due_date) return null
    const y = parseInt(f.interval_years) || 0
    const m = parseInt(f.interval_months) || 0
    const d = parseInt(f.interval_days) || 0
    if (y === 0 && m === 0 && d === 0) return null
    const date = new Date(f.next_due_date + 'T12:00:00')
    date.setFullYear(date.getFullYear() + y)
    date.setMonth(date.getMonth() + m)
    date.setDate(date.getDate() + d)
    return formatDate(date.toISOString().split('T')[0])
  }

  async function handleSave() {
    if (!form || !record) return
    if (!form.task_name.trim()) {
      Alert.alert('Missing field', 'Task name is required.')
      return
    }
    const y = parseInt(form.interval_years) || 0
    const m = parseInt(form.interval_months) || 0
    const d = parseInt(form.interval_days) || 0
    if (y === 0 && m === 0 && d === 0) {
      Alert.alert('Missing interval', 'Please set a reminder interval.')
      return
    }

    setSaving(true)

    // The DB trigger recalculates next_due_date = completed_date + interval whenever
    // completed_date is set. Back-calculate completed_date from the user's desired
    // next_due_date so the trigger produces exactly what the user entered.
    let derivedCompletedDate: string | null = form.completed_date || null
    if (form.next_due_date) {
      const dueDate = new Date(form.next_due_date + 'T12:00:00')
      dueDate.setFullYear(dueDate.getFullYear() - y)
      dueDate.setMonth(dueDate.getMonth() - m)
      dueDate.setDate(dueDate.getDate() - d)
      const mm = String(dueDate.getMonth() + 1).padStart(2, '0')
      const dd = String(dueDate.getDate()).padStart(2, '0')
      derivedCompletedDate = `${dueDate.getFullYear()}-${mm}-${dd}`
    }

    const { error } = await supabase
      .from('maintenance_records')
      .update({
        task_name: form.task_name.trim(),
        completed_date: derivedCompletedDate,
        next_due_date: form.next_due_date || null,
        interval_years: form.interval_years ? parseInt(form.interval_years) : null,
        interval_months: form.interval_months ? parseInt(form.interval_months) : null,
        interval_days: form.interval_days ? parseInt(form.interval_days) : null,
      })
      .eq('id', record.id)

    setSaving(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    await fetchRecord()
    setEditing(false)
  }

  function handleMarkComplete() {
    if (!record) return
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${mm}-${dd}`

    router.push({
      pathname: '/(app)/garage/[id]/records/new',
      params: {
        id,
        prefillTaskName: record.task_name,
        prefillDate: todayStr,
        fromReminderId: record.id,
      },
    })
  }

  if (loading || !record || !form) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e3001b" />
      </View>
    )
  }

  const overdue = isOverdue(form.next_due_date)
  const days = daysUntil(form.next_due_date)
  let urgencyColor: string
  if (overdue) {
    urgencyColor = '#e3001b'
  } else if (days !== null && days <= 7) {
    urgencyColor = '#f0a500'
  } else {
    urgencyColor = '#2196f3'
  }

  const nextDue = getNextDuePreview(form)

  // ── View Mode ──────────────────────────────────────────────
  const viewMode = (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

      <View style={s.section}>
        <Text style={s.sectionTitle}>REMINDER</Text>
        <View style={s.sectionBody}>
          <ReadRow label="TASK" value={record.task_name} dark={dark} />
          <ReadRow label="DUE DATE" value={formatDate(record.next_due_date)} dark={dark} />
          <ReadRow
            label="INTERVAL"
            value={formatInterval(record.interval_years, record.interval_months, record.interval_days)}
            dark={dark}
          />
        </View>
      </View>

      <TouchableOpacity style={s.markCompleteButton} onPress={handleMarkComplete}>
        <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
        <Text style={s.markCompleteButtonText}>MARK AS COMPLETE</Text>
      </TouchableOpacity>

    </ScrollView>
  )

  // ── Edit Mode ──────────────────────────────────────────────
  const editMode = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DatePickerModal
        visible={showDatePicker}
        value={form.next_due_date}
        onConfirm={(date) => { setField('next_due_date', date); setShowDatePicker(false) }}
        onCancel={() => setShowDatePicker(false)}
        dark={dark}
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.section}>
          <Text style={s.sectionTitle}>REMINDER</Text>
          <View style={s.sectionBody}>
            <EditField label="TASK NAME" value={form.task_name} onChangeText={v => setField('task_name', v)} placeholder="e.g. Oil Change" dark={dark} />

            <View style={s.fieldContainer}>
              <Text style={s.fieldLabel}>DUE DATE</Text>
              <TouchableOpacity style={[s.input, s.dateButton]} onPress={() => setShowDatePicker(true)}>
                <Text style={{ color: form.next_due_date ? (dark ? '#fff' : '#111') : (dark ? '#444' : '#999'), fontSize: 15 }}>
                  {form.next_due_date ? formatDate(form.next_due_date) : 'Select due date'}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={dark ? '#777' : '#555'} />
              </TouchableOpacity>
            </View>

            <Text style={s.intervalTitle}>REMIND ME IN...</Text>
            <View style={s.intervalRow}>
              <View style={s.intervalField}>
                <TextInput
                  style={s.intervalInput}
                  value={form.interval_years}
                  onChangeText={v => setField('interval_years', v.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={dark ? '#444' : '#bbb'}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={s.intervalLabel}>YEARS</Text>
              </View>
              <View style={s.intervalField}>
                <TextInput
                  style={s.intervalInput}
                  value={form.interval_months}
                  onChangeText={v => setField('interval_months', v.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={dark ? '#444' : '#bbb'}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={s.intervalLabel}>MONTHS</Text>
              </View>
              <View style={s.intervalField}>
                <TextInput
                  style={s.intervalInput}
                  value={form.interval_days}
                  onChangeText={v => setField('interval_days', v.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={dark ? '#444' : '#bbb'}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={s.intervalLabel}>DAYS</Text>
              </View>
            </View>

            {nextDue && (
              <View style={s.nextDueContainer}>
                <Ionicons name="calendar-outline" size={14} color="#e3001b" />
                <Text style={s.nextDueText}>After completion, next due: <Text style={s.nextDueDate}>{nextDue}</Text></Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity style={[s.saveButton, saving && s.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveButtonText}>SAVE CHANGES</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  )

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerButton}>
          <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{record.task_name.toUpperCase()}</Text>
        <TouchableOpacity onPress={handleEditPress} style={s.headerButton}>
          <Text style={[s.headerAction, editing && s.headerActionCancel]}>
            {editing ? 'CANCEL' : 'EDIT'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={s.accentBar} />
      {editing ? editMode : viewMode}
    </View>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16,
  },
  headerButton: { width: 64, height: 40, justifyContent: 'center' },
  headerTitle: {
    flex: 1, fontSize: 13, fontWeight: '900', letterSpacing: 2,
    color: dark ? '#fff' : '#111', textAlign: 'center',
  },
  headerAction: { fontSize: 12, fontWeight: '800', letterSpacing: 2, color: '#e3001b', textAlign: 'right' },
  headerActionCancel: { color: dark ? '#777' : '#666' },
  accentBar: { height: 2, backgroundColor: '#e3001b', marginHorizontal: 24, marginBottom: 24 },
  accentBarSmall: { height: 2, backgroundColor: '#e3001b', marginBottom: 20 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48, gap: 12 },
  section: {
    borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#1a1a1a' : '#ffffff',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', letterSpacing: 3,
    color: dark ? '#fff' : '#111', padding: 16,
    borderBottomWidth: 1, borderBottomColor: dark ? '#2a2a2a' : '#f0f0f0',
  },
  sectionBody: { padding: 16, gap: 12 },
  readRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: dark ? '#1f1f1f' : '#f8f8f8',
  },
  readLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: dark ? '#888' : '#555' },
  readValue: { fontSize: 14, fontWeight: '600', color: dark ? '#fff' : '#111', textAlign: 'right', flex: 1, marginLeft: 16 },
  fieldContainer: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#777' : '#666' },
  input: {
    height: 48, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#111' : '#fafafa', color: dark ? '#fff' : '#111',
    paddingHorizontal: 14, fontSize: 15,
  },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intervalTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#777' : '#666' },
  intervalRow: { flexDirection: 'row', gap: 12 },
  intervalField: { flex: 1, gap: 6, alignItems: 'center' },
  intervalInput: {
    width: '100%', height: 52, borderWidth: 1.5,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#111' : '#fafafa',
    color: dark ? '#fff' : '#111',
    fontSize: 22, fontWeight: '700', textAlign: 'center',
  },
  intervalLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: dark ? '#888' : '#555' },
  nextDueContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  nextDueText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: dark ? '#777' : '#555' },
  nextDueDate: { color: '#e3001b', fontWeight: '800' },
  markCompleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#e3001b', height: 52,
    marginTop: 8,
  },
  markCompleteButtonText: {
    color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 3,
  },
  saveButton: {
    height: 52, backgroundColor: '#e3001b',
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 4 },
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
})