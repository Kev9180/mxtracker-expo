import 'react-native-gesture-handler'
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler'
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native'
import { useState, useCallback } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import { Database } from '../../../types/database.types'

type MaintenanceRecord = Database['public']['Tables']['maintenance_records']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No date set'
  const [y, m, d] = dateStr.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return new Date(dateStr + 'T12:00:00') < new Date()
}

export default function VehicleRemindersScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>()
  const dark = useColorScheme() === 'dark'
  const s = styles(dark)

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [reminders, setReminders] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [vehicleId])
  )

  async function fetchData() {
    const [vehicleRes, remindersRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', vehicleId).single(),
      supabase.from('maintenance_records')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .eq('reminder_enabled', true)
        .order('next_due_date', { ascending: true }),
    ])

    if (vehicleRes.data) setVehicle(vehicleRes.data)
    if (remindersRes.data) setReminders(remindersRes.data)
    setLoading(false)
    setRefreshing(false)
  }

  async function disableReminder(record: MaintenanceRecord) {
    Alert.alert(
      'Delete Reminder',
      `This will turn off the reminder for "${record.task_name}". The maintenance record will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('maintenance_records')
              .update({ reminder_enabled: false })
              .eq('id', record.id)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setReminders(prev => prev.filter(r => r.id !== record.id))
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

  const title = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toUpperCase()
    : ''

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
            <Text style={s.headerSubtitle}>
              {reminders.length} {reminders.length === 1 ? 'REMINDER' : 'REMINDERS'}
            </Text>
          </View>
        </View>
        <View style={s.accentBar} />

        {reminders.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="notifications-outline" size={64} color={dark ? '#2a2a2a' : '#e0e0e0'} />
            <Text style={s.emptyTitle}>NO REMINDERS</Text>
            <Text style={s.emptySubtitle}>Add a reminder when logging a maintenance record</Text>
          </View>
        ) : (
          <FlatList
            data={reminders}
            keyExtractor={item => item.id}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchData() }}
                tintColor="#e3001b"
              />
            }
            renderItem={({ item }) => {
              const overdue = isOverdue(item.next_due_date)

              function renderRightActions() {
                return (
                  <TouchableOpacity
                    style={s.deleteAction}
                    onPress={() => disableReminder(item)}
                  >
                    <Ionicons name="notifications-off-outline" size={22} color="#fff" />
                    <Text style={s.deleteActionText}>DELETE</Text>
                  </TouchableOpacity>
                )
              }

              return (
                <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
                  <TouchableOpacity
                    style={s.card}
                    onPress={() => router.push(`/(app)/reminders/${vehicleId}/${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.statusBar, { backgroundColor: overdue ? '#e3001b' : '#2196f3' }]} />
                    <View style={s.cardBody}>
                      <View style={s.cardRow}>
                        <Text style={s.taskName} numberOfLines={1}>{item.task_name}</Text>
                        <View style={[s.badge, { backgroundColor: overdue ? '#e3001b18' : '#2196f318' }]}>
                          <Text style={[s.badgeText, { color: overdue ? '#e3001b' : '#2196f3' }]}>
                            {overdue ? 'OVERDUE' : 'UPCOMING'}
                          </Text>
                        </View>
                      </View>
                      <View style={s.dueDateRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={overdue ? '#e3001b' : (dark ? '#555' : '#aaa')}
                        />
                        <Text style={[s.dueDateText, overdue && s.dueDateOverdue]}>
                          {overdue ? 'Was due ' : 'Due '}{formatDate(item.next_due_date)}
                        </Text>
                      </View>
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
  headerTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 2, color: dark ? '#fff' : '#111' },
  headerSubtitle: { fontSize: 11, fontWeight: '600', letterSpacing: 3, color: dark ? '#555' : '#999', marginTop: 2 },
  accentBar: { height: 2, backgroundColor: '#e3001b', marginHorizontal: 24, marginBottom: 16 },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    backgroundColor: dark ? '#1a1a1a' : '#fff',
    borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    marginBottom: 10, overflow: 'hidden',
  },
  statusBar: { width: 8, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 16 },
  cardRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  taskName: {
    fontSize: 15, fontWeight: '800',
    color: dark ? '#fff' : '#111', flex: 1, marginRight: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueDateText: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    color: dark ? '#555' : '#aaa',
  },
  dueDateOverdue: { color: '#e3001b' },
  deleteAction: {
    backgroundColor: '#e3001b',
    justifyContent: 'center', alignItems: 'center',
    width: 80, marginBottom: 10,
  },
  deleteActionText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 4, color: dark ? '#2a2a2a' : '#ccc' },
  emptySubtitle: { fontSize: 13, color: dark ? '#333' : '#bbb', letterSpacing: 1, textAlign: 'center', paddingHorizontal: 40 },
})