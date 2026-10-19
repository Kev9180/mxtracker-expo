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

Then drag and drop the `dist/` folder into the Cloudflare Pages project at:
- [dash.cloudflare.com](https://dash.cloudflare.com)
- Workers & Pages
- 'Create Deployment'
- 'Preview' or 'Production'

The web app is served at `mxtracker.app`. The `public/` folder contains static files (e.g. `privacy.html`) that are copied into `dist/` automatically during export.

### Cloudflare Verification Worker

The `confirm.mxtracker.app` routes for reminder actions and export verification are served by `web/worker.js`. Deploy this file from the Cloudflare Dashboard under Workers & Pages → `confirm-mxtracker` → Edit Code. Configure these Worker variables:

- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — Supabase publishable/anon key

The export verification route calls the public `verify-record-export` Edge Function. Deploy the function before or alongside the Worker update.

### iOS

An iOS app binary is required to test and release changes to the app code. Uploading a build to TestFlight does **not** release it publicly on the App Store.

For a direct internal install, the `preview` profile creates an internal-distribution build. Register the iPhone with EAS if prompted, then install the build using the link EAS provides:

```bash
eas build --profile preview --platform ios
```

To test through TestFlight, build with the production profile and submit it to App Store Connect. This uploads a build for testing; it does not automatically release it to the public App Store:

```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

After Apple finishes processing the build, add it to an internal TestFlight testing group and install TestFlight on the iPhone. Test the export there. Only submit the tested build for App Store review when you are ready. If you change the code after testing, create and test another build.

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

### Preview Builds

The free EAS tier has 30 builds/month combined across platforms. The `preview` profile uses internal distribution and does not auto-increment the production build number. On iOS it is an internal install, not a TestFlight upload; registered devices may be required. Use the production-profile/TestFlight flow above when you specifically need to test through TestFlight.

```bash
# iOS preview — internal install; register the device if EAS requests it
eas build --platform ios --profile preview

# Android preview — internal install
eas build --platform android --profile preview
```

Preview builds are useful for validating native behavior before a production/TestFlight build.

### Supabase Edge Functions

For verified maintenance-record exports, the `record_exports.record_snapshot` column and access-policy migration must be applied before creating any snapshots. Deploy the verifier and update the Cloudflare Worker before removing public table access. The schema, access policy, and verifier are already deployed for this project. Deploy the latest `web/worker.js` if it has changed, then deploy the authenticated snapshot creator before testing the updated app export flow.

```bash
# Creates an export-time record snapshot and its SHA-256 fingerprint (JWT required)
npx supabase functions deploy create-record-export

# Public verification by export ID; does not require a user JWT
npx supabase functions deploy verify-record-export --no-verify-jwt

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

**`create-record-export`** — Authenticates the user, verifies access to the vehicle, captures the maintenance records and their update history, computes a SHA-256 fingerprint of the snapshot, and stores both in `record_exports`. The app renders the PDF from this server-created snapshot.

**`verify-record-export`** — Publicly retrieves one export snapshot by export ID and checks that the saved snapshot still matches its stored fingerprint. The Cloudflare verification page displays those official records for manual comparison with the seller's PDF. This verifies the saved snapshot, not the PDF automatically, and does not prove that owner-entered maintenance actually occurred.

---

## License

Apache License 2.0