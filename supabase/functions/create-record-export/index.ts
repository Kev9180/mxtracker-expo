import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`
  }

  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>
    const entries = Object.keys(object)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    return `{${entries.join(",")}}`
  }

  return JSON.stringify(value)
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const authorization = req.headers.get("Authorization")
  if (!authorization) {
    return jsonResponse({ error: "Authentication required" }, 401)
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()

  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  let vehicleId: unknown
  try {
    ({ vehicle_id: vehicleId } = await req.json())
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400)
  }

  if (typeof vehicleId !== "string" || !/^[0-9a-f-]{36}$/i.test(vehicleId)) {
    return jsonResponse({ error: "A valid vehicle_id is required" }, 400)
  }

  const { data: vehicle, error: vehicleError } = await userClient
    .from("vehicles")
    .select("id, year, make, model, trim")
    .eq("id", vehicleId)
    .single()

  if (vehicleError || !vehicle) {
    return jsonResponse({ error: "Vehicle not found" }, 404)
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("odometer_unit")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return jsonResponse({ error: "Could not load mileage unit preference" }, 500)
  }

  const { data: records, error: recordsError } = await userClient
    .from("maintenance_records")
    .select("id, task_name, completed_date, mileage_at_service, performed_by, cost, notes, created_at, updated_at")
    .eq("vehicle_id", vehicleId)
    .order("completed_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })

  if (recordsError) {
    console.error("Failed to load export records:", recordsError)
    return jsonResponse({ error: "Could not load maintenance records" }, 500)
  }

  if (!records || records.length === 0) {
    return jsonResponse({ error: "There are no maintenance records to export" }, 400)
  }

  const recordIds = records.map(record => record.id)
  const { data: auditRows, error: auditError } = await userClient
    .from("maintenance_record_audit")
    .select("maintenance_record_id, changed_at, changed_fields")
    .in("maintenance_record_id", recordIds)
    .eq("change_type", "updated")
    .order("changed_at", { ascending: true })

  if (auditError) {
    console.error("Failed to load export audit history:", auditError)
    return jsonResponse({ error: "Could not load maintenance history" }, 500)
  }

  const exportedAt = new Date().toISOString()
  const snapshot = {
    snapshot_version: 1,
    exported_at: exportedAt,
    vehicle: {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      odometer_unit: profile.odometer_unit,
    },
    records: records.map(record => ({
      id: record.id,
      task_name: record.task_name,
      completed_date: record.completed_date,
      mileage_at_service: record.mileage_at_service,
      performed_by: record.performed_by,
      cost: record.cost,
      notes: record.notes,
      created_at: record.created_at,
      updated_at: record.updated_at,
    })),
    changes: (auditRows ?? []).map(change => ({
      maintenance_record_id: change.maintenance_record_id,
      changed_at: change.changed_at,
      changed_fields: change.changed_fields,
    })),
  }

  const exportHash = await sha256Hex(canonicalJson(snapshot))
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: exportRow, error: insertError } = await adminClient
    .from("record_exports")
    .insert({
      vehicle_id: vehicle.id,
      user_id: user.id,
      record_count: records.length,
      export_hash: exportHash,
      record_snapshot: snapshot,
    })
    .select("id, exported_at")
    .single()

  if (insertError || !exportRow) {
    console.error("Failed to save export snapshot:", insertError)
    return jsonResponse({ error: "Could not save the export record" }, 500)
  }

  return jsonResponse({
    export_id: exportRow.id,
    exported_at: exportRow.exported_at,
    record_count: records.length,
    export_hash: exportHash,
    record_snapshot: snapshot,
  }, 201)
})