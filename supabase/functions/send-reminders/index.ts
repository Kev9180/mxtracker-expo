import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (_req) => {
  try {
    // Use service role key so we can query across all users
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const nowUTC = new Date()

    // Find all records that need a reminder sent today:
    // - reminder is enabled on the record
    // - has a next_due_date
    // - reminder hasn't been sent yet
    // - the vehicle's owner has global reminders enabled
    // Fetch all records that need reminders
    const { data: records, error } = await supabase
      .from("maintenance_records")
      .select(`
        id,
        task_name,
        next_due_date,
        user_id,
        vehicles (
          id,
          year,
          make,
          model,
          nickname
        )
      `)
      .eq("reminder_enabled", true)
      .is("reminder_sent_at", null)
      .not("next_due_date", "is", null)
      .or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString().split("T")[0]}`)

    if (error) {
      console.error("Error fetching records:", error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: "No reminders to send today" }), { status: 200 })
    }

    // Fetch all unique profiles for the users who own these records
    const userIds = [...new Set(records.map((r) => r.user_id))]
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, reminder_email, reminders_enabled, remind_days_before, display_name, timezone")
      .in("id", userIds)

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError)
      return new Response(JSON.stringify({ error: profilesError.message }), { status: 500 })
    }

    // Build a map of user_id -> profile for easy lookup
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const record of records) {
      const vehicle = record.vehicles as any
      const profile = profileMap[record.user_id]

      // Skip if no profile or global reminders are off
      if (!profile || !profile.reminders_enabled) {
        skipped++
        continue
      }

      // Skip if no email address
      const toEmail = profile.reminder_email
      if (!toEmail) {
        skipped++
        continue
      }

      // Get today's date in the user's local timezone
      const userTimezone = profile.timezone ?? 'UTC'
      const userTodayStr = nowUTC.toLocaleDateString('en-CA', { timeZone: userTimezone })
      const [todayYear, todayMonth, todayDay] = userTodayStr.split('-').map(Number)
      const userToday = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay))

      // Parse the due date as UTC midnight
      const [year, month, day] = record.next_due_date.split('-').map(Number)
      const dueDate = new Date(Date.UTC(year, month - 1, day))

      const daysUntilDue = Math.round((dueDate.getTime() - userToday.getTime()) / (1000 * 60 * 60 * 24)) 

      console.log(JSON.stringify({
        task: record.task_name,
        next_due_date: record.next_due_date,
        userTimezone,
        userTodayStr,
        daysUntilDue,
        nowUTC: nowUTC.toISOString(),
      }))

      const remindDaysBefore = profile.remind_days_before ?? 7

      const isOverdue = daysUntilDue < 0
      const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= remindDaysBefore

      if (!isOverdue && !isDueSoon) {
        skipped++
        continue
      }

      // Build email content
      const vehicleName = vehicle.nickname
        ? `${vehicle.nickname} (${vehicle.year} ${vehicle.make} ${vehicle.model})`
        : `${vehicle.year} ${vehicle.make} ${vehicle.model}`

      const greeting = profile.display_name ? `Hi ${profile.display_name},` : `Hi,`

      const dueDateFormatted = dueDate.toLocaleDateString("en-US", {
        timeZone: userTimezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      let subject: string
      let urgencyLine: string

      if (isOverdue) {
        const daysOverdue = Math.abs(daysUntilDue)
        subject = `Overdue: ${record.task_name} on your ${vehicle.year} ${vehicle.make} ${vehicle.model}`
        urgencyLine = `This service is <strong>${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue</strong>.`
      } else if (daysUntilDue === 0) {
        subject = `Due today: ${record.task_name} on your ${vehicle.year} ${vehicle.make} ${vehicle.model}`
        urgencyLine = `This service is <strong>due today</strong>.`
      } else {
        subject = `Reminder: ${record.task_name} due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`
        urgencyLine = `This service is due in <strong>${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}</strong> on ${dueDateFormatted}.`
      }

      // Generate action URLs for this record
      const token = await generateToken(record.id)
      const baseUrl = "https://hetmchofwmouscvlkxka.supabase.co/functions/v1/handle-reminder-action"
      const snoozeWeekUrl = `${baseUrl}?record_id=${record.id}&action=snooze_week&token=${token}`
      const snoozeMonthUrl = `${baseUrl}?record_id=${record.id}&action=snooze_month&token=${token}`
      const stopUrl = `${baseUrl}?record_id=${record.id}&action=stop&token=${token}`

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f0; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff;">
                    <tr>
                      <td style="background-color: #111111; padding: 32px 40px;">
                        <span style="font-size: 28px; font-weight: 900; color: #e3001b; letter-spacing: 2px;">MX</span>
                        <span style="font-size: 18px; font-weight: 900; color: #ffffff; letter-spacing: 4px;">TRACKER</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #e3001b; height: 3px;"></td>
                    </tr>
                    <tr>
                      <td style="padding: 40px;">
                        <p style="margin: 0 0 8px 0; font-size: 15px; color: #333333;">${greeting}</p>
                        <p style="margin: 0 0 32px 0; font-size: 15px; color: #333333;">You have a maintenance reminder for your <strong>${vehicleName}</strong>.</p>
                        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e8e8e8; margin-bottom: 32px;">
                          <tr>
                            <td style="background-color: #f9f9f9; padding: 12px 20px; border-bottom: 1px solid #e8e8e8;">
                              <span style="font-size: 10px; font-weight: 800; letter-spacing: 3px; color: #999999; text-transform: uppercase;">Service</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 20px;">
                              <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #111111;">${record.task_name}</p>
                              <p style="margin: 0 0 8px 0; font-size: 14px; color: #666666;">${vehicleName}</p>
                              <p style="margin: 0; font-size: 14px; color: ${isOverdue ? "#e3001b" : "#333333"};">${urgencyLine}</p>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 0 0 20px 0; font-size: 13px; color: #999999;">
                          Open MXTracker to log this service once it's done.
                        </p>

                        <!-- Action buttons -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                          <tr>
                            <td style="padding-bottom: 10px;">
                              <a href="${snoozeWeekUrl}" style="display: block; text-align: center; background-color: #111111; color: #ffffff; padding: 14px 20px; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-decoration: none;">
                                REMIND ME IN 1 WEEK
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-bottom: 10px;">
                              <a href="${snoozeMonthUrl}" style="display: block; text-align: center; background-color: #111111; color: #ffffff; padding: 14px 20px; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-decoration: none;">
                                REMIND ME IN 1 MONTH
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <a href="${stopUrl}" style="display: block; text-align: center; background-color: #ffffff; color: #999999; padding: 14px 20px; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-decoration: none; border: 1px solid #e8e8e8;">
                                STOP REMINDERS FOR THIS TASK
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="margin: 0; font-size: 11px; color: #cccccc;">
                          To stop all reminder emails, go to Settings in the MXTracker app and turn off Email Reminders.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #f9f9f9; padding: 24px 40px; border-top: 1px solid #e8e8e8;">
                        <p style="margin: 0; font-size: 11px; color: #bbbbbb; text-align: center;">
                          MXTracker · mxtracker.app<br />
                          You're receiving this because you enabled reminders in MXTracker.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `

      // Send via Resend
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "MXTracker <reminders@mxtracker.app>",
          to: toEmail,
          subject,
          html,
        }),
      })

      if (!resendResponse.ok) {
        const err = await resendResponse.text()
        console.error(`Failed to send to ${toEmail}:`, err)
        errors.push(`${toEmail}: ${err}`)
        await supabase.from("reminder_logs").insert({
          maintenance_record_id: record.id,
          user_id: record.user_id,
          sent_to: toEmail,
          status: "failed",
          type: isOverdue ? "overdue" : "due_soon",
          error_message: err,
        })
        continue
      }

      // Mark reminder as sent
      await supabase
        .from("maintenance_records")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", record.id)

      // Log the send
      await supabase.from("reminder_logs").insert({
        maintenance_record_id: record.id,
        user_id: record.user_id,
        sent_to: toEmail,
        status: "delivered",
        type: isOverdue ? "overdue" : "due_soon",
      })

      sent++
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped, errors }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    )
  } catch (err) {
    console.error("Unexpected error:", err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

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