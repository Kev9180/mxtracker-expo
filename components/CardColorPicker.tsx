import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../lib/ThemeContext'

export const CARD_COLORS = [
  // Neutrals
  { label: 'White', value: '#F5F5F5' },
  { label: 'Black', value: '#1A1A1A' },
  { label: 'Silver', value: '#A8A9AD' },
  { label: 'Charcoal', value: '#4A4A4A' },
  { label: 'Gray', value: '#808080' },
  // Warm colors
  { label: 'Red', value: '#CC0000' },
  { label: 'Orange', value: '#E65100' },
  { label: 'Yellow', value: '#F9C800' },
  // Greens
  { label: 'Light Green', value: '#7FBB3B' },
  { label: 'Dark Green', value: '#2E7D32' },
  // Blues
  { label: 'Light Blue', value: '#4A90D9' },
  { label: 'Navy', value: '#0A1F5C' },
  // Purple
  { label: 'Purple', value: '#9C27B0' },
  // Earth tones & luxury
  { label: 'Champagne', value: '#F5E6D3' },
  { label: 'Tan', value: '#C4A882' },
  { label: 'Pearl', value: '#EAE6DA' },
]

interface Props {
  value: string | null
  onChange: (color: string) => void
  disabled?: boolean
}

export function CardColorPicker({ value, onChange, disabled }: Props) {
  const { dark } = useTheme()
  const s = styles(dark)

  return (
    <View style={s.container}>
      <Text style={s.label}>CARD COLOR</Text>
      <View style={s.grid}>
        {CARD_COLORS.map((color) => {
          const selected = value === color.value
          const isLight = isLightColor(color.value)
          return (
            <TouchableOpacity
            key={color.value}
            style={[s.swatch, { backgroundColor: color.value }, selected && s.swatchSelected, disabled && s.swatchDisabled]}
            onPress={() => !disabled && onChange(color.value)}
            activeOpacity={disabled ? 1 : 0.8}
            >
              {selected && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={isLight ? '#333' : '#fff'}
                />
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// Determine if a hex color is light enough to need a dark checkmark
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { gap: 8 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: dark ? '#666' : '#999',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  },
  swatchSelected: {
    borderWidth: 2.5,
    borderColor: dark ? '#fff' : '#111',
  },
  swatchDisabled: {
    opacity: 0.35,
  },
})