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
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import { CardColorPicker } from '../../../components/CardColorPicker'
import { useTheme } from '../../../lib/ThemeContext'

type EngineConfig = 'inline' | 'v' | 'boxer' | 'rotary' | 'other'
type DriveType = 'FWD' | 'RWD' | 'AWD' | '4WD'
type TransmissionType = 'automatic' | 'manual' | 'cvt'
type FuelType = 'gasoline' | 'diesel' | 'hybrid' | 'plug-in hybrid' | 'electric' | 'other'

interface VehicleForm {
  year: string
  make: string
  model: string
  trim: string
  nickname: string
  color: string
  card_color: string
  vin: string
  current_mileage: string
  engine_displacement: string
  engine_config: EngineConfig | ''
  cylinders: string
  drive: DriveType | ''
  transmission: TransmissionType | ''
  fuel_type: FuelType | ''
  purchase_date: string
}

const EMPTY_FORM: VehicleForm = {
  year: '', make: '', model: '', trim: '', nickname: '',
  color: '', card_color: '', vin: '', current_mileage: '',
  engine_displacement: '', engine_config: '', cylinders: '',
  drive: '', transmission: '',
  fuel_type: '', purchase_date: '',
}

const ENGINE_CONFIGS: { label: string; value: EngineConfig }[] = [
  { label: 'Inline', value: 'inline' },
  { label: 'V', value: 'v' },
  { label: 'Boxer', value: 'boxer' },
  { label: 'Rotary', value: 'rotary' },
  { label: 'Other', value: 'other' },
]
const DRIVE_TYPES: { label: string; value: DriveType }[] = [
  { label: 'FWD', value: 'FWD' },
  { label: 'RWD', value: 'RWD' },
  { label: 'AWD', value: 'AWD' },
  { label: '4WD', value: '4WD' },
]
const TRANSMISSION_TYPES: { label: string; value: TransmissionType }[] = [
  { label: 'Automatic', value: 'automatic' },
  { label: 'Manual', value: 'manual' },
  { label: 'CVT', value: 'cvt' },
]
const FUEL_TYPES: { label: string; value: FuelType }[] = [
  { label: 'Gasoline', value: 'gasoline' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Plug-in Hybrid', value: 'plug-in hybrid' },
  { label: 'Electric', value: 'electric' },
  { label: 'Other', value: 'other' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, dark }: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric' | 'decimal-pad'
  autoCapitalize?: 'none' | 'words' | 'characters' | 'sentences'
  maxLength?: number
  dark: boolean
}) {
  const s = styles(dark)
  return (
    <View style={s.fieldContainer}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={dark ? '#444' : '#bbb'}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
        maxLength={maxLength}
      />
    </View>
  )
}

