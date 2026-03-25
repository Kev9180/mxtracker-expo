# MXTracker

© 2026 Kevin Johnston  
Licensed under the Apache License 2.0 — see [LICENSE](LICENSE) for details.

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

## Deployment

### Web

Build and deploy the web app to Cloudflare Pages:

```bash
npx expo export --platform web
```

Then drag and drop the `dist/` folder into the Cloudflare Pages project at [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → `mxtracker`.

The web app is served at `mxtracker.app`. The `public/` folder contains static files (e.g. `privacy.html`) that are copied into `dist/` automatically during export.

### iOS

Build and submit a production iOS build:

```bash
# Build
eas build --profile production --platform ios

# Submit (after build completes)
eas submit --platform ios
```

### Android

Build and submit a production Android build:

```bash
# Build
eas build --profile production --platform android

# Submit (after build completes)
eas submit --platform android
```

### Both Platforms at Once

```bash
eas build --profile production --platform all
```

### Supabase Edge Functions

```bash
# Account deletion (requires service role — JWT is verified manually inside the function)
npx supabase functions deploy delete-account --no-verify-jwt

# Daily reminder emails (called by pg_cron, no user JWT)
npx supabase functions deploy send-reminders --no-verify-jwt

# Handles snooze/stop button clicks in reminder emails
npx supabase functions deploy handle-reminder-action --no-verify-jwt
```

---

## Email Backend

Two Supabase Edge Functions handle the reminder system:

**`send-reminders`** — Runs daily via pg_cron. Queries all maintenance records with reminders enabled that are due within the user's reminder window or overdue. Sends emails via Resend using the user's local timezone for date calculations.

**`handle-reminder-action`** — Handles button clicks from reminder emails. Supports snooze for 1 week, snooze for 1 month, and stop reminders for a specific task. Protected with HMAC token verification.

**`delete-account`** — Permanently deletes the authenticated user's account and all associated data. Called from the Settings screen. Uses service role key to call `auth.admin.deleteUser`.

---

## License

Apache License 2.0