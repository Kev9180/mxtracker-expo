import { Stack } from 'expo-router'
import { useTheme } from '../../../lib/ThemeContext'

export default function GarageLayout() {
  const { dark } = useTheme()
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' }
      }}
    />
  )
}