function OptionPicker<T extends string>({ label, value, options, onSelect, dark }: {
  label: string
  value: T | ''
  options: { label: string; value: T }[]
  onSelect: (v: T | '') => void
  dark: boolean
}) {
  const s = styles(dark)
  return (
    <View style={s.fieldContainer}>
      <Text style={s.label}>{label}</Text>
      <View style={s.optionRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[s.optionChip, value === opt.value && s.optionChipActive]}
            onPress={() => onSelect(value === opt.value ? '' : opt.value)}
          >
            <Text style={[s.optionChipText, value === opt.value && s.optionChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

function SectionHeader({ title, isOpen, onToggle, count, dark }: {
  title: string
  isOpen: boolean
  onToggle: () => void
  count?: number
  dark: boolean
}) {
  const s = styles(dark)
  return (
    <TouchableOpacity style={s.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
      <View style={s.sectionHeaderLeft}>
        <Text style={s.sectionTitle}>{title}</Text>
        {count ? <Text style={s.sectionCount}>{count} filled</Text> : null}
      </View>
      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={dark ? '#555' : '#999'} />
    </TouchableOpacity>
  )
}

function DatePickerModal({ visible, value, onConfirm, onCancel, dark }: {
  visible: boolean
  value: string
  onConfirm: (date: string) => void
  onCancel: () => void
  dark: boolean
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
          <Text style={s.modalTitle}>SELECT DATE</Text>
          <View style={s.accentBarSmall} />
          <View style={s.pickerRow}>
            <View style={s.pickerColumn}>
              <Text style={s.pickerLabel}>MONTH</Text>
              <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[s.pickerItem, month === i && s.pickerItemActive]}
                    onPress={() => setMonth(i)}
                  >
                    <Text style={[s.pickerItemText, month === i && s.pickerItemTextActive]}>
                      {m.slice(0, 3).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={s.pickerColumnSmall}>
              <Text style={s.pickerLabel}>DAY</Text>
              <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
                {days.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[s.pickerItem, clampedDay === d && s.pickerItemActive]}
                    onPress={() => setDay(d)}
                  >
                    <Text style={[s.pickerItemText, clampedDay === d && s.pickerItemTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={s.pickerColumnSmall}>
              <Text style={s.pickerLabel}>YEAR</Text>
              <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
                {years.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[s.pickerItem, year === y && s.pickerItemActive]}
                    onPress={() => setYear(y)}
                  >
                    <Text style={[s.pickerItemText, year === y && s.pickerItemTextActive]}>
                      {y}
                    </Text>
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

export default function NewVehicle() {
  const { dark } = useTheme()
  const s = styles(dark)

  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [engineOpen, setEngineOpen] = useState(false)
  const [drivetrainOpen, setDrivetrainOpen] = useState(false)
  const [otherOpen, setOtherOpen] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  function set(field: keyof VehicleForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.year || !form.make.trim() || !form.model.trim()) {
      Alert.alert('Missing fields', 'Year, Make, and Model are required.')
      return
    }
    const yearNum = parseInt(form.year)
    if (isNaN(yearNum) || yearNum < 1885 || yearNum > new Date().getFullYear() + 1) {
      Alert.alert('Invalid year', `Please enter a year between 1885 and ${new Date().getFullYear() + 1}.`)
      return
    }
    if (form.current_mileage && isNaN(parseInt(form.current_mileage))) {
      Alert.alert('Invalid mileage', 'Please enter a valid mileage number.')
      return
    }
    if (form.engine_displacement && isNaN(parseFloat(form.engine_displacement))) {
      Alert.alert('Invalid displacement', 'Please enter a valid displacement, e.g. 4.0')
      return
    }
    if (form.cylinders) {
      const cyl = parseInt(form.cylinders)
      if (isNaN(cyl) || cyl < 1 || cyl > 16) {
        Alert.alert('Invalid cylinders', 'Please enter a cylinder count between 1 and 16.')
        return
      }
    }
    if (form.vin && form.vin.trim().length !== 17) {
      Alert.alert('Invalid VIN', 'VIN must be exactly 17 characters.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert('Error', 'Not logged in.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('vehicles').insert({
      user_id: user.id,
      year: yearNum,
      make: form.make.trim(),
      model: form.model.trim(),
      trim: form.trim.trim() || null,
      nickname: form.nickname.trim() || null,
      color: form.color.trim() || null,
      card_color: form.card_color || null,
      vin: form.vin.trim() || null,
      current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
      engine_displacement: form.engine_displacement ? parseFloat(form.engine_displacement) : null,
      engine_config: form.engine_config || null,
      cylinders: form.cylinders ? parseInt(form.cylinders) : null,
      drive: form.drive || null,
      transmission: form.transmission || null,
      fuel_type: form.fuel_type || null,
      purchase_date: form.purchase_date || null,
    })

    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    router.back()
  }

  const engineCount = [form.engine_displacement, form.engine_config, form.cylinders].filter(Boolean).length
  const drivetrainCount = [form.drive, form.transmission].filter(Boolean).length
  const otherCount = [form.fuel_type, form.purchase_date].filter(Boolean).length

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DatePickerModal
        visible={showDatePicker}
        value={form.purchase_date}
        onConfirm={(date) => { set('purchase_date', date); setShowDatePicker(false) }}
        onCancel={() => setShowDatePicker(false)}
        dark={dark}
      />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ADD VEHICLE</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.accentBar} />
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.section}>
          <Text style={s.sectionTitleStatic}>GENERAL</Text>
          <View style={s.sectionBody}>
            <Field label="YEAR *" value={form.year} onChangeText={v => set('year', v)} placeholder="e.g. 2008" keyboardType="numeric" autoCapitalize="none" maxLength={4} dark={dark} />
            <Field label="MAKE *" value={form.make} onChangeText={v => set('make', v)} placeholder="e.g. Toyota" dark={dark} />
            <Field label="MODEL *" value={form.model} onChangeText={v => set('model', v)} placeholder="e.g. 4Runner" dark={dark} />
            <Field label="TRIM" value={form.trim} onChangeText={v => set('trim', v)} placeholder="e.g. SR5, Limited" dark={dark} />
            <Field label="NICKNAME" value={form.nickname} onChangeText={v => set('nickname', v)} placeholder='e.g. "The Beast"' dark={dark} />
            <Field label="COLOR" value={form.color} onChangeText={v => set('color', v)} placeholder="e.g. Silver" dark={dark} />
            <CardColorPicker
              value={form.card_color || null}
              onChange={v => set('card_color', v)}
            />
            <Field label="VIN" value={form.vin} onChangeText={v => set('vin', v.toUpperCase())} placeholder="17-character VIN" autoCapitalize="characters" maxLength={17} dark={dark} />
            <Field label="CURRENT MILEAGE" value={form.current_mileage} onChangeText={v => set('current_mileage', v.replace(/[^0-9]/g, ''))} placeholder="e.g. 120000" keyboardType="numeric" autoCapitalize="none" dark={dark} />
          </View>
        </View>

        <View style={s.section}>
          <SectionHeader title="ENGINE" isOpen={engineOpen} onToggle={() => setEngineOpen(o => !o)} count={engineCount} dark={dark} />
          {engineOpen && (
            <View style={s.sectionBody}>
              <Field label="DISPLACEMENT (L)" value={form.engine_displacement} onChangeText={v => set('engine_displacement', v)} placeholder="e.g. 4.0" keyboardType="decimal-pad" autoCapitalize="none" dark={dark} />
              <OptionPicker label="CONFIGURATION" value={form.engine_config} options={ENGINE_CONFIGS} onSelect={v => set('engine_config', v)} dark={dark} />
              <Field label="CYLINDERS" value={form.cylinders} onChangeText={v => set('cylinders', v.replace(/[^0-9]/g, ''))} placeholder="e.g. 6" keyboardType="numeric" autoCapitalize="none" dark={dark} />
            </View>
          )}
        </View>

        <View style={s.section}>
          <SectionHeader title="DRIVETRAIN" isOpen={drivetrainOpen} onToggle={() => setDrivetrainOpen(o => !o)} count={drivetrainCount} dark={dark} />
          {drivetrainOpen && (
            <View style={s.sectionBody}>
              <OptionPicker label="DRIVE" value={form.drive} options={DRIVE_TYPES} onSelect={v => set('drive', v)} dark={dark} />
              <OptionPicker label="TRANSMISSION" value={form.transmission} options={TRANSMISSION_TYPES} onSelect={v => set('transmission', v)} dark={dark} />
            </View>
          )}
        </View>

        <View style={s.section}>
          <SectionHeader title="OTHER" isOpen={otherOpen} onToggle={() => setOtherOpen(o => !o)} count={otherCount} dark={dark} />
          {otherOpen && (
            <View style={s.sectionBody}>
              <OptionPicker label="FUEL TYPE" value={form.fuel_type} options={FUEL_TYPES} onSelect={v => set('fuel_type', v)} dark={dark} />
              <View style={s.fieldContainer}>
                <Text style={s.label}>PURCHASE DATE</Text>
                <TouchableOpacity style={[s.input, s.dateButton]} onPress={() => setShowDatePicker(true)}>
                  <Text style={{ color: form.purchase_date ? (dark ? '#fff' : '#111') : (dark ? '#444' : '#bbb'), fontSize: 15 }}>
                    {form.purchase_date ? (() => {
                      const [y, m, d] = form.purchase_date.split('-')
                      return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
                    })() : 'Select a date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={16} color={dark ? '#555' : '#aaa'} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={[s.submitButton, loading && s.submitButtonDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitButtonText}>ADD VEHICLE</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 4, color: dark ? '#fff' : '#111' },
  accentBar: { height: 2, backgroundColor: '#e3001b', marginHorizontal: 24, marginBottom: 24 },
  accentBarSmall: { height: 2, backgroundColor: '#e3001b', marginBottom: 20 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48, gap: 12 },
  section: { borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8', backgroundColor: dark ? '#1a1a1a' : '#ffffff' },
  sectionTitleStatic: { fontSize: 11, fontWeight: '800', letterSpacing: 3, color: dark ? '#fff' : '#111', padding: 16, borderBottomWidth: 1, borderBottomColor: dark ? '#2a2a2a' : '#f0f0f0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 3, color: dark ? '#fff' : '#111' },
  sectionCount: { fontSize: 10, fontWeight: '600', letterSpacing: 1, color: '#e3001b' },
  sectionBody: { padding: 16, gap: 16, borderTopWidth: 1, borderTopColor: dark ? '#2a2a2a' : '#f0f0f0' },
  fieldContainer: { gap: 6 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#666' : '#999' },
  input: { height: 48, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8', backgroundColor: dark ? '#111' : '#fafafa', color: dark ? '#fff' : '#111', paddingHorizontal: 14, fontSize: 15 },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8', backgroundColor: dark ? '#111' : '#fafafa' },
  optionChipActive: { borderColor: '#e3001b', backgroundColor: '#e3001b' },
  optionChipText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: dark ? '#666' : '#999' },
  optionChipTextActive: { color: '#fff' },
  submitButton: { height: 52, backgroundColor: '#e3001b', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 4 },
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