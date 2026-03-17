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
      return htmlResponse("Invalid link", "This link is missing required parameters.", false)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify the token matches what we expect for this record
    // Token is a simple HMAC of record_id to prevent tampering
    const expectedToken = await generateToken(recordId)
    if (token !== expectedToken) {
      return htmlResponse("Invalid link", "This link is invalid or has expired.", false)
    }

    // Fetch the record to confirm it exists
    const { data: record, error } = await supabase
      .from("maintenance_records")
      .select("id, task_name, vehicles(year, make, model, nickname)")
      .eq("id", recordId)
      .single()

    if (error || !record) {
      return htmlResponse("Not found", "This reminder could not be found.", false)
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

      return htmlResponse(
        "Reminder snoozed",
        `We'll remind you again in 1 week about <strong>${record.task_name}</strong> on your ${vehicleName}.`,
        true
      )
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

      return htmlResponse(
        "Reminder snoozed",
        `We'll remind you again in 1 month about <strong>${record.task_name}</strong> on your ${vehicleName}.`,
        true
      )
    }

    if (action === "stop") {
      await supabase
        .from("maintenance_records")
        .update({ reminder_enabled: false })
        .eq("id", recordId)

      return htmlResponse(
        "Reminders stopped",
        `You won't receive any more reminders for <strong>${record.task_name}</strong> on your ${vehicleName}. You can re-enable reminders in the MXTracker app.`,
        true
      )
    }

    return htmlResponse("Unknown action", "This link contains an unknown action.", false)

  } catch (err) {
    console.error("Unexpected error:", err)
    return htmlResponse("Error", "Something went wrong. Please try again.", false)
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

// Return a simple branded HTML confirmation page
function htmlResponse(title: string, message: string, success: boolean): Response {
  const accentColor = success ? '#e3001b' : '#999999'
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MXTracker - ${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;">
<tr><td style="background-color:#111111;padding:24px 32px;">
<span style="font-size:24px;font-weight:900;color:#e3001b;letter-spacing:2px;">MX</span>
<span style="font-size:16px;font-weight:900;color:#ffffff;letter-spacing:4px;">TRACKER</span>
</td></tr>
<tr><td style="background-color:${accentColor};height:3px;"></td></tr>
<tr><td style="padding:40px 32px;">
<p style="margin:0 0 12px 0;font-size:22px;font-weight:800;color:#111111;letter-spacing:1px;">${title.toUpperCase()}</p>
<p style="margin:0 0 32px 0;font-size:15px;color:#555555;line-height:1.6;">${message}</p>
<p style="margin:0;font-size:13px;color:#aaaaaa;">Open the MXTracker app to manage all your reminders.</p>
</td></tr>
<tr><td style="background-color:#f9f9f9;padding:20px 32px;border-top:1px solid #e8e8e8;">
<p style="margin:0;font-size:11px;color:#bbbbbb;text-align:center;">MXTracker &middot; mxtracker.app</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
  
  return new Response(new TextEncoder().encode(html), {
    headers: {
      'content-type': 'text/html',
    },
    status: 200,
  })
}