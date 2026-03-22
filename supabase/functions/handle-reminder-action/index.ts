import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const recordId = url.searchParams.get("record_id")
    const action = url.searchParams.get("action") // "snooze_week" | "snooze_month" | "stop"
    const token = url.searchParams.get("token")

    if (!recordId || !action || !token) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://confirm.mxtracker.app/'
        }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify the token matches what we expect for this record
    // Token is a simple HMAC of record_id to prevent tampering
    const expectedToken = await generateToken(recordId)
    if (token !== expectedToken) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://confirm.mxtracker.app/'
        }
      })
    }

    // Fetch the record to confirm it exists
    const { data: record, error } = await supabase
      .from("maintenance_records")
      .select("id, task_name, vehicle_id, vehicles(year, make, model, nickname)")
      .eq("id", recordId)
      .single()

    if (error || !record) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://confirm.mxtracker.app/'
        }
      })
    }

    const vehicle = record.vehicles as any
    const vehicleName = vehicle.nickname
      ? `${vehicle.nickname} (${vehicle.year} ${vehicle.make} ${vehicle.model})`
      : `${vehicle.year} ${vehicle.make} ${vehicle.model}`

    if (action === "snooze_week") {
      const snoozeDate = new Date()
      snoozeDate.setDate(snoozeDate.getDate() + 7)
      const snoozedUntil = snoozeDate.toISOString().split("T")[0]

      await supabase
        .from("maintenance_records")
        .update({
          snoozed_until: snoozedUntil,
          reminder_sent_at: null, // re-arm for after snooze
        })
        .eq("id", recordId)

      return new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://confirm.mxtracker.app/?result=snooze_week'
        }
      })
    }

    if (action === "snooze_month") {
      const snoozeDate = new Date()
      snoozeDate.setMonth(snoozeDate.getMonth() + 1)
      const snoozedUntil = snoozeDate.toISOString().split("T")[0]

      await supabase
        .from("maintenance_records")
        .update({
          snoozed_until: snoozedUntil,
          reminder_sent_at: null,
        })
        .eq("id", recordId)

      return new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://confirm.mxtracker.app/?result=snooze_month'
        }
      })
    }

    if (action === "stop") {
      await supabase
        .from("maintenance_records")
        .update({ reminder_enabled: false })
        .eq("id", recordId)

      return new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://confirm.mxtracker.app/?result=stop'
        }
      })
    }

    if (action === "complete") {
      const vehicleId = (record as any).vehicle_id
      const vehicle = record.vehicles as any
      const vehicleName = vehicle.nickname
        ? `${vehicle.nickname} (${vehicle.year} ${vehicle.make} ${vehicle.model})`
        : `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      const task = encodeURIComponent(record.task_name)
      const veh = encodeURIComponent(vehicleName)
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `https://confirm.mxtracker.app/open/${vehicleId}/${recordId}?task=${task}&vehicle=${veh}`
        }
      })
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': 'https://confirm.mxtracker.app/'
      }
    })

  } catch (err) {
    console.error("Unexpected error:", err)
    return new Response(null, {
      status: 302,
      headers: {
        'Location': 'https://confirm.mxtracker.app/'
      }
    })
  }
})

// Generate a simple token from the record ID using Web Crypto
async function generateToken(recordId: string): Promise<string> {
  const secret = Deno.env.get("RESEND_API_KEY") ?? "fallback-secret"
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(recordId))
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("")
}