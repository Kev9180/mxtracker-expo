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
import { useState, useCallback } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import { Database } from '../../../types/database.types'
import { CardColorPicker } from '../../../components/CardColorPicker'
import { useTheme } from '../../../lib/ThemeContext'

type Vehicle = Database['public']['Tables']['vehicles']['Row']
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
  license_plate: string
  license_plate_state: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const ENGINE_CONFIGS: { label: string; value: EngineConfig }[] = [
  { label: 'Inline', value: 'inline' }, { label: 'V', value: 'v' },
  { label: 'Boxer', value: 'boxer' }, { label: 'Rotary', value: 'rotary' },
  { label: 'Other', value: 'other' },
]
const DRIVE_TYPES: { label: string; value: DriveType }[] = [
  { label: 'FWD', value: 'FWD' }, { label: 'RWD', value: 'RWD' },
  { label: 'AWD', value: 'AWD' }, { label: '4WD', value: '4WD' },
]
const TRANSMISSION_TYPES: { label: string; value: TransmissionType }[] = [
  { label: 'Automatic', value: 'automatic' }, { label: 'Manual', value: 'manual' },
  { label: 'CVT', value: 'cvt' },
]
const FUEL_TYPES: { label: string; value: FuelType }[] = [
  { label: 'Gasoline', value: 'gasoline' }, { label: 'Diesel', value: 'diesel' },
  { label: 'Hybrid', value: 'hybrid' }, { label: 'Plug-in Hybrid', value: 'plug-in hybrid' },
  { label: 'Electric', value: 'electric' }, { label: 'Other', value: 'other' },
]

function vehicleToForm(v: Vehicle): VehicleForm {
  return {
    year: String(v.year),
    make: v.make,
    model: v.model,
    trim: v.trim ?? '',
    nickname: v.nickname ?? '',
    color: v.color ?? '',
    card_color: v.card_color ?? '',
    vin: v.vin ?? '',
    current_mileage: v.current_mileage != null ? String(v.current_mileage) : '',
    engine_displacement: v.engine_displacement != null ? String(v.engine_displacement) : '',
    engine_config: (v.engine_config as EngineConfig) ?? '',
    cylinders: v.cylinders != null ? String(v.cylinders) : '',
    drive: (v.drive as DriveType) ?? '',
    transmission: (v.transmission as TransmissionType) ?? '',
    fuel_type: (v.fuel_type as FuelType) ?? '',
    purchase_date: v.purchase_date ?? '',
    license_plate: v.license_plate ?? '',
    license_plate_state: v.license_plate_state ?? '',
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

function EditField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, dark }: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad'
  autoCapitalize?: 'none' | 'words' | 'characters' | 'sentences'
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
        placeholderTextColor={dark ? '#444' : '#bbb'}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
        maxLength={maxLength}
      />
    </View>
  )
}

