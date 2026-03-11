import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native'
import { useEffect, useState, useCallback } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import { Database } from '../../../types/database.types'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

export default function GarageScreen() {
  const scheme = useColorScheme()
  const dark = scheme === 'dark'
  const s = styles(dark)

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setVehicles(data)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchVehicles() }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchVehicles()
  }, [])

  function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    const subtitle = [vehicle.trim, vehicle.nickname].filter(Boolean).join(' · ')

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/(app)/garage/${vehicle.id}`)}
        activeOpacity={0.8}
      >
        {/* Photo or placeholder */}
        <View style={s.photoContainer}>
          {vehicle.photo_url ? (
            <Image source={{ uri: vehicle.photo_url }} style={s.photo} />
          ) : (
            <View style={s.photoPlaceholder}>
              <Ionicons name="car-outline" size={40} color={dark ? '#333' : '#ccc'} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={s.cardBody}>
          <View style={s.cardHeader}>
            <Text style={s.vehicleTitle} numberOfLines={1}>{title}</Text>
            <Ionicons name="chevron-forward" size={16} color={dark ? '#444' : '#ccc'} />
          </View>
          {subtitle ? (
            <Text style={s.vehicleSubtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}

          {/* Divider */}
          <View style={s.divider} />

          {/* Stats row */}
          <View style={s.statsRow}>
            {vehicle.current_mileage ? (
              <View style={s.stat}>
                <Ionicons name="speedometer-outline" size={12} color={dark ? '#555' : '#aaa'} />
                <Text style={s.statText}>
                  {vehicle.current_mileage.toLocaleString()} mi
                </Text>
              </View>
            ) : null}
            {vehicle.fuel_type ? (
              <View style={s.stat}>
                <Ionicons name="flame-outline" size={12} color={dark ? '#555' : '#aaa'} />
                <Text style={s.statText}>{vehicle.fuel_type}</Text>
              </View>
            ) : null}
            {vehicle.drive ? (
              <View style={s.stat}>
                <Ionicons name="git-network-outline" size={12} color={dark ? '#555' : '#aaa'} />
                <Text style={s.statText}>{vehicle.drive}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  function EmptyState() {
    return (
      <View style={s.emptyState}>
        <Ionicons name="car-outline" size={64} color={dark ? '#2a2a2a' : '#e0e0e0'} />
        <Text style={s.emptyTitle}>NO VEHICLES</Text>
        <Text style={s.emptySubtitle}>Add your first vehicle to get started</Text>
      </View>
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
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>GARAGE</Text>
          <Text style={s.headerSubtitle}>
            {vehicles.length} {vehicles.length === 1 ? 'VEHICLE' : 'VEHICLES'}
          </Text>
        </View>
        <TouchableOpacity
          style={s.addButton}
          onPress={() => router.push('/(app)/garage/new')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Red accent bar */}
      <View style={s.accentBar} />

      {/* Vehicle list */}
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e3001b"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark ? '#0f0f0f' : '#f5f5f0',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    color: dark ? '#fff' : '#111',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: dark ? '#555' : '#999',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: '#e3001b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentBar: {
    height: 2,
    backgroundColor: '#e3001b',
    marginHorizontal: 24,
    marginBottom: 16,
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    flexGrow: 1,
  },

  // Card
  card: {
    backgroundColor: dark ? '#1a1a1a' : '#ffffff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    overflow: 'hidden',
  },
  photoContainer: {
    width: '100%',
    height: 180,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: dark ? '#111' : '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: dark ? '#fff' : '#111',
    letterSpacing: 0.5,
    flex: 1,
  },
  vehicleSubtitle: {
    fontSize: 13,
    color: dark ? '#555' : '#999',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: dark ? '#2a2a2a' : '#f0f0f0',
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: dark ? '#555' : '#aaa',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'capitalize',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 4,
    color: dark ? '#2a2a2a' : '#ccc',
  },
  emptySubtitle: {
    fontSize: 13,
    color: dark ? '#333' : '#bbb',
    letterSpacing: 1,
  },
})