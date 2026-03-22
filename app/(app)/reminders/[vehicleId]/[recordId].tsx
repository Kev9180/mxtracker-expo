import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useCallback, useState } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../../lib/supabase'
import { Database } from '../../../../types/database.types'
import { useTheme } from '../../../../lib/ThemeContext'

type MaintenanceRecord = Database['public']['Tables']['maintenance_records']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No date set'
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [y, m, d] = dateStr.split('-')
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function formatInterval(years: number | null, months: number | null, days: number | null): string {
  const parts = []
  if (years) parts.push(`${years} yr`)
  if (months) parts.push(`${months} mo`)
  if (days) parts.push(`${days} d`)
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

export default function ReminderDetailScreen() {
  const { vehicleId, recordId } = useLocalSearchParams<{ vehicleId: string; recordId: string }>()
  const { dark } = useTheme()
  const s = styles(dark)

  const [record, setRecord] = useState<MaintenanceRecord | null>(null)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [recordId, vehicleId])
  )

  async function fetchData() {
    setLoading(true)
    const [recordRes, vehicleRes] = await Promise.all([
      supabase.from('maintenance_records').select('*').eq('id', recordId).single(),
      supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
    ])
    if (recordRes.data) setRecord(recordRes.data)
    if (vehicleRes.data) setVehicle(vehicleRes.data)
    setLoading(false)
  }

  function handleMarkComplete() {
    if (!record) return
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${mm}-${dd}`

    router.push({
      pathname: '/(app)/records/[vehicleId]/new',
      params: {
        vehicleId,
        prefillTaskName: record.task_name,
        prefillDate: todayStr,
        fromReminderId: record.id,
      },
    })
  }

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e3001b" />
      </View>
    )
  }

  if (!record) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: dark ? '#fff' : '#111' }}>Reminder not found.</Text>
      </View>
    )
  }

  const overdue = isOverdue(record.next_due_date)
  const days = daysUntil(record.next_due_date)

  let urgencyText: string
  let urgencyColor: string
  if (overdue) {
    const ago = Math.abs(days ?? 0)
    urgencyText = ago === 0 ? 'Due today' : `${ago} day${ago === 1 ? '' : 's'} overdue`
    urgencyColor = '#e3001b'
  } else if (days === 0) {
    urgencyText = 'Due today'
    urgencyColor = '#e3001b'
  } else if (days !== null) {
    urgencyText = `Due in ${days} day${days === 1 ? '' : 's'}`
    urgencyColor = '#2196f3'
  } else {
    urgencyText = 'No due date'
    urgencyColor = dark ? '#555' : '#aaa'
  }

  const vehicleTitle = vehicle
    ? (vehicle.nickname
      ? `${vehicle.nickname} (${vehicle.year} ${vehicle.make} ${vehicle.model})`
      : `${vehicle.year} ${vehicle.make} ${vehicle.model}`)
    : ''

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/(app)/reminders')} style={s.backButton}>
          <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>REMINDER</Text>
          <Text style={s.headerSubtitle} numberOfLines={1}>{vehicleTitle.toUpperCase()}</Text>
        </View>
      </View>
      <View style={s.accentBar} />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Urgency banner */}
        <View style={[s.urgencyBanner, { backgroundColor: overdue ? '#e3001b' : '#1a1a2e' }]}>
          <Ionicons
            name={overdue ? 'warning-outline' : 'notifications-outline'}
            size={20}
            color="#fff"
          />
          <Text style={s.urgencyText}>{urgencyText.toUpperCase()}</Text>
        </View>

        {/* Task card */}
        <View style={s.card}>
          <Text style={s.cardLabel}>TASK</Text>
          <Text style={s.taskName}>{record.task_name}</Text>

          <View style={s.divider} />

          <View style={s.infoRow}>
            <View style={s.infoItem}>
              <Text style={s.infoLabel}>DUE DATE</Text>
              <Text style={[s.infoValue, overdue && { color: '#e3001b' }]}>
                {formatDate(record.next_due_date)}
              </Text>
            </View>
            <View style={s.infoItem}>
              <Text style={s.infoLabel}>INTERVAL</Text>
              <Text style={s.infoValue}>
                {formatInterval(record.interval_years, record.interval_months, record.interval_days)}
              </Text>
            </View>
          </View>

          {record.next_due_date && (
            <View style={s.infoRow}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>LAST DONE</Text>
                <Text style={s.infoValue}>{formatDate(record.completed_date)}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>STATUS</Text>
                <Text style={[s.infoValue, { color: urgencyColor }]}>
                  {overdue ? 'OVERDUE' : 'UPCOMING'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Mark as Complete button */}
        <TouchableOpacity style={s.completeButton} onPress={handleMarkComplete} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={s.completeButtonText}>MARK AS COMPLETE</Text>
        </TouchableOpacity>

        <Text style={s.completeHint}>
          This will open the new record screen pre-filled with today's date and the task name. The reminder will update automatically once saved.
        </Text>

        {/* View full record link */}
        <TouchableOpacity
          style={s.viewRecordButton}
          onPress={() => router.push(`/(app)/records/${vehicleId}/${recordId}`)}
        >
          <Text style={s.viewRecordText}>VIEW FULL MAINTENANCE RECORD</Text>
          <Ionicons name="chevron-forward" size={14} color={dark ? '#555' : '#aaa'} />
        </TouchableOpacity>

      </ScrollView>
    </View>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16, gap: 12,
  },
  backButton: { padding: 4, marginRight: 4 },
  headerTitle: {
    fontSize: 18, fontWeight: '900', letterSpacing: 3,
    color: dark ? '#fff' : '#111',
  },
  headerSubtitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    color: dark ? '#555' : '#aaa', marginTop: 2,
  },
  accentBar: { height: 3, backgroundColor: '#e3001b', marginHorizontal: 24, borderRadius: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },

  urgencyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 4, marginBottom: 20,
  },
  urgencyText: {
    color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 2,
  },

  card: {
    backgroundColor: dark ? '#1a1a1a' : '#fff',
    borderRadius: 4, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: dark ? '#222' : '#ebebeb',
  },
  cardLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 3,
    color: dark ? '#555' : '#999', marginBottom: 8,
  },
  taskName: {
    fontSize: 24, fontWeight: '900', letterSpacing: 1,
    color: dark ? '#fff' : '#111',
  },
  divider: { height: 1, backgroundColor: dark ? '#222' : '#f0f0f0', marginVertical: 16 },
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  infoItem: { flex: 1 },
  infoLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 2,
    color: dark ? '#555' : '#999', marginBottom: 4,
  },
  infoValue: {
    fontSize: 14, fontWeight: '700', color: dark ? '#ccc' : '#333',
  },

  completeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#e3001b', padding: 18, borderRadius: 4, marginBottom: 12,
  },
  completeButtonText: {
    color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 2,
  },
  completeHint: {
    fontSize: 12, color: dark ? '#444' : '#aaa',
    textAlign: 'center', lineHeight: 18, marginBottom: 32,
  },

  viewRecordButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14,
  },
  viewRecordText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2,
    color: dark ? '#555' : '#aaa',
  },
})