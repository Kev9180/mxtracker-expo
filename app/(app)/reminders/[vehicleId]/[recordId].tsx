import { Redirect, useLocalSearchParams } from 'expo-router'

export default function OldReminderDeepLinkRedirect() {
  const { vehicleId, recordId } = useLocalSearchParams<{ vehicleId: string; recordId: string }>()
  return <Redirect href={`/(app)/garage/${vehicleId}/reminders/${recordId}` as any} />
}
