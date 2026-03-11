import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export const CARD_COLORS = [
  // Whites & silvers
  { label: 'White', value: '#F5F5F5' },
  { label: 'Pearl', value: '#EAE6DA' },
  { label: 'Silver', value: '#A8A9AD' },
  { label: 'Gunmetal', value: '#6E7B8B' },
  // Blacks & grays
  { label: 'Charcoal', value: '#4A4A4A' },
  { label: 'Black', value: '#1A1A1A' },
  // Reds
  { label: 'Red', value: '#CC0000' },
  { label: 'Burgundy', value: '#800020' },
  { label: 'Maroon', value: '#5C0A0A' },
  // Blues
  { label: 'Sky Blue', value: '#4A90D9' },
  { label: 'Blue', value: '#1A4FA0' },
  { label: 'Navy', value: '#0A1F5C' },
  { label: 'Teal', value: '#007B7B' },
  // Greens
  { label: 'Green', value: '#2E7D32' },
  { label: 'Olive', value: '#6B6B00' },
  { label: 'Army', value: '#4A5240' },
  // Yellows & oranges
  { label: 'Yellow', value: '#F9C800' },
  { label: 'Gold', value: '#C8960C' },
  { label: 'Orange', value: '#E65100' },
  // Browns & tans
  { label: 'Brown', value: '#5D4037' },
  { label: 'Tan', value: '#C4A882' },
  // Purples & pinks
  { label: 'Purple', value: '#6A1B9A' },
  { label: 'Pink', value: '#D44C8A' },
  // Special
  { label: 'Bronze', value: '#9C6B30' },
]

interface Props {
  value: string | null
  onChange: (color: string) => void
  disabled?: boolean
}

export function CardColorPicker({ value, onChange, disabled }: Props) {
  const dark = useColorScheme() === 'dark'
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
      {value && (
        <Text style={s.selectedLabel}>
          {CARD_COLORS.find(c => c.value === value)?.label ?? value}
        </Text>
      )}
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
  selectedLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: dark ? '#888' : '#666',
  },
  swatchDisabled: {
    opacity: 0.35,
  },
})