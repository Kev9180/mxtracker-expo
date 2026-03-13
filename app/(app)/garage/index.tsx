import 'react-native-gesture-handler'
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert
} from 'react-native'
import { useEffect, useState, useCallback } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import { Database } from '../../../types/database.types'
import { useProfile } from '../../../lib/ProfileContext'
import { useTheme } from '../../../lib/ThemeContext'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

export default function GarageScreen() {
  const { dark } = useTheme()
  const s = styles(dark)

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { profile } = useProfile()

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setVehicles(data)
    setLoading(false)
    setRefreshing(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchVehicles()
    }, [])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchVehicles()
  }, [])

  function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    const subtitle = [vehicle.trim, vehicle.nickname].filter(Boolean).join(' · ')

    function renderRightActions() {
      return (
        <TouchableOpacity
          style={s.deleteAction}
          onPress={() => deleteVehicle(vehicle.id)}
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
          onPress={() => router.push(`/(app)/garage/${vehicle.id}`)}
          activeOpacity={0.8}
        >
          {/* Color accent bar */}
          <View style={[s.colorBar, { backgroundColor: vehicle.card_color ?? '#e3001b' }]}>
            <View style={s.colorBarInner} />
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
            <View style={s.divider} />
            <View style={s.statsRow}>
              {vehicle.current_mileage ? (
                <View style={s.stat}>
                  <Ionicons name="speedometer-outline" size={12} color={dark ? '#555' : '#aaa'} />
                  <Text style={s.statText}>
                    {vehicle.current_mileage.toLocaleString()} {profile?.odometer_unit === 'kilometers' ? 'km' : 'mi'}
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
      </Swipeable>
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

  async function deleteVehicle(id: string) {
    Alert.alert(
      'Delete Vehicle',
      'This will permanently delete the vehicle and all its maintenance records. This cannot be undone.',
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
              setVehicles(prev => prev.filter(v => v.id !== id))
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
    </GestureHandlerRootView>
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
    flexDirection: 'row',
  },
  cardBody: {
    flex: 1,
    padding: 16
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

  // Delete action
  deleteAction: {
    backgroundColor: '#e3001b',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 16,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 4,
  },
})