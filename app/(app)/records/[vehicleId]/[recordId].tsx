import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from 'react-native'
import { useState, useCallback } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../../lib/supabase'
import { Database } from '../../../../types/database.types'

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

interface RecordForm {
  task_name: string
  completed_date: string
  mileage_at_service: string
  performed_by: string
  cost: string
  notes: string
  reminder_enabled: boolean
  interval_years: string
  interval_months: string
  interval_days: string
}

function recordToForm(r: MaintenanceRecord): RecordForm {
  return {
    task_name: r.task_name,
    completed_date: r.completed_date ?? '',
    mileage_at_service: r.mileage_at_service != null ? String(r.mileage_at_service) : '',
    performed_by: r.performed_by ?? '',
    cost: r.cost != null ? String(r.cost) : '',
    notes: r.notes ?? '',
    reminder_enabled: r.reminder_enabled ?? false,
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

function EditField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, multiline, dark }: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad'
  autoCapitalize?: 'none' | 'words' | 'sentences'
  maxLength?: number; multiline?: boolean; dark: boolean
}) {
  const s = styles(dark)
  return (
    <View style={s.fieldContainer}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={dark ? '#444' : '#bbb'}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
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

export default function RecordDetail() {
  const { vehicleId, recordId } = useLocalSearchParams<{ vehicleId: string; recordId: string }>()
  const dark = useColorScheme() === 'dark'
  const s = styles(dark)

  const [record, setRecord] = useState<MaintenanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<RecordForm | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  useFocusEffect(
    useCallback(() => {
      fetchRecord()
    }, [recordId])
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

  function setField(field: keyof RecordForm, value: string | boolean) {
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

  function getNextDuePreview(f: RecordForm): string | null {
    if (!f.completed_date) return null
    const y = parseInt(f.interval_years) || 0
    const m = parseInt(f.interval_months) || 0
    const d = parseInt(f.interval_days) || 0
    if (y === 0 && m === 0 && d === 0) return null
    const date = new Date(f.completed_date + 'T12:00:00')
    date.setFullYear(date.getFullYear() + y)
    date.setMonth(date.getMonth() + m)
    date.setDate(date.getDate() + d)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }

  async function handleSave() {
    if (!form || !record) return
    if (!form.task_name.trim()) {
      Alert.alert('Missing field', 'Task name is required.')
      return
    }
    if (!form.completed_date) {
      Alert.alert('Missing field', 'Service date is required.')
      return
    }
    if (form.reminder_enabled) {
      const y = parseInt(form.interval_years) || 0
      const m = parseInt(form.interval_months) || 0
      const d = parseInt(form.interval_days) || 0
      if (y === 0 && m === 0 && d === 0) {
        Alert.alert('Missing interval', 'Please set a reminder interval.')
        return
      }
    }
    if (form.cost && isNaN(parseFloat(form.cost))) {
      Alert.alert('Invalid cost', 'Please enter a valid cost amount.')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('maintenance_records')
      .update({
        task_name: form.task_name.trim(),
        completed_date: form.completed_date,
        mileage_at_service: form.mileage_at_service ? parseInt(form.mileage_at_service) : null,
        performed_by: form.performed_by.trim() || null,
        cost: form.cost ? parseFloat(form.cost) : null,
        notes: form.notes.trim() || null,
        reminder_enabled: form.reminder_enabled,
        is_recurring: form.reminder_enabled,
        interval_years: form.reminder_enabled && form.interval_years ? parseInt(form.interval_years) : null,
        interval_months: form.reminder_enabled && form.interval_months ? parseInt(form.interval_months) : null,
        interval_days: form.reminder_enabled && form.interval_days ? parseInt(form.interval_days) : null,
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

  async function handleDelete() {
    Alert.alert(
      'Delete Record',
      'This will permanently delete this maintenance record. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('maintenance_records')
              .delete()
              .eq('id', record!.id)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              router.back()
            }
          }
        }
      ]
    )
  }

  if (loading || !record || !form) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e3001b" />
      </View>
    )
  }

  const nextDue = form.reminder_enabled ? getNextDuePreview(form) : null

  // ── View Mode ──────────────────────────────────────────────
  const viewMode = (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

      <View style={s.section}>
        <Text style={s.sectionTitle}>SERVICE DETAILS</Text>
        <View style={s.sectionBody}>
          <ReadRow label="TASK" value={record.task_name} dark={dark} />
          <ReadRow label="DATE" value={formatDate(record.completed_date)} dark={dark} />
          <ReadRow label="MILEAGE" value={record.mileage_at_service != null ? `${record.mileage_at_service.toLocaleString()} mi` : null} dark={dark} />
          <ReadRow label="PERFORMED BY" value={record.performed_by} dark={dark} />
          <ReadRow label="COST" value={record.cost != null ? `$${parseFloat(String(record.cost)).toFixed(2)}` : null} dark={dark} />
          <ReadRow label="NOTES" value={record.notes} dark={dark} />
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>REMINDER</Text>
        <View style={s.sectionBody}>
          <View style={s.readRow}>
            <Text style={s.readLabel}>STATUS</Text>
            <Text style={[s.readValue, { color: record.reminder_enabled ? '#4caf50' : (dark ? '#555' : '#aaa') }]}>
              {record.reminder_enabled ? 'ENABLED' : 'DISABLED'}
            </Text>
          </View>
          {record.reminder_enabled && (
            <>
              <ReadRow
                label="INTERVAL"
                value={formatInterval(record.interval_years, record.interval_months, record.interval_days)}
                dark={dark}
              />
              <ReadRow label="NEXT DUE" value={formatDate(record.next_due_date)} dark={dark} />
            </>
          )}
        </View>
      </View>

      <TouchableOpacity style={s.deleteButton} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={16} color="#e3001b" />
        <Text style={s.deleteButtonText}>DELETE RECORD</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  // ── Edit Mode ──────────────────────────────────────────────
  const editMode = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DatePickerModal
        visible={showDatePicker}
        value={form.completed_date}
        onConfirm={(date) => { setField('completed_date', date); setShowDatePicker(false) }}
        onCancel={() => setShowDatePicker(false)}
        dark={dark}
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.section}>
          <Text style={s.sectionTitle}>SERVICE DETAILS</Text>
          <View style={s.sectionBody}>
            <EditField label="TASK NAME *" value={form.task_name} onChangeText={v => setField('task_name', v)} placeholder="e.g. Oil Change" dark={dark} />

            <View style={s.fieldContainer}>
              <Text style={s.fieldLabel}>SERVICE DATE *</Text>
              <TouchableOpacity style={[s.input, s.dateButton]} onPress={() => setShowDatePicker(true)}>
                <Text style={{ color: form.completed_date ? (dark ? '#fff' : '#111') : (dark ? '#444' : '#bbb'), fontSize: 15 }}>
                  {form.completed_date ? formatDate(form.completed_date) : 'Select service date'}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={dark ? '#555' : '#aaa'} />
              </TouchableOpacity>
            </View>

            <EditField label="MILEAGE AT SERVICE" value={form.mileage_at_service} onChangeText={v => setField('mileage_at_service', v.replace(/[^0-9]/g, ''))} placeholder="e.g. 85000" keyboardType="numeric" autoCapitalize="none" dark={dark} />
            <EditField label="PERFORMED BY" value={form.performed_by} onChangeText={v => setField('performed_by', v)} placeholder="e.g. Self, Jiffy Lube" dark={dark} />
            <EditField label="COST ($)" value={form.cost} onChangeText={v => setField('cost', v.replace(/[^0-9.]/g, ''))} placeholder="e.g. 49.99" keyboardType="decimal-pad" autoCapitalize="none" dark={dark} />
            <EditField label="NOTES" value={form.notes} onChangeText={v => setField('notes', v)} placeholder="Any additional notes..." multiline dark={dark} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>REMINDER</Text>
          <View style={s.sectionBody}>
            <View style={s.reminderHeader}>
              <View>
                <Text style={s.reminderTitle}>ENABLE REMINDER</Text>
                <Text style={s.reminderSubtitle}>Get notified when this is due again</Text>
              </View>
              <Switch
                value={form.reminder_enabled}
                onValueChange={v => setField('reminder_enabled', v)}
                trackColor={{ false: dark ? '#2a2a2a' : '#e0e0e0', true: '#e3001b' }}
                thumbColor="#fff"
              />
            </View>

            {form.reminder_enabled && (
              <>
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
                    <Text style={s.nextDueText}>Next due: <Text style={s.nextDueDate}>{nextDue}</Text></Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        <TouchableOpacity style={[s.saveButton, saving && s.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveButtonText}>SAVE CHANGES</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color="#e3001b" />
          <Text style={s.deleteButtonText}>DELETE RECORD</Text>
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
  headerActionCancel: { color: dark ? '#666' : '#999' },
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
  readLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: dark ? '#555' : '#aaa' },
  readValue: { fontSize: 14, fontWeight: '600', color: dark ? '#fff' : '#111', textAlign: 'right', flex: 1, marginLeft: 16 },
  fieldContainer: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#666' : '#999' },
  input: {
    height: 48, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#111' : '#fafafa', color: dark ? '#fff' : '#111',
    paddingHorizontal: 14, fontSize: 15,
  },
  inputMultiline: { height: 100, paddingTop: 12, textAlignVertical: 'top' },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  reminderTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 2, color: dark ? '#fff' : '#111' },
  reminderSubtitle: { fontSize: 11, color: dark ? '#555' : '#aaa', letterSpacing: 0.5, marginTop: 2 },
  intervalTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#666' : '#999' },
  intervalRow: { flexDirection: 'row', gap: 12 },
  intervalField: { flex: 1, gap: 6, alignItems: 'center' },
  intervalInput: {
    width: '100%', height: 52, borderWidth: 1.5,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#111' : '#fafafa',
    color: dark ? '#fff' : '#111',
    fontSize: 22, fontWeight: '700', textAlign: 'center',
  },
  intervalLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: dark ? '#555' : '#aaa' },
  nextDueContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  nextDueText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: dark ? '#666' : '#888' },
  nextDueDate: { color: '#e3001b', fontWeight: '800' },
  saveButton: {
    height: 52, backgroundColor: '#e3001b',
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 4 },
  deleteButton: {
    height: 52, borderWidth: 1.5, borderColor: '#e3001b',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4,
  },
  deleteButtonText: { color: '#e3001b', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: dark ? '#1a1a1a' : '#ffffff', padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 4, color: dark ? '#fff' : '#111', marginBottom: 12 },
  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  pickerColumn: { flex: 2 },
  pickerColumnSmall: { flex: 1 },
  pickerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#666' : '#999', marginBottom: 8 },
  pickerScroll: { height: 200, borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8' },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: dark ? '#2a2a2a' : '#f0f0f0' },
  pickerItemActive: { backgroundColor: '#e3001b' },
  pickerItemText: { fontSize: 13, fontWeight: '600', color: dark ? '#888' : '#666' },
  pickerItemTextActive: { color: '#fff', fontWeight: '800' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelButton: { flex: 1, height: 48, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 12, fontWeight: '800', letterSpacing: 3, color: dark ? '#555' : '#999' },
  modalConfirmButton: { flex: 1, height: 48, backgroundColor: '#e3001b', alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontSize: 12, fontWeight: '800', letterSpacing: 3, color: '#fff' },
})