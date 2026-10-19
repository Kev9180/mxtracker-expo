import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
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

  let exportId: unknown
  try {
    ({ export_id: exportId } = await req.json())
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400)
  }

  if (typeof exportId !== "string" || !/^[0-9a-f-]{36}$/i.test(exportId)) {
    return jsonResponse({ error: "A valid export_id is required" }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: exportRow, error } = await supabase
    .from("record_exports")
    .select("id, record_count, export_hash, exported_at, record_snapshot")
    .eq("id", exportId)
    .maybeSingle()

  if (error) {
    console.error("Failed to load export for verification:", error)
    return jsonResponse({ error: "Could not load this export" }, 500)
  }

  if (!exportRow) {
    return jsonResponse({ error: "Export not found" }, 404)
  }

  if (!exportRow.record_snapshot) {
    return jsonResponse({ status: "legacy", export_id: exportRow.id }, 200)
  }

  const calculatedHash = await sha256Hex(canonicalJson(exportRow.record_snapshot))
  if (calculatedHash !== exportRow.export_hash) {
    console.error("Stored export snapshot hash mismatch:", exportRow.id)
    return jsonResponse({ status: "integrity_error", export_id: exportRow.id }, 409)
  }

  return jsonResponse({
    status: "snapshot_available",
    export_id: exportRow.id,
    exported_at: exportRow.exported_at,
    record_count: exportRow.record_count,
    record_snapshot: exportRow.record_snapshot,
  }, 200)
})
