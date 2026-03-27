import 'react-native-gesture-handler'
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform
} from 'react-native'
import { useState, useCallback } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as Crypto from 'expo-crypto'
import * as FileSystem from 'expo-file-system'
import { supabase } from '../../../../../lib/supabase'
import { Database } from '../../../../../types/database.types'
import { useTheme } from '../../../../../lib/ThemeContext'
import { useProfile } from '../../../../../lib/ProfileContext'

type MaintenanceRecord = Database['public']['Tables']['maintenance_records']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

interface Section {
  title: string
  data: MaintenanceRecord[]
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function formatDateTimeLong(isoStr: string | null | undefined): string {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function groupByMonth(records: MaintenanceRecord[]): Section[] {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const groups: Record<string, MaintenanceRecord[]> = {}

  for (const record of records) {
    const dateStr = record.completed_date ?? record.next_due_date
    let key = 'No Date'
    if (dateStr) {
      const [y, m] = dateStr.split('-')
      key = `${months[parseInt(m) - 1]} ${y}`
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(record)
  }

  // Sort sections by date descending
  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === 'No Date') return 1
      if (b === 'No Date') return -1
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateB.getTime() - dateA.getTime()
    })
    .map(([title, data]) => ({ title, data }))
}

function StatusBadge({ dark }: { dark: boolean }) {
  const s = styles(dark)
  return (
    <View style={[s.badge, { backgroundColor: dark ? '#1a3a1a' : '#4caf5018' }]}>
      <Text style={[s.badgeText, { color: '#4caf50' }]}>COMPLETED</Text>
    </View>
  )
}

