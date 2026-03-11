import { Tabs } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function AppLayout() {
  const scheme = useColorScheme()
  const dark = scheme === 'dark'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#e3001b',
        tabBarInactiveTintColor: dark ? '#555' : '#999',
        tabBarStyle: {
          backgroundColor: dark ? '#0f0f0f' : '#ffffff',
          borderTopColor: dark ? '#1a1a1a' : '#eeeeee',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'GARAGE',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'RECORDS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'REMINDERS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  )
}