function OptionPicker<T extends string>({ label, value, options, onSelect, dark }: {
  label: string; value: T | ''; options: { label: string; value: T }[]
  onSelect: (v: T | '') => void; dark: boolean
}) {
  const s = styles(dark)
  return (
    <View style={s.fieldContainer}>
      <Text style={s.fieldLabel}>{label}</Text>
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

function SectionCard({ title, children, dark }: { title: string; children: React.ReactNode; dark: boolean }) {
  const s = styles(dark)
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionBody}>{children}</View>
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
          <Text style={s.modalTitle}>SELECT DATE</Text>
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

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { dark } = useTheme()
  const s = styles(dark)

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<VehicleForm | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  useFocusEffect(
    useCallback(() => {
      fetchVehicle()
    }, [id])
  )

  async function fetchVehicle() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single()
    if (!error && data) {
      setVehicle(data)
      setForm(vehicleToForm(data))
    }
    setLoading(false)
  }

  function setField(field: keyof VehicleForm, value: string) {
    setForm(prev => prev ? { ...prev, [field]: value } : prev)
  }

  function handleEditPress() {
    if (editing) {
      // Cancel — reset form to current vehicle data
      if (vehicle) setForm(vehicleToForm(vehicle))
      setEditing(false)
    } else {
      setEditing(true)
    }
  }

  async function handleSave() {
    if (!form || !vehicle) return

    // Validation
    if (!form.year || !form.make.trim() || !form.model.trim()) {
      Alert.alert('Missing fields', 'Year, Make, and Model are required.')
      return
    }
    const yearNum = parseInt(form.year)
    if (isNaN(yearNum) || yearNum < 1885 || yearNum > new Date().getFullYear() + 1) {
      Alert.alert('Invalid year', `Please enter a year between 1885 and ${new Date().getFullYear() + 1}.`)
      return
    }
    if (form.vin && form.vin.trim().length !== 17) {
      Alert.alert('Invalid VIN', 'VIN must be exactly 17 characters.')
      return
    }
    if (form.cylinders) {
      const cyl = parseInt(form.cylinders)
      if (isNaN(cyl) || cyl < 1 || cyl > 16) {
        Alert.alert('Invalid cylinders', 'Please enter a cylinder count between 1 and 16.')
        return
      }
    }

    setSaving(true)
    const { error } = await supabase
      .from('vehicles')
      .update({
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
        license_plate: form.license_plate.trim() || null,
        license_plate_state: form.license_plate_state.trim() || null,
      })
      .eq('id', vehicle.id)

    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    await fetchVehicle()
    setEditing(false)
  }

  async function handleDelete() {
    Alert.alert(
      'Delete Vehicle',
      'This will permanently delete this vehicle and all its maintenance records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('vehicles')
              .delete()
              .eq('id', id)
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

  if (loading || !vehicle || !form) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e3001b" />
      </View>
    )
  }

  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toUpperCase()

  // ── View Mode ────────────────────────────────────────────────
  const viewMode = (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

      {/* General */}
      <SectionCard title="GENERAL" dark={dark}>
        <ReadRow label="YEAR" value={String(vehicle.year)} dark={dark} />
        <ReadRow label="MAKE" value={vehicle.make} dark={dark} />
        <ReadRow label="MODEL" value={vehicle.model} dark={dark} />
        <ReadRow label="TRIM" value={vehicle.trim} dark={dark} />
        <ReadRow label="NICKNAME" value={vehicle.nickname} dark={dark} />
        <ReadRow label="COLOR" value={vehicle.color} dark={dark} />
        <CardColorPicker
          value={vehicle.card_color || null}
          onChange={() => {}}
          disabled={true}
        />        
        <ReadRow label="VIN" value={vehicle.vin} dark={dark} />
        <ReadRow
          label="MILEAGE"
          value={vehicle.current_mileage != null ? `${vehicle.current_mileage.toLocaleString()} mi` : null}
          dark={dark}
        />
      </SectionCard>

      {/* Engine — only show if any value exists */}
      {(vehicle.engine_displacement || vehicle.engine_config || vehicle.cylinders) ? (
        <SectionCard title="ENGINE" dark={dark}>
          <ReadRow label="DISPLACEMENT" value={vehicle.engine_displacement != null ? `${vehicle.engine_displacement}L` : null} dark={dark} />
          <ReadRow label="CONFIGURATION" value={vehicle.engine_config} dark={dark} />
          <ReadRow label="CYLINDERS" value={vehicle.cylinders != null ? String(vehicle.cylinders) : null} dark={dark} />
        </SectionCard>
      ) : null}

      {/* Drivetrain */}
      {(vehicle.drive || vehicle.transmission) ? (
        <SectionCard title="DRIVETRAIN" dark={dark}>
          <ReadRow label="DRIVE" value={vehicle.drive} dark={dark} />
          <ReadRow label="TRANSMISSION" value={vehicle.transmission} dark={dark} />
        </SectionCard>
      ) : null}

      {/* Other */}
      {(vehicle.fuel_type || vehicle.purchase_date || vehicle.license_plate || vehicle.license_plate_state) ? (
        <SectionCard title="OTHER" dark={dark}>
          <ReadRow label="FUEL TYPE" value={vehicle.fuel_type} dark={dark} />
          <ReadRow
            label="PURCHASE DATE"
            value={vehicle.purchase_date ? (() => {
              const [y, m, d] = vehicle.purchase_date!.split('-')
              return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
            })() : null}
            dark={dark}
          />
          <ReadRow label="LICENSE PLATE" value={vehicle.license_plate} dark={dark} />
          <ReadRow label="STATE" value={vehicle.license_plate_state} dark={dark} />
        </SectionCard>
      ) : null}

      {/* Delete */}
      <TouchableOpacity style={s.deleteButton} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={16} color="#e3001b" />
        <Text style={s.deleteButtonText}>DELETE VEHICLE</Text>
      </TouchableOpacity>

    </ScrollView>
  )

  // ── Edit Mode ────────────────────────────────────────────────
  const editMode = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DatePickerModal
        visible={showDatePicker}
        value={form.purchase_date}
        onConfirm={(date) => { setField('purchase_date', date); setShowDatePicker(false) }}
        onCancel={() => setShowDatePicker(false)}
        dark={dark}
      />
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* General */}
        <SectionCard title="GENERAL" dark={dark}>
          <EditField label="YEAR *" value={form.year} onChangeText={v => setField('year', v)} placeholder="e.g. 2008" keyboardType="numeric" autoCapitalize="none" maxLength={4} dark={dark} />
          <EditField label="MAKE *" value={form.make} onChangeText={v => setField('make', v)} placeholder="e.g. Toyota" dark={dark} />
          <EditField label="MODEL *" value={form.model} onChangeText={v => setField('model', v)} placeholder="e.g. 4Runner" dark={dark} />
          <EditField label="TRIM" value={form.trim} onChangeText={v => setField('trim', v)} placeholder="e.g. SR5" dark={dark} />
          <EditField label="NICKNAME" value={form.nickname} onChangeText={v => setField('nickname', v)} placeholder='e.g. "The Beast"' dark={dark} />
          <EditField label="COLOR" value={form.color} onChangeText={v => setField('color', v)} placeholder="e.g. Silver" dark={dark} />
          <EditField label="CURRENT MILEAGE" value={form.current_mileage} onChangeText={v => setField('current_mileage', v.replace(/[^0-9]/g, ''))} placeholder="e.g. 120000" keyboardType="numeric" autoCapitalize="none" dark={dark} />
          <CardColorPicker
            value={form.card_color || null}
            onChange={v => setField('card_color', v)}
            disabled={false}
          />
          <EditField label="VIN" value={form.vin} onChangeText={v => setField('vin', v.toUpperCase())} placeholder="17-character VIN" autoCapitalize="characters" maxLength={17} dark={dark} />
          <EditField label="CURRENT MILEAGE" value={form.current_mileage} onChangeText={v => setField('current_mileage', v.replace(/[^0-9]/g, ''))} placeholder="e.g. 120000" keyboardType="numeric" autoCapitalize="none" dark={dark} />
        </SectionCard>

        {/* Engine */}
        <SectionCard title="ENGINE" dark={dark}>
          <EditField label="DISPLACEMENT (L)" value={form.engine_displacement} onChangeText={v => setField('engine_displacement', v)} placeholder="e.g. 4.0" keyboardType="decimal-pad" autoCapitalize="none" dark={dark} />
          <OptionPicker label="CONFIGURATION" value={form.engine_config} options={ENGINE_CONFIGS} onSelect={v => setField('engine_config', v)} dark={dark} />
          <EditField label="CYLINDERS" value={form.cylinders} onChangeText={v => setField('cylinders', v.replace(/[^0-9]/g, ''))} placeholder="e.g. 6" keyboardType="numeric" autoCapitalize="none" dark={dark} />
        </SectionCard>

        {/* Drivetrain */}
        <SectionCard title="DRIVETRAIN" dark={dark}>
          <OptionPicker label="DRIVE" value={form.drive} options={DRIVE_TYPES} onSelect={v => setField('drive', v)} dark={dark} />
          <OptionPicker label="TRANSMISSION" value={form.transmission} options={TRANSMISSION_TYPES} onSelect={v => setField('transmission', v)} dark={dark} />
        </SectionCard>

        {/* Other */}
        <SectionCard title="OTHER" dark={dark}>
          <OptionPicker label="FUEL TYPE" value={form.fuel_type} options={FUEL_TYPES} onSelect={v => setField('fuel_type', v)} dark={dark} />
          <View style={s.fieldContainer}>
            <Text style={s.fieldLabel}>PURCHASE DATE</Text>
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
          <EditField label="LICENSE PLATE" value={form.license_plate} onChangeText={v => setField('license_plate', v.toUpperCase())} placeholder="e.g. ABC1234" autoCapitalize="characters" dark={dark} />
          <EditField label="STATE / REGION" value={form.license_plate_state} onChangeText={v => setField('license_plate_state', v.toUpperCase())} placeholder="e.g. CA" autoCapitalize="characters" maxLength={3} dark={dark} />
        </SectionCard>

        {/* Save */}
        <TouchableOpacity style={[s.saveButton, saving && s.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveButtonText}>SAVE CHANGES</Text>}
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity style={s.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color="#e3001b" />
          <Text style={s.deleteButtonText}>DELETE VEHICLE</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  )

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerButton}>
          <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={editing ? handleEditPress : handleEditPress} style={s.headerButton}>
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

  // Header
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

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48, gap: 12 },

  // Section
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

  // Read rows
  readRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: dark ? '#1f1f1f' : '#f8f8f8',
  },
  readLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: dark ? '#555' : '#aaa' },
  readValue: { fontSize: 14, fontWeight: '600', color: dark ? '#fff' : '#111', textAlign: 'right', flex: 1, marginLeft: 16 },

  // Edit fields
  fieldContainer: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: dark ? '#666' : '#999' },
  input: {
    height: 48, borderWidth: 1.5, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    backgroundColor: dark ? '#111' : '#fafafa', color: dark ? '#fff' : '#111',
    paddingHorizontal: 14, fontSize: 15,
  },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8', backgroundColor: dark ? '#111' : '#fafafa',
  },
  optionChipActive: { borderColor: '#e3001b', backgroundColor: '#e3001b' },
  optionChipText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: dark ? '#666' : '#999' },
  optionChipTextActive: { color: '#fff' },

  // Save button
  saveButton: {
    height: 52, backgroundColor: '#e3001b',
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 4 },

  // Delete button
  deleteButton: {
    height: 52, borderWidth: 1.5, borderColor: '#e3001b',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4,
  },
  deleteButtonText: { color: '#e3001b', fontSize: 12, fontWeight: '800', letterSpacing: 3 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: dark ? '#1a1a1a' : '#ffffff', padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 4, color: dark ? '#fff' : '#111', marginBottom: 12 },
  accentBarSmall: { height: 2, backgroundColor: '#e3001b', marginBottom: 20 },
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