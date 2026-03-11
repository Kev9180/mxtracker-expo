import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'

export default function RecordsLayout() {
  const dark = useColorScheme() === 'dark'
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' }
      }}
    />
  )
}