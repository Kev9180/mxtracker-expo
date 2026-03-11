import { Tabs } from 'expo-router'
import { Text, useColorScheme } from 'react-native'

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
        options={{ href: null }} // hide the redirect from tab bar
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'GARAGE',
          tabBarIcon: ({ color }) => <TabIcon icon="🚗" />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'RECORDS',
          tabBarIcon: ({ color }) => <TabIcon icon="🔧" />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'REMINDERS',
          tabBarIcon: ({ color }) => <TabIcon icon="🔔" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SETTINGS',
          tabBarIcon: ({ color }) => <TabIcon icon="⚙️" />,
        }}
      />
    </Tabs>
  )
}

function TabIcon({ icon }: { icon: string }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>
}