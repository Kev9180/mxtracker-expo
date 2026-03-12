import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useState, useCallback } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import { Database } from '../../../types/database.types'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

interface VehicleWithReminderCount extends Vehicle {
  reminderCount: number
}

export default function RemindersScreen() {
  const dark = useColorScheme() === 'dark'
  const s = styles(dark)

  const [vehicles, setVehicles] = useState<VehicleWithReminderCount[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      fetchVehicles()
    }, [])
  )

  async function fetchVehicles() {
    const [vehiclesRes, remindersRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
      supabase.from('maintenance_records')
        .select('vehicle_id')
        .eq('reminder_enabled', true),
    ])

    if (vehiclesRes.data) {
      const reminderCounts: Record<string, number> = {}
      if (remindersRes.data) {
        for (const r of remindersRes.data) {
          reminderCounts[r.vehicle_id] = (reminderCounts[r.vehicle_id] ?? 0) + 1
        }
      }
      setVehicles(vehiclesRes.data.map(v => ({
        ...v,
        reminderCount: reminderCounts[v.id] ?? 0,
      })))
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e3001b" />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>REMINDERS</Text>
        <Text style={s.headerSubtitle}>SELECT A VEHICLE</Text>
      </View>
      <View style={s.accentBar} />

      {vehicles.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="notifications-outline" size={64} color={dark ? '#2a2a2a' : '#e0e0e0'} />
          <Text style={s.emptyTitle}>NO VEHICLES</Text>
          <Text style={s.emptySubtitle}>Add a vehicle in the Garage tab first</Text>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const title = `${item.year} ${item.make} ${item.model}`
            const subtitle = [item.trim, item.nickname].filter(Boolean).join(' · ')
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => router.push(`/(app)/reminders/${item.id}`)}
                activeOpacity={0.8}
              >
                <View style={[s.colorBar, { backgroundColor: item.card_color ?? '#e3001b' }]}>
                  <View style={s.colorBarInner} />
                </View>
                <View style={s.cardBody}>
                  <View style={s.cardHeader}>
                    <Text style={s.cardTitle} numberOfLines={1}>{title}</Text>
                    <View style={s.cardRight}>
                      {item.reminderCount > 0 && (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>{item.reminderCount}</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={dark ? '#444' : '#ccc'} />
                    </View>
                  </View>
                  {subtitle ? <Text style={s.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
                </View>              
              </TouchableOpacity>            
            )
          }}
        />
      )}
    </View>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },
  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 4, color: dark ? '#fff' : '#111' },
  headerSubtitle: { fontSize: 11, fontWeight: '600', letterSpacing: 3, color: dark ? '#555' : '#999', marginTop: 2 },
  accentBar: { height: 2, backgroundColor: '#e3001b', marginHorizontal: 24, marginBottom: 16 },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: dark ? '#1a1a1a' : '#ffffff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    overflow: 'hidden',
  },
  colorBar: { 
    width: 8, 
    alignSelf: 'stretch',
    position: 'relative'
  },
  colorBarInner: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    width: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardBody: { flex: 1, padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: dark ? '#fff' : '#111', letterSpacing: 0.5 },
  cardSubtitle: { fontSize: 13, color: dark ? '#555' : '#999', marginTop: 4, letterSpacing: 0.5 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
  },  
  badge: {
    backgroundColor: '#e3001b',
    minWidth: 20, height: 20,
    borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 4, color: dark ? '#2a2a2a' : '#ccc' },
  emptySubtitle: { fontSize: 13, color: dark ? '#333' : '#bbb', letterSpacing: 1 },
})