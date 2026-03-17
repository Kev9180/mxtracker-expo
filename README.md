# MXTracker

A cross-platform mobile app for tracking vehicle maintenance and receiving email reminders when service is due. Available on iOS, Android, and web.

## Features

- **Garage** — Add and manage multiple vehicles with detailed specs (year, make, model, engine, drivetrain, VIN, mileage, and more)
- **Records** — Log maintenance history per vehicle with cost, mileage, performed by, notes, and optional recurring intervals
- **Reminders** — View all upcoming and overdue maintenance reminders across all vehicles
- **Email notifications** — Automated daily reminder emails when service is due, with snooze and stop options directly from the email
- **Dark / Light / System theme** — User-selectable appearance that persists across sessions
- **Timezone-aware** — Reminder dates calculated in the user's local timezone
- **Odometer unit preference** — Miles or kilometers, applied throughout the app

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend + Mobile | Expo SDK 54, React Native, TypeScript |
| Navigation | Expo Router (file-based) |
| Database + Auth | Supabase (PostgreSQL + RLS) |
| Email sending | Resend |
| Email scheduling | Supabase Edge Functions + pg_cron |
| Domain | mxtracker.app (Cloudflare) |
| Icons | @expo/vector-icons (Ionicons) |
| Timezone data | @vvo/tzdb |

## Email Backend

Two Supabase Edge Functions handle the reminder system:

**`send-reminders`** — Runs daily via pg_cron. Queries all maintenance records with reminders enabled that are due within the user's reminder window or overdue. Sends emails via Resend using the user's local timezone for date calculations.

**`handle-reminder-action`** — Handles button clicks from reminder emails. Supports snooze for 1 week, snooze for 1 month, and stop reminders for a specific task. Protected with HMAC token verification.

## License

MIT