export default function VehicleRecordsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { dark } = useTheme()
  const { profile } = useProfile()
  const s = styles(dark)

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [id])
  )

  async function fetchData() {
    const [vehicleRes, recordsRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', id).single(),
      supabase.from('maintenance_records')
        .select('*')
        .eq('vehicle_id', id)
        .order('completed_date', { ascending: false }),
    ])

    if (vehicleRes.data) setVehicle(vehicleRes.data)
    if (recordsRes.data) setSections(groupByMonth(recordsRes.data))
    setLoading(false)
    setRefreshing(false)
  }

  const totalRecords = sections.reduce((sum, s) => sum + s.data.length, 0)

  async function deleteRecord(id: string) {
    Alert.alert(
      'Delete Record',
      'This will permanently delete this maintenance record. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('maintenance_records')
              .delete()
              .eq('id', id)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setSections(prev =>
                prev.map(section => ({
                  ...section,
                  data: section.data.filter(r => r.id !== id)
                })).filter(section => section.data.length > 0)
              )
            }
          }
        }
      ]
    )
  }

  async function exportRecords() {
    if (!vehicle) return
    const v = vehicle
    const allRecords = sections.flatMap(s => s.data)
    if (allRecords.length === 0) {
      Alert.alert('No Records', 'Add some maintenance records before exporting.')
      return
    }

    const confirmMessage = `This will generate a PDF report for your ${v.year} ${v.make} ${v.model} containing ${allRecords.length} record${allRecords.length === 1 ? '' : 's'}.\n\nNote: This is a self-reported record. VIN and service data have not been independently verified.`

    async function doExport() {
      setExporting(true)
      try {
              // Fetch audit logs for all records in one query
              const recordIds = allRecords.map(r => r.id)
              const { data: auditLogs } = await supabase
                .from('maintenance_record_audit')
                .select('*')
                .in('maintenance_record_id', recordIds)
                .order('changed_at', { ascending: true })

              const auditMap: Record<string, typeof auditLogs> = {}
              for (const log of auditLogs ?? []) {
                if (!auditMap[log.maintenance_record_id]) auditMap[log.maintenance_record_id] = []
                auditMap[log.maintenance_record_id]!.push(log)
              }

              // Sort records by completed_date ascending for the report
              const sorted = [...allRecords].sort((a, b) => {
                if (!a.completed_date) return 1
                if (!b.completed_date) return -1
                return new Date(a.completed_date).getTime() - new Date(b.completed_date).getTime()
              })

              // Generate SHA-256 hash of the record snapshot for verification
              const snapshot = JSON.stringify(sorted.map(r => ({
                id: r.id, task_name: r.task_name, completed_date: r.completed_date,
                mileage_at_service: r.mileage_at_service, cost: r.cost,
                created_at: r.created_at, updated_at: r.updated_at,
              })))
              const exportHash = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                snapshot
              )

              // Log the export to DB
              const { data: exportRow } = await supabase
                .from('record_exports')
                .insert({
                  vehicle_id: v.id,
                  user_id: (await supabase.auth.getUser()).data.user!.id,
                  record_count: allRecords.length,
                  export_hash: exportHash,
                })
                .select()
                .single()

              const exportId = exportRow?.id ?? 'unknown'
              const exportedAt = new Date().toLocaleString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
              })
              const odometerUnit = profile?.odometer_unit === 'kilometers' ? 'km' : 'mi'
              const exportedBy = profile?.display_name || 'Unknown'
              const vehicleName = `${v.year} ${v.make} ${v.model}${v.trim ? ' ' + v.trim : ''}`
              const vehicleNickname = v.nickname ? ` "${v.nickname}"` : ''

              // Build mileage progression analysis
              const mileageRecords = sorted.filter(r => r.mileage_at_service != null && r.completed_date != null)
              let mileageRows = ''
              let prevMileage: number | null = null
              let mileageWarning = false
              for (const r of mileageRecords) {
                const isBackward = prevMileage != null && r.mileage_at_service! < prevMileage
                if (isBackward) mileageWarning = true
                mileageRows += `
                  <tr class="${isBackward ? 'warning-row' : ''}">
                    <td>${formatDateLong(r.completed_date)}</td>
                    <td>${r.task_name}</td>
                    <td>${r.mileage_at_service!.toLocaleString()} ${odometerUnit}${isBackward ? ' ⚠' : ''}</td>
                  </tr>`
                prevMileage = r.mileage_at_service
              }

              // Build record rows
              let recordRows = ''
              for (const r of sorted) {
                const logs = auditMap[r.id] ?? []
                const daysSinceWork = r.completed_date
                  ? Math.round((new Date(r.created_at).getTime() - new Date(r.completed_date + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
                  : null
                const addedLateNote = daysSinceWork != null && daysSinceWork > 30
                  ? `<span class="note">Note: Added ${daysSinceWork} day${daysSinceWork === 1 ? '' : 's'} after completion date. This is normal when consolidating historical records.</span>`
                  : ''

                // Modification history
                const updateLogs = logs.filter(l => l.change_type === 'updated')
                let modHistory = ''
                if (updateLogs.length > 0) {
                  modHistory = `<div class="mod-history"><strong>MODIFICATION HISTORY</strong>`
                  for (const log of updateLogs) {
                    const fields = (log.changed_fields ?? []).join(', ')
                    modHistory += `<div class="mod-entry">
                      ${formatDateTimeLong(log.changed_at)} — Fields changed: ${fields}
                    </div>`
                  }
                  modHistory += `</div>`
                }

                recordRows += `
                  <div class="record-card">
                    <div class="record-header">
                      <span class="record-task">${r.task_name}</span>
                      <span class="badge">COMPLETED</span>
                    </div>
                    <div class="record-body">
                      <div class="record-grid">
                        <div class="field"><span class="field-label">DATE</span><span class="field-value">${formatDateLong(r.completed_date)}</span></div>
                        ${r.mileage_at_service != null ? `<div class="field"><span class="field-label">MILEAGE</span><span class="field-value">${r.mileage_at_service.toLocaleString()} ${odometerUnit}</span></div>` : ''}
                        ${r.performed_by ? `<div class="field"><span class="field-label">PERFORMED BY</span><span class="field-value">${r.performed_by}</span></div>` : ''}
                        ${r.cost != null ? `<div class="field"><span class="field-label">COST</span><span class="field-value">$${parseFloat(String(r.cost)).toFixed(2)}</span></div>` : ''}
                      </div>
                      ${r.notes ? `<div class="notes-row"><span class="field-label">NOTES</span><span class="field-value">${r.notes}</span></div>` : ''}
                      <div class="timestamps">
                        <span>Record added: ${formatDateTimeLong(r.created_at)}</span>
                        <span>Last modified: ${formatDateTimeLong(r.updated_at)}</span>
                      </div>
                      ${addedLateNote}
                      ${modHistory}
                    </div>
                  </div>`
              }

              const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>MXTracker - ${vehicleName} Maintenance Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #111; font-size: 12px; line-height: 1.5; }
  .page { max-width: 720px; margin: 0 auto; padding: 40px 32px; }
  .header-bar { background: #0f0f0f; padding: 20px 24px; margin-bottom: 0; display: flex; align-items: center; gap: 6px; }
  .logo-mx { font-size: 22px; font-weight: 900; color: #e3001b; letter-spacing: 2px; }
  .logo-tracker { font-size: 12px; font-weight: 900; color: #fff; letter-spacing: 4px; }
  .accent-bar { height: 3px; background: #e3001b; margin-bottom: 32px; }
  h1 { font-size: 22px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #111; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #555; letter-spacing: 2px; font-weight: 600; text-transform: uppercase; margin-bottom: 28px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f9f9f9; border: 1px solid #e8e8e8; padding: 20px; margin-bottom: 28px; }
  .meta-field label { font-size: 9px; font-weight: 800; letter-spacing: 2px; color: #555; display: block; margin-bottom: 2px; }
  .meta-field span { font-size: 13px; font-weight: 600; color: #111; }
  .disclaimer { font-size: 10px; color: #555; background: #fffbf0; border-left: 3px solid #f0a500; padding: 10px 12px; margin-bottom: 28px; line-height: 1.6; }
  .section-title { font-size: 10px; font-weight: 900; letter-spacing: 3px; color: #555; text-transform: uppercase; border-bottom: 1px solid #e8e8e8; padding-bottom: 6px; margin-bottom: 16px; margin-top: 32px; }
  .record-card { border: 1px solid #e8e8e8; margin-bottom: 12px; page-break-inside: avoid; }
  .record-header { background: #f5f5f0; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e8e8e8; }
  .record-task { font-size: 14px; font-weight: 800; color: #111; }
  .badge { font-size: 8px; font-weight: 800; letter-spacing: 1.5px; color: #4caf50; background: #e8f5e9; padding: 3px 7px; }
  .record-body { padding: 12px 16px; }
  .record-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .field { display: flex; flex-direction: column; }
  .field-label { font-size: 8px; font-weight: 800; letter-spacing: 1.5px; color: #555; margin-bottom: 1px; }
  .field-value { font-size: 12px; color: #111; font-weight: 500; }
  .notes-row { margin-bottom: 8px; }
  .timestamps { font-size: 9px; color: #666; margin-top: 8px; display: flex; gap: 16px; border-top: 1px solid #f0f0f0; padding-top: 8px; }
  .note { display: block; font-size: 9px; color: #555; margin-top: 6px; font-style: italic; }
  .mod-history { margin-top: 8px; padding: 8px 10px; background: #fff8f0; border-left: 3px solid #f0a500; font-size: 9px; }
  .mod-history strong { font-size: 8px; letter-spacing: 1.5px; color: #555; }
  .mod-entry { color: #666; margin-top: 4px; }
  .mileage-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
  .mileage-table th { background: #0f0f0f; color: #fff; padding: 8px 12px; text-align: left; font-size: 9px; letter-spacing: 2px; font-weight: 800; }
  .mileage-table td { padding: 8px 12px; border-bottom: 1px solid #e8e8e8; }
  .mileage-table tr:nth-child(even) td { background: #f9f9f9; }
  .warning-row td { color: #e3001b; }
  .mileage-note { font-size: 9px; color: #e3001b; margin-top: 6px; font-style: italic; }
  .verify-section { background: #f5f5f0; border: 1px solid #e8e8e8; padding: 16px 20px; margin-top: 32px; }
  .verify-title { font-size: 9px; font-weight: 800; letter-spacing: 2px; color: #555; margin-bottom: 6px; }
  .verify-hash { font-family: monospace; font-size: 9px; color: #333; word-break: break-all; margin-bottom: 4px; }
  .verify-url { font-size: 9px; color: #e3001b; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e8e8; font-size: 9px; color: #777; text-align: center; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="header-bar">
  <span class="logo-mx">MX</span>
  <span class="logo-tracker">TRACKER</span>
</div>
<div class="accent-bar"></div>
<div class="page">
  <h1>${vehicleName}${vehicleNickname}</h1>
  <p class="subtitle">Maintenance History Report</p>

  <div class="meta-grid">
    <div class="meta-field"><label>EXPORTED BY</label><span>${exportedBy}</span></div>
    <div class="meta-field"><label>EXPORT DATE</label><span>${exportedAt}</span></div>
    <div class="meta-field"><label>TOTAL RECORDS</label><span>${allRecords.length}</span></div>
    ${v.vin ? `<div class="meta-field"><label>VIN</label><span>${v.vin}</span></div>` : ''}
  </div>

  <div class="disclaimer">
    ⚠ SELF-REPORTED RECORD — This maintenance history was compiled by the vehicle owner using MXTracker. Service data has not been independently verified by a mechanic, dealership, or third party. Record timestamps reflect when entries were added to the MXTracker app, not necessarily when service was performed.
  </div>

  ${mileageRecords.length > 1 ? `
  <div class="section-title">Mileage Progression</div>
  <table class="mileage-table">
    <thead><tr><th>DATE</th><th>SERVICE</th><th>ODOMETER</th></tr></thead>
    <tbody>${mileageRows}</tbody>
  </table>
  ${mileageWarning ? `<p class="mileage-note">⚠ One or more records show odometer readings that are lower than a previous record. Please review highlighted entries.</p>` : ''}
  ` : ''}

  <div class="section-title">Maintenance Records (${allRecords.length})</div>
  ${recordRows}

  <div class="verify-section">
    <div class="verify-title">EXPORT VERIFICATION</div>
    <div class="verify-hash">SHA-256: ${exportHash}</div>
    <div class="verify-url">Verify at: confirm.mxtracker.app/verify/${exportId}</div>
  </div>

  <div class="footer">MXTracker · mxtracker.app · Export ID: ${exportId}</div>
</div>
</body>
</html>`

              // Platform-aware PDF handling
              if (Platform.OS === 'web') {
                // Web: open report in new tab and trigger browser print dialog (Save as PDF)
                const printWindow = window.open('about:blank', '_blank')
                if (!printWindow) {
                  Alert.alert('Popup Blocked', 'Please allow popups for this site and try again.')
                } else {
                  printWindow.document.write(html)
                  printWindow.document.close()
                  printWindow.onload = () => {
                    printWindow.focus()
                    printWindow.print()
                  }
                }
              } else {
                // Mobile: use expo-print and expo-sharing
                const { uri: tmpUri } = await Print.printToFileAsync({ html, base64: false })
                // Rename to a human-readable filename before sharing
                const safeFilename = `${v.year}_${v.make}_${v.model}_mxlog`
                  .replace(/\s+/g, '_')
                  .replace(/[^a-zA-Z0-9_-]/g, '') + '.pdf'
                const pdfFile = new FileSystem.File(tmpUri)
                // Remove any pre-existing file with the same name so rename() won't conflict
                const destUri = tmpUri.replace(/[^/]+$/, safeFilename)
                const existing = new FileSystem.File(destUri)
                if (existing.exists) existing.delete()
                pdfFile.rename(safeFilename)
                const canShare = await Sharing.isAvailableAsync()
                if (canShare) {
                  await Sharing.shareAsync(pdfFile.uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `${vehicleName} Maintenance Report`,
                    UTI: 'com.adobe.pdf',
                  })
                } else {
                  Alert.alert('Exported', `PDF saved to: ${pdfFile.uri}`)
                }
              }
            } catch (err) {
              console.error('Export error:', err)
              Alert.alert('Export Failed', 'Something went wrong generating the PDF. Please try again.')
            } finally {
              setExporting(false)
            }
    }

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await doExport()
      }
    } else {
      Alert.alert(
        'Export Maintenance Records',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Export PDF', onPress: doExport },
        ]
      )
    }
  }

  function formatDateLong(dateStr: string | null | undefined): string {
    if (!dateStr) return '—'
    const [y, m, d] = dateStr.split('-')
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
  }

  function formatDateTimeLong(isoStr: string | null | undefined): string {
    if (!isoStr) return '—'
    return new Date(isoStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {    return (
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
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color={dark ? '#fff' : '#111'} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.toUpperCase() : ''}
            </Text>
            <Text style={s.headerSubtitle}>
              {totalRecords} {totalRecords === 1 ? 'RECORD' : 'RECORDS'}
            </Text>
          </View>
          <TouchableOpacity
            style={s.addButton}
            onPress={() => router.push(`/(app)/garage/${id}/records/new`)}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={s.accentBar} />

        {totalRecords === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="construct-outline" size={64} color={dark ? '#2a2a2a' : '#e0e0e0'} />
            <Text style={s.emptyTitle}>NO RECORDS</Text>
            <Text style={s.emptySubtitle}>Tap + to add your first maintenance record</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} tintColor="#e3001b" />
            }
            renderSectionHeader={({ section }) => (
              <View style={s.sectionHeader}>
                <Text style={s.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              function renderRightActions() {
                return (
                  <TouchableOpacity
                    style={s.deleteAction}
                    onPress={() => deleteRecord(item.id)}
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
                    onPress={() => router.push(`/(app)/garage/${id}/records/${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <View style={s.cardTop}>
                      <Text style={s.taskName} numberOfLines={1}>{item.task_name}</Text>
                      <StatusBadge dark={dark} />
                    </View>
                    <View style={s.cardBottom}>
                      <View style={s.cardMeta}>
                        <Ionicons name="calendar-outline" size={12} color={dark ? '#555' : '#aaa'} />
                        <Text style={s.cardMetaText}>
                          {item.completed_date
                            ? formatDate(item.completed_date)
                            : item.next_due_date
                              ? `Due ${formatDate(item.next_due_date)}`
                              : '—'
                          }
                        </Text>
                      </View>
                      {item.reminder_enabled && (
                        <View style={s.cardMeta}>
                          <Ionicons name="notifications-outline" size={12} color="#e3001b" />
                          <Text style={[s.cardMetaText, { color: '#e3001b' }]}>REMINDER ON</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              )
            }}
          />
          <TouchableOpacity
            style={[s.exportButton, exporting && s.exportButtonDisabled]}
            onPress={exportRecords}
            disabled={exporting}
            activeOpacity={0.8}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={18} color="#fff" />
                <Text style={s.exportButtonText}>EXPORT PDF</Text>
              </>
            )}
          </TouchableOpacity>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  )
}

const styles = (dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: dark ? '#0f0f0f' : '#f5f5f0' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16, gap: 12,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 14, fontWeight: '900', letterSpacing: 2,
    color: dark ? '#fff' : '#111',
  },
  headerSubtitle: {
    fontSize: 11, fontWeight: '600', letterSpacing: 3,
    color: dark ? '#555' : '#999', marginTop: 2,
  },
  addButton: {
    width: 44, height: 44, backgroundColor: '#e3001b',
    alignItems: 'center', justifyContent: 'center',
  },
  accentBar: {
    height: 2, backgroundColor: '#e3001b',
    marginHorizontal: 24, marginBottom: 16,
  },
  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  exportButton: {
    position: 'absolute', bottom: 24, left: 24, right: 24,
    backgroundColor: '#e3001b',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, gap: 10,
  },
  exportButtonDisabled: { opacity: 0.6 },
  exportButtonText: {
    fontSize: 13, fontWeight: '900', letterSpacing: 3, color: '#fff',
  },
  sectionHeader: {
    paddingVertical: 8, marginBottom: 8, marginTop: 8,
    borderBottomWidth: 1, borderBottomColor: dark ? '#2a2a2a' : '#e8e8e8',
  },
  sectionHeaderText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 3,
    color: dark ? '#555' : '#999',
  },
  card: {
    backgroundColor: dark ? '#1a1a1a' : '#fff',
    borderWidth: 1, borderColor: dark ? '#2a2a2a' : '#e8e8e8',
    padding: 16, marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  taskName: {
    fontSize: 15, fontWeight: '800',
    color: dark ? '#fff' : '#111', flex: 1, marginRight: 8,
  },
  cardBottom: { flexDirection: 'row', gap: 16 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    color: dark ? '#555' : '#aaa',
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '800', letterSpacing: 4,
    color: dark ? '#2a2a2a' : '#ccc',
  },
  emptySubtitle: { fontSize: 13, color: dark ? '#333' : '#bbb', letterSpacing: 1 },
  deleteAction: {
    backgroundColor: '#e3001b',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 4,
  },
})