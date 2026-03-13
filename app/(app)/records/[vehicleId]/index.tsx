import 'react-native-gesture-handler'
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native'
import { useState, useCallback } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../../lib/supabase'
import { Database } from '../../../../types/database.types'
import { useTheme } from '../../../../lib/ThemeContext'

type MaintenanceRecord = Database['public']['Tables']['maintenance_records']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

interface Section {
  title: string
  data: MaintenanceRecord[]
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function groupByMonth(records: MaintenanceRecord[]): Section[] {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const groups: Record<string, MaintenanceRecord[]> = {}

  for (const record of records) {
    const dateStr = record.completed_date ?? record.next_due_date
    let key = 'No Date'
    if (dateStr) {
      const [y, m] = dateStr.split('-')
      key = `${months[parseInt(m) - 1]} ${y}`
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(record)
  }

  // Sort sections by date descending
  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === 'No Date') return 1
      if (b === 'No Date') return -1
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateB.getTime() - dateA.getTime()
    })
    .map(([title, data]) => ({ title, data }))
}

function StatusBadge({ status, dark }: { status: string; dark: boolean }) {
  const s = styles(dark)
  const config = {
    completed: { bg: '#1a3a1a', text: '#4caf50', label: 'COMPLETED' },
    upcoming: { bg: '#1a2a3a', text: '#2196f3', label: 'UPCOMING' },
    skipped: { bg: '#2a2a1a', text: '#ff9800', label: 'SKIPPED' },
  }[status] ?? { bg: '#2a2a2a', text: '#888', label: status.toUpperCase() }

  return (
    <View style={[s.badge, { backgroundColor: dark ? config.bg : config.text + '18' }]}>
      <Text style={[s.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  )
}

export default function VehicleRecordsScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>()
  const { dark } = useTheme()
  const s = styles(dark)

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [vehicleId])
  )

  async function fetchData() {
    const [vehicleRes, recordsRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
      supabase.from('maintenance_records')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('completed_date', { ascending: false }),
    ])

    if (vehicleRes.data) setVehicle(vehicleRes.data)
    if (recordsRes.data) setSections(groupByMonth(recordsRes.data))
    setLoading(false)
    setRefreshing(false)
  }

  const totalRecords = sections.reduce((sum, s) => sum + s.data.length, 0)

  async function deleteRecord(id: string) {
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
              .eq('id', id)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setSections(prev =>
                prev.map(section => ({
                  ...section,
                  data: section.data.filter(r => r.id !== id)
                })).filter(section => section.data.length > 0)
              )
            }
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e3001b" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toUpperCase() : ''}
            </Text>
            <Text style={s.headerSubtitle}>
              {totalRecords} {totalRecords === 1 ? 'RECORD' : 'RECORDS'}
            </Text>
          </View>
          <TouchableOpacity
            style={s.addButton}
            onPress={() => router.push(`/(app)/records/${vehicleId}/new`)}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={s.accentBar} />

        {totalRecords === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="construct-outline" size={64} color={dark ? '#2a2a2a' : '#e0e0e0'} />
            <Text style={s.emptyTitle}>NO RECORDS</Text>
            <Text style={s.emptySubtitle}>Tap + to add your first maintenance record</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor="#e3001b" />
            }
            renderSectionHeader={({ section }) => (
              <View style={s.sectionHeader}>
                <Text style={s.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              function renderRightActions() {
                return (
                  <TouchableOpacity
                    style={s.deleteAction}
                    onPress={() => deleteRecord(item.id)}
                  >
                    <Ionicons name="trash-outline" size={24} color="#fff" />
                    <Text style={s.deleteActionText}>DELETE</Text>
                  </TouchableOpacity>
                )
              }

              return (
                <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
                  <TouchableOpacity
                    style={s.card}
                    onPress={() => router.push(`/(app)/records/${vehicleId}/${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <View style={s.cardTop}>
                      <Text style={s.taskName} numberOfLines={1}>{item.task_name}</Text>
                      <StatusBadge status={item.status} dark={dark} />
                    </View>
                    <View style={s.cardBottom}>
                      <View style={s.cardMeta}>
                        <Ionicons name="calendar-outline" size={12} color={dark ? '#555' : '#aaa'} />
                        <Text style={s.cardMetaText}>
                          {item.completed_date
                            ? formatDate(item.completed_date)
                            : item.next_due_date
                              ? `Due ${formatDate(item.next_due_date)}`
                              : '—'
                          }
                        </Text>
                      </View>
                      {item.reminder_enabled && (
                        <View style={s.cardMeta}>
                          <Ionicons name="notifications-outline" size={12} color="#e3001b" />
                          <Text style={[s.cardMetaText, { color: '#e3001b' }]}>REMINDER ON</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              )
            }}
          />
        )}
      </View>
    </GestureHandlerRootView>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16, gap: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 14, fontWeight: '900', letterSpacing: 2,
    color: dark ? '#fff' : '#111',
  },
  headerSubtitle: {
    fontSize: 11, fontWeight: '600', letterSpacing: 3,
    color: dark ? '#555' : '#999', marginTop: 2,
  },
  addButton: {
    width: 44, height: 44, backgroundColor: '#e3001b',
    alignItems: 'center', justifyContent: 'center',
  },
  accentBar: {
    height: 2, backgroundColor: '#e3001b',
    marginHorizontal: 24, marginBottom: 16,
  },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  sectionHeader: {
    paddingVertical: 8, marginBottom: 8, marginTop: 8,
    borderBottomWidth: 1, borderBottomColor: dark ? '#2a2a2a' : '#e8e8e8',
  },
  sectionHeaderText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 3,
    color: dark ? '#555' : '#999',
  },
  card: {
    backgroundColor: dark ? '#1a1a1a' : '#fff',
    borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    padding: 16, marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  taskName: {
    fontSize: 15, fontWeight: '800',
    color: dark ? '#fff' : '#111', flex: 1, marginRight: 8,
  },
  cardBottom: { flexDirection: 'row', gap: 16 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    color: dark ? '#555' : '#aaa',
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '800', letterSpacing: 4,
    color: dark ? '#2a2a2a' : '#ccc',
  },
  emptySubtitle: { fontSize: 13, color: dark ? '#333' : '#bbb', letterSpacing: 1 },
  deleteAction: {
    backgroundColor: '#e3001b',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 4,
  },
})