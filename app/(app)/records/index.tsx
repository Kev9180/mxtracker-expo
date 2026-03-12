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

export default function RecordsScreen() {
  const dark = useColorScheme() === 'dark'
  const s = styles(dark)

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      fetchVehicles()
    }, [])
  )

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setVehicles(data)
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
        <Text style={s.headerTitle}>RECORDS</Text>
        <Text style={s.headerSubtitle}>SELECT A VEHICLE</Text>
      </View>
      <View style={s.accentBar} />

      {vehicles.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="car-outline" size={64} color={dark ? '#2a2a2a' : '#e0e0e0'} />
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
                onPress={() => router.push(`/(app)/records/${item.id}`)}
                activeOpacity={0.8}
              >
                <View style={[s.colorBar, { backgroundColor: item.card_color ?? '#e3001b' }]}>
                  <View style={s.colorBarInner} />
                </View>
                <View style={s.cardBody}>
                  <View style={s.cardRow}>
                    <Text style={s.cardTitle} numberOfLines={1}>{title}</Text>
                    <Ionicons name="chevron-forward" size={16} color={dark ? '#444' : '#ccc'} />
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
  header: {
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28, fontWeight: '900', letterSpacing: 4,
    color: dark ? '#fff' : '#111',
  },
  headerSubtitle: {
    fontSize: 11, fontWeight: '600', letterSpacing: 3,
    color: dark ? '#555' : '#999', marginTop: 2,
  },
  accentBar: {
    height: 2, backgroundColor: '#e3001b',
    marginHorizontal: 24, marginBottom: 16,
  },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    backgroundColor: dark ? '#1a1a1a' : '#ffffff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    overflow: 'hidden',
  },
  colorBar: {
    width: 8,
    alignSelf: 'stretch',
  },
  colorBarInner: {
    position: 'absolute',
    top: 0, bottom: 0, right: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardBody: {
    flex: 1,
    padding: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: dark ? '#fff' : '#111',
    letterSpacing: 0.5,
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 13,
    color: dark ? '#555' : '#999',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '800', letterSpacing: 4,
    color: dark ? '#2a2a2a' : '#ccc',
  },
  emptySubtitle: { fontSize: 13, color: dark ? '#333' : '#bbb', letterSpacing: 1 },
})