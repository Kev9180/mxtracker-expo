import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useState, useCallback } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../../lib/supabase'
import { Database } from '../../../../types/database.types'
import { useTheme } from '../../../../lib/ThemeContext'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

export default function VehicleHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { dark } = useTheme()
  const s = styles(dark)

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data) setVehicle(data)
          setLoading(false)
        })
    }, [id])
  )

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#e3001b" />
      </View>
    )
  }

  const title = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toUpperCase()
    : 'VEHICLE'

  const subtitle = vehicle?.nickname ? `"${vehicle.nickname}"` : (vehicle?.trim ?? null)

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerButton}>
          <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => router.push('/(app)/settings')} style={s.headerButton}>
          <Ionicons name="settings-outline" size={22} color={dark ? '#fff' : '#111'} />
        </TouchableOpacity>
      </View>
      <View style={s.accentBar} />

      {/* Nav cards */}
      <View style={s.cardList}>

        <TouchableOpacity
          style={s.navCard}
          onPress={() => router.push(`/(app)/garage/${id}/details`)}
          activeOpacity={0.8}
        >
          <View style={s.navCardIcon}>
            <Ionicons name="car-outline" size={28} color="#e3001b" />
          </View>
          <View style={s.navCardContent}>
            <Text style={s.navCardTitle}>VEHICLE DETAILS</Text>
            <Text style={s.navCardSubtitle}>View and edit vehicle info</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={dark ? '#444' : '#ccc'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.navCard}
          onPress={() => router.push(`/(app)/garage/${id}/records`)}
          activeOpacity={0.8}
        >
          <View style={s.navCardIcon}>
            <Ionicons name="construct-outline" size={28} color="#e3001b" />
          </View>
          <View style={s.navCardContent}>
            <Text style={s.navCardTitle}>MAINTENANCE RECORDS</Text>
            <Text style={s.navCardSubtitle}>Service history and logs</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={dark ? '#444' : '#ccc'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.navCard}
          onPress={() => router.push(`/(app)/garage/${id}/reminders`)}
          activeOpacity={0.8}
        >
          <View style={s.navCardIcon}>
            <Ionicons name="notifications-outline" size={28} color="#e3001b" />
          </View>
          <View style={s.navCardContent}>
            <Text style={s.navCardTitle}>REMINDERS</Text>
            <Text style={s.navCardSubtitle}>Upcoming and overdue services</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={dark ? '#444' : '#ccc'} />
        </TouchableOpacity>

      </View>
    </View>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
  },
  headerButton: { width: 44, height: 40, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    color: dark ? '#fff' : '#111',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: dark ? '#888' : '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  accentBar: {
    height: 2,
    backgroundColor: '#e3001b',
    marginHorizontal: 24,
    marginBottom: 32,
  },

  cardList: {
    paddingHorizontal: 24,
    gap: 12,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark ? '#1a1a1a' : '#ffffff',
    borderWidth: 1,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    padding: 20,
    gap: 16,
  },
  navCardIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dark ? '#111' : '#f5f5f0',
    borderWidth: 1,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
  },
  navCardContent: { flex: 1 },
  navCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    color: dark ? '#fff' : '#111',
    marginBottom: 3,
  },
  navCardSubtitle: {
    fontSize: 12,
    color: dark ? '#888' : '#666',
    letterSpacing: 0.5,
  },